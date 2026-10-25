import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.ts';
import { criarPool, migrar, type Db } from '../src/db.ts';
import { fecharSemanasPendentes } from '../src/estatistica/fechamento.ts';
import { completarCnpj } from '../src/nfe/documentos.ts';
import type { ProdutoId } from '../src/dominio/produtos.ts';
import { CA_TESTE, notaAssinada } from './apoio.ts';

// Precisa de um PostgreSQL: DATABASE_URL_TEST (padrão: banco local precodepraca_test). O esquema é recriado a cada execução.
const URL_TESTE = process.env.DATABASE_URL_TEST ?? 'postgres://app:app@localhost:5432/precodepraca_test';

let db: Db;
let app: Awaited<ReturnType<typeof criarApp>>;
let agora = new Date('2026-10-14T10:00:00-03:00');

async function cadastrar(n: number): Promise<{ cookie: string; cnpj: string }> {
  const cnpj = completarCnpj(String(10000000 + n) + '0001');
  const r = await app.inject({ method: 'POST', url: '/api/cadastro', payload: { nome: `Posto ${n}`, email: `p${n}@teste.com`, senha: 'senha-segura', cnpj, razaoSocial: `Posto ${n} Ltda` } });
  expect(r.statusCode).toBe(201);
  return { cookie: String(r.headers['set-cookie']).split(';')[0]!, cnpj };
}

function enviar(cookie: string, cnpj: string, n: number, emitidaEm: string, itens: { produto: ProdutoId; precoLitro: number }[], municipio = '3509502') {
  const xml = notaAssinada({
    numero: n, emitidaEm,
    destinatario: { cnpj, nome: 'POSTO', municipio, municipioNome: 'X', uf: 'SP' },
    itens: itens.map(i => ({ ...i, litros: 10000 })),
  });
  return app.inject({ method: 'POST', url: '/api/nfes', headers: { cookie, 'content-type': 'application/xml' }, payload: xml });
}

beforeAll(async () => {
  db = criarPool(URL_TESTE);
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrar(db);
  app = await criarApp({ db, agora: () => agora, autoridades: [CA_TESTE] });
});
afterAll(async () => { await app?.close(); await db?.end(); });

