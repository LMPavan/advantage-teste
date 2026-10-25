import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarApp } from '../src/app.ts';
import { criarPool, migrar, type Db } from '../src/db.ts';
import { fecharSemanasPendentes } from '../src/estatistica/fechamento.ts';
import { completarCnpj } from '../src/nfe/documentos.ts';
import type { ProdutoId } from '../src/dominio/produtos.ts';
import { CA_TESTE, notaAssinada } from './apoio.ts';
import type { Email } from '../src/email.ts';
import { criarSessao } from '../src/auth.ts';
import { enviarLembretes } from '../src/lembretes.ts';

// Precisa de um PostgreSQL: DATABASE_URL_TEST (padrão: banco local precodepraca_test). O esquema é recriado a cada execução.
const URL_TESTE = process.env.DATABASE_URL_TEST ?? 'postgres://app:app@localhost:5432/precodepraca_test';

let db: Db;
let app: Awaited<ReturnType<typeof criarApp>>;
let agora = new Date('2026-10-14T10:00:00-03:00');
const emails: Email[] = [];
const enviarEmail = async (e: Email) => { emails.push(e); };

async function cadastrar(n: number): Promise<{ cookie: string; cnpj: string }> {
  const cnpj = completarCnpj(String(10000000 + n) + '0001');
  const r = await app.inject({ method: 'POST', url: '/api/cadastro', payload: { nome: `Posto ${n}`, email: `p${n}@teste.com`, senha: 'senha-segura', cnpj, razaoSocial: `Posto ${n} Ltda`, aceiteTermos: true } });
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
  app = await criarApp({ db, agora: () => agora, autoridades: [CA_TESTE], cargaInicial: { ate: '', semanas: 8 }, enviarEmail });
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
    const ruim = await app.inject({ method: 'POST', url: '/api/cadastro', payload: { nome: 'X', email: 'x@x.com', senha: 'senha-segura', cnpj: '11111111111111', razaoSocial: 'X', aceiteTermos: true } });
    expect(ruim.statusCode).toBe(400);
    const rep = await app.inject({ method: 'POST', url: '/api/cadastro', payload: { nome: 'Fulano', email: 'y@x.com', senha: 'senha-segura', cnpj: postos[0]!.cnpj, razaoSocial: 'Posto Repetido', aceiteTermos: true } });
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
    expect(gc).toMatchObject({ aberta: true, postos: '5 a 9', mediana: 5.725 });
    expect(gc).not.toHaveProperty('minimo');
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

  it('rede com vários postos: a nota vai para o posto do CNPJ destinatário', async () => {
    const p = postos[0]!;
    const filial = completarCnpj(p.cnpj.slice(0, 8) + '0002');
    const r = await app.inject({ method: 'POST', url: '/api/postos', headers: { cookie: p.cookie }, payload: { cnpj: filial, razaoSocial: 'Posto 1 Filial' } });
    expect(r.statusCode).toBe(201);
    const nota = await enviar(p.cookie, filial, 5000, '2026-10-21T08:00:00-03:00', [{ produto: 'gc', precoLitro: 5.7 }], '3550308');
    expect(nota.statusCode, nota.body).toBe(201);
    expect(nota.json().postoId).toBe(r.json().id);
    const { rows } = await db.query('SELECT municipio FROM postos WHERE id = $1', [r.json().id]);
    expect(rows[0].municipio).toBe('3550308');
  });

  it('chave de API dá acesso sem navegador e pode ser revogada', async () => {
    const p = postos[0]!;
    const criada = await app.inject({ method: 'POST', url: '/api/tokens', headers: { cookie: p.cookie }, payload: { nome: 'ERP' } });
    const { token, id } = criada.json();
    expect(token).toMatch(/^pp_/);
    const eu = await app.inject({ url: '/api/eu', headers: { authorization: 'Bearer ' + token } });
    expect(eu.statusCode).toBe(200);
    expect(eu.json().usuario.email).toBe('p1@teste.com');
    const lista = await app.inject({ url: '/api/tokens', headers: { cookie: p.cookie } });
    expect(JSON.stringify(lista.json())).not.toContain(token);
    await app.inject({ method: 'DELETE', url: '/api/tokens/' + id, headers: { cookie: p.cookie } });
    expect((await app.inject({ url: '/api/eu', headers: { authorization: 'Bearer ' + token } })).statusCode).toBe(401);
  });

  it('administração lista participantes e gera senha provisória', async () => {
    await db.query("UPDATE usuarios SET admin = true WHERE email = 'p7@teste.com'");
    const adm = postos[6]!.cookie;
    const r = await app.inject({ url: '/api/admin/postos', headers: { cookie: adm } });
    expect(r.statusCode).toBe(200);
    expect(r.json().postos.length).toBeGreaterThanOrEqual(8);
    expect((await app.inject({ url: '/api/admin/postos', headers: { cookie: postos[0]!.cookie } })).statusCode).toBe(403);
    const { rows } = await db.query("SELECT id FROM usuarios WHERE email = 'p2@teste.com'");
    const s = await app.inject({ method: 'POST', url: `/api/admin/usuarios/${rows[0].id}/senha`, headers: { cookie: adm } });
    const entrar = await app.inject({ method: 'POST', url: '/api/entrar', payload: { email: 'p2@teste.com', senha: s.json().senha } });
    expect(entrar.statusCode).toBe(200);
  });

  it('cadastro exige aceite dos termos e grava a versão', async () => {
    const cnpj = completarCnpj('300000010001');
    const sem = await app.inject({ method: 'POST', url: '/api/cadastro', payload: { nome: 'Sem Aceite', email: 'sa@teste.com', senha: 'senha-segura', cnpj, razaoSocial: 'Posto SA' } });
    expect(sem.statusCode).toBe(400);
    const { rows } = await db.query("SELECT termos_versao, termos_aceitos_em FROM usuarios WHERE email = 'p1@teste.com'");
    expect(rows[0].termos_versao).toBeTruthy();
    expect(rows[0].termos_aceitos_em).toBeTruthy();
  });

  it('nova versão dos termos bloqueia o uso até o novo aceite', async () => {
    // a sessão anterior do p2 caiu com a senha provisória gerada no teste da administração
    const { rows: [u2] } = await db.query("SELECT id FROM usuarios WHERE email = 'p2@teste.com'");
    const p = { cookie: 'sessao=' + (await criarSessao(db, u2.id)).token };
    await db.query("UPDATE usuarios SET termos_versao = 'antiga' WHERE email = 'p2@teste.com'");
    const bloqueado = await app.inject({ url: '/api/painel?semana=2026-10-12&produto=gc&nivel=brasil&area=BR', headers: { cookie: p.cookie } });
    expect(bloqueado.statusCode).toBe(403);
    expect(bloqueado.json().motivo).toBe('termos');
    expect((await app.inject({ url: '/api/eu', headers: { cookie: p.cookie } })).json().termosPendentes).toBe(true);
    expect((await app.inject({ method: 'POST', url: '/api/termos', headers: { cookie: p.cookie }, payload: { aceito: true } })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/painel?semana=2026-10-12&produto=gc&nivel=brasil&area=BR', headers: { cookie: p.cookie } })).statusCode).toBe(200);
  });

  it('termos e política de privacidade estão publicados', async () => {
    const r = await app.inject({ url: '/privacidade' });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('Lei Geral de Proteção de Dados');
    expect(r.body).not.toContain('{{');
  });

  it('recupera a senha por e-mail com link de uso único', async () => {
    emails.length = 0;
    expect((await app.inject({ method: 'POST', url: '/api/senha/esqueci', payload: { email: 'naoexiste@teste.com' } })).statusCode).toBe(200);
    expect(emails).toHaveLength(0);
    await app.inject({ method: 'POST', url: '/api/senha/esqueci', payload: { email: 'P3@teste.com' } });
    expect(emails).toHaveLength(1);
    const codigo = /redefinir=([\w-]+)/.exec(emails[0]!.texto)![1]!;
    const r = await app.inject({ method: 'POST', url: '/api/senha/redefinir', payload: { codigo, senha: 'senha-nova-123' } });
    expect(r.statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/senha/redefinir', payload: { codigo, senha: 'outra-senha-123' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/entrar', payload: { email: 'p3@teste.com', senha: 'senha-nova-123' } })).statusCode).toBe(200);
    expect((await app.inject({ url: '/api/eu', headers: { cookie: postos[2]!.cookie } })).statusCode).toBe(401);
  });

  it('lembra na segunda quem não completou a semana anterior, uma vez só', async () => {
    emails.length = 0;
    const segunda = new Date('2026-10-26T10:00:00-03:00');
    const n = await enviarLembretes(db, enviarEmail, segunda);
    expect(n).toBeGreaterThan(0);
    const destinatarios = emails.map(e => e.para);
    expect(destinatarios).toContain('p1@teste.com');
    expect(destinatarios).not.toContain('p2@teste.com'); // completou a semana com "não comprei"
    expect(emails[0]!.assunto).toMatch(/19\/10\/2026/);
    expect(await enviarLembretes(db, enviarEmail, segunda)).toBe(0);
    await db.query("UPDATE usuarios SET lembretes = false WHERE email = 'p1@teste.com'");
    expect(await enviarLembretes(db, enviarEmail, new Date('2026-10-27T13:00:00-03:00'))).toBeGreaterThan(0);
    expect(emails.slice(n).map(e => e.para)).not.toContain('p1@teste.com');
  });

  it('carga inicial aceita semanas anteriores e publica tudo de uma vez no fim', async () => {
    agora = new Date('2026-11-03T10:00:00-03:00');
    const carga = await criarApp({ db, agora: () => agora, autoridades: [CA_TESTE], cargaInicial: { ate: '2026-11-06', semanas: 8 }, enviarEmail });
    const novo = await carga.inject({ method: 'POST', url: '/api/cadastro', payload: { nome: 'Posto Novo', email: 'novo@teste.com', senha: 'senha-segura', cnpj: completarCnpj('200000010001'), razaoSocial: 'Posto Novo', aceiteTermos: true } });
    const cookie = String(novo.headers['set-cookie']).split(';')[0]!;
    const cnpj = completarCnpj('200000010001');
    const nota = (n: number, quando: string) => carga.inject({ method: 'POST', url: '/api/nfes', headers: { cookie, 'content-type': 'application/xml' },
      payload: notaAssinada({ numero: n, emitidaEm: quando, destinatario: { cnpj, nome: 'POSTO', municipio: '3509502', municipioNome: 'X', uf: 'SP' }, itens: [{ produto: 'gc', litros: 1000, precoLitro: 5.7 }] }) });
    const antiga = await nota(9001, '2026-09-15T08:00:00-03:00');
    expect(antiga.statusCode, antiga.body).toBe(201);
    expect((await nota(9002, '2026-10-13T08:00:00-03:00')).statusCode).toBe(422); // semana já publicada
    expect((await nota(9003, '2026-08-25T08:00:00-03:00')).statusCode).toBe(422); // antes da janela
    expect((await carga.inject({ url: '/api/eu', headers: { cookie } })).json().cargaInicial).toEqual({ desde: '2026-09-07', ate: '2026-11-06' });
    expect(await fecharSemanasPendentes(db, new Date('2026-11-05T10:00:00-03:00'), '2026-11-06')).toEqual([]);
    expect(await fecharSemanasPendentes(db, new Date('2026-11-07T00:30:00-03:00'), '2026-11-06')).toContain('2026-09-14');
    await carga.close();
  });

  it('exige login', async () => {
    expect((await app.inject({ url: '/api/painel?semana=2026-10-12&produto=gc&nivel=brasil&area=BR' })).statusCode).toBe(401);
  });
});