describe('fluxo completo', () => {
  const postos: { cookie: string; cnpj: string }[] = [];

  it('carrega a geografia do IBGE sem nível de município no painel', async () => {
    const { rows } = await db.query('SELECT (SELECT count(*) FROM microrregioes)::int AS micro, (SELECT count(*) FROM mesorregioes)::int AS meso');
    expect(rows[0]).toEqual({ micro: 558, meso: 137 });
  });

  it('cadastra postos e recusa CNPJ inválido ou repetido', async () => {
    for (let i = 1; i <= 7; i++) postos.push(await cadastrar(i));
    const ruim = await app.inject({ method: 'POST', url: '/api/cadastro', payload: { nome: 'X', email: 'x@x.com', senha: 'senha-segura', cnpj: '11111111111111', razaoSocial: 'X' } });
    expect(ruim.statusCode).toBe(400);
    const rep = await app.inject({ method: 'POST', url: '/api/cadastro', payload: { nome: 'Fulano', email: 'y@x.com', senha: 'senha-segura', cnpj: postos[0]!.cnpj, razaoSocial: 'Posto Repetido' } });
    expect(rep.statusCode, rep.body).toBe(409);
  });

  it('posto novo vê o painel enquanto não há semana publicada', async () => {
    const r = await app.inject({ url: '/api/eu', headers: { cookie: postos[0]!.cookie } });
    expect(r.json().liberado).toBe(true);
  });

  it('aceita as NF-e da semana e define a localização pelo destinatário', async () => {
    // Semana de 12/out: 6 postos em Campinas; só o primeiro informa os quatro produtos
    for (const [i, p] of postos.slice(0, 6).entries()) {
      const itens: { produto: ProdutoId; precoLitro: number }[] = [{ produto: 'gc', precoLitro: 5.70 + i * 0.01 }];
      if (i === 0) itens.push({ produto: 'et', precoLitro: 3.9 }, { produto: 's10', precoLitro: 5.9 }, { produto: 's500', precoLitro: 5.8 });
      const r = await enviar(p.cookie, p.cnpj, 1000 + i, '2026-10-13T08:00:00-03:00', itens);
      expect(r.statusCode, r.body).toBe(201);
      expect(r.json().status).toBe('aceita');
    }
    const { rows } = await db.query('SELECT DISTINCT municipio FROM postos WHERE municipio IS NOT NULL');
    expect(rows).toEqual([{ municipio: '3509502' }]);
  });

  it('não aceita a mesma nota duas vezes', async () => {
    const r = await enviar(postos[0]!.cookie, postos[0]!.cnpj, 1000, '2026-10-13T08:00:00-03:00', [{ produto: 'gc', precoLitro: 5.7 }]);
    expect(r.statusCode).toBe(409);
  });

  it('recusa nota de outro posto', async () => {
    const r = await enviar(postos[1]!.cookie, postos[0]!.cnpj, 2000, '2026-10-13T08:00:00-03:00', [{ produto: 'gc', precoLitro: 5.7 }]);
    expect(r.statusCode).toBe(422);
  });

  it('publica a semana só depois do prazo', async () => {
    expect(await fecharSemanasPendentes(db, new Date('2026-10-20T23:00:00-03:00'))).toEqual([]);
    expect(await fecharSemanasPendentes(db, new Date('2026-10-21T00:30:00-03:00'))).toEqual(['2026-10-12']);
    agora = new Date('2026-10-25T12:00:00-03:00');
  });

  it('trava o painel de quem não completou a semana publicada', async () => {
    const r = await app.inject({ url: '/api/painel?semana=2026-10-12&produto=gc&nivel=micro&area=35032', headers: { cookie: postos[1]!.cookie } });
    expect(r.statusCode).toBe(403);
    expect(r.json().motivo).toBe('nf_pendente');
    const novo = await app.inject({ url: '/api/painel?semana=2026-10-12&produto=gc&nivel=micro&area=35032', headers: { cookie: postos[6]!.cookie } });
    expect(novo.statusCode).toBe(403);
  });

  it('mostra estatísticas por microrregião a quem está em dia, sem expor a quantidade exata', async () => {
    const r = await app.inject({ url: '/api/painel?semana=2026-10-12&produto=gc&nivel=micro&area=35032', headers: { cookie: postos[0]!.cookie } });
    expect(r.statusCode, r.body).toBe(200);
    const b = r.json();
    expect(b.area.nome).toBe('Campinas (SP)');
    const gc = b.kpis.find((k: { produto: string }) => k.produto === 'gc').atual;
    expect(gc).toMatchObject({ aberta: true, postos: '5 a 9', minimo: 5.7, maximo: 5.75, mediana: 5.725 });
    const et = b.kpis.find((k: { produto: string }) => k.produto === 'et').atual;
    expect(et).toMatchObject({ aberta: false, postos: '1', mediana: null });
    expect(b.minha.valor).toBeCloseTo(5.7, 6);
    // distribuidora só aparece de UF para cima
    expect(b.distribuidoras).toEqual([]);
    const uf = await app.inject({ url: '/api/painel?semana=2026-10-12&produto=gc&nivel=uf&area=SP', headers: { cookie: postos[0]!.cookie } });
    expect(uf.json().distribuidoras).toHaveLength(1);
  });

  it('recusa nota da semana já publicada', async () => {
    const r = await enviar(postos[1]!.cookie, postos[1]!.cnpj, 3000, '2026-10-14T08:00:00-03:00', [{ produto: 'et', precoLitro: 3.9 }]);
    expect(r.statusCode).toBe(422);
  });

  it('libera quem completa a semana em aberto, usando "não comprei"', async () => {
    const p = postos[1]!;
    expect((await enviar(p.cookie, p.cnpj, 4000, '2026-10-20T08:00:00-03:00', [{ produto: 'gc', precoLitro: 5.71 }])).statusCode).toBe(201);
    for (const produto of ['et', 's10', 's500']) {
      const r = await app.inject({ method: 'POST', url: '/api/sem-compra', headers: { cookie: p.cookie }, payload: { produto, marcado: true } });
      expect(r.statusCode).toBe(200);
    }
    const r = await app.inject({ url: '/api/painel?semana=2026-10-12&produto=gc&nivel=brasil&area=BR', headers: { cookie: p.cookie } });
    expect(r.statusCode).toBe(200);
  });

  it('lista mesorregiões e microrregiões dentro de uma UF', async () => {
    const r = await app.inject({ url: '/api/tabela?semana=2026-10-12&produto=gc&nivel=uf&area=SP&agrupar=micro', headers: { cookie: postos[0]!.cookie } });
    expect(r.statusCode).toBe(200);
    expect(r.json().linhas).toEqual([expect.objectContaining({ area: '35032', nome: 'Campinas (SP)' })]);
  });

  it('exige login', async () => {
    expect((await app.inject({ url: '/api/painel?semana=2026-10-12&produto=gc&nivel=brasil&area=BR' })).statusCode).toBe(401);
  });
});
