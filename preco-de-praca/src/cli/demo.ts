import { gerarHash } from '../auth.ts';
import { carregarGeo } from '../contexto.ts';
import { criarPool, migrar } from '../db.ts';
import { PRODUTOS, type ProdutoId } from '../dominio/produtos.ts';
import { prazoEncerrado, semanaDoInstante, somarDias } from '../dominio/semanas.ts';
import { fecharSemanasPendentes } from '../estatistica/fechamento.ts';
import { completarCnpj, dvChave } from '../nfe/documentos.ts';

// Popula o banco com dados FICTÍCIOS para demonstração: postos, distribuidoras e notas inventadas.
// Recusa rodar se já houver postos reais cadastrados.

const db = criarPool();
await migrar(db);
const reais = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM postos WHERE NOT demo');
if (reais.rows[0]!.n > 0) {
  console.error('O banco tem postos reais. Os dados de demonstração só podem ser criados num banco vazio.');
  process.exit(1);
}
const jaTem = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM postos');
if (jaTem.rows[0]!.n > 0) {
  console.log('Dados de demonstração já existem.');
  process.exit(0);
}

let seed = 20261025;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };

const geo = await carregarGeo(db);
const agora = new Date();
const atual = semanaDoInstante(agora);
const semanas = Array.from({ length: 9 }, (_, i) => somarDias(atual, -7 * (8 - i)));

const BASE: Record<ProdutoId, number> = { gc: 5.74, et: 3.96, s10: 5.93, s500: 5.77 };
const UF_AJUSTE: Record<string, number> = { SP: -0.04, MG: 0, RJ: 0.02, PR: 0, RS: 0.04, GO: 0.03, BA: 0.07, PE: 0.06, PA: 0.17, MT: 0.09 };
const ETANOL_AJUSTE: Record<string, number> = { SP: -0.3, MG: -0.12, RJ: 0.1, PR: -0.15, RS: 0.22, GO: -0.28, BA: 0.18, PE: 0.12, PA: 0.35, MT: -0.32 };
const DISTS = [
  { nome: 'DISTRIBUIDORA DEMONSTRACAO A', ajuste: 0.075, peso: 0.22 },
  { nome: 'DISTRIBUIDORA DEMONSTRACAO B', ajuste: 0.05, peso: 0.2 },
  { nome: 'DISTRIBUIDORA DEMONSTRACAO C', ajuste: 0.062, peso: 0.17 },
  { nome: 'DISTRIBUIDORA REGIONAL D', ajuste: -0.01, peso: 0.13 },
  { nome: 'DISTRIBUIDORA REGIONAL E', ajuste: -0.032, peso: 0.12 },
  { nome: 'DISTRIBUIDORA REGIONAL F', ajuste: -0.058, peso: 0.16 },
];

const distIds: number[] = [];
for (const [i, d] of DISTS.entries()) {
  const r = await db.query<{ id: number }>('INSERT INTO distribuidoras (cnpj_raiz, nome, revisada) VALUES ($1, $2, true) RETURNING id', [String(99000001 + i), d.nome]);
  distIds.push(r.rows[0]!.id);
}
const sortearDist = () => { let x = rnd(), acc = 0; for (const [i, d] of DISTS.entries()) { acc += d.peso; if (x <= acc) return i; } return DISTS.length - 1; };

const deriva = semanas.map(() => ({} as Record<ProdutoId, number>));
for (const p of PRODUTOS) { let v = -0.04; for (const s of deriva) { v += gauss() * 0.025 + (p.id === 'et' ? -0.005 : 0.004); s[p.id] = v; } }

// Microrregiões das UFs escolhidas, com uma ou duas mesorregiões por UF mais povoadas de postos
const microsPorUf = new Map<string, string[]>();
for (const [codigo, m] of geo.micros) {
  const uf = geo.mesos.get(m.meso)!.uf;
  if (!(uf in UF_AJUSTE)) continue;
  if (!microsPorUf.has(uf)) microsPorUf.set(uf, []);
  microsPorUf.get(uf)!.push(codigo);
}
const municipioDaMicro = new Map<string, string>();
for (const [codigo, m] of geo.municipios) if (!municipioDaMicro.has(m.micro)) municipioDaMicro.set(m.micro, codigo);
municipioDaMicro.set('35032', '3509502'); // Campinas

const senha = await gerarHash('demo1234');
let nPosto = 0, nNota = 0;
async function criarPosto(usuarioEmail: string, nome: string, municipio: string, cnpj: string, admin = false) {
  const u = await db.query<{ id: number }>('INSERT INTO usuarios (email, nome, senha_hash, admin) VALUES ($1, $2, $3, $4) RETURNING id',
    [usuarioEmail, nome, admin ? await gerarHash('admin1234') : senha, admin]);
  const p = await db.query<{ id: number }>(`INSERT INTO postos (usuario_id, cnpj, razao_social, municipio, assinatura, teste_ate, demo)
    VALUES ($1, $2, $3, $4, 'ativa', NULL, true) RETURNING id`, [u.rows[0]!.id, cnpj, nome, municipio]);
  return p.rows[0]!.id;
}

async function inserirNota(postoId: number, dist: number, semana: string, municipio: string, itens: [ProdutoId, number][]) {
  nNota++;
  const base = municipio.slice(0, 2) + semana.slice(2, 4) + semana.slice(5, 7) + completarCnpj(String(99000001 + dist) + '0001') + '55001'
    + String(nNota).padStart(9, '0') + '1' + String(nNota * 7919 % 1e8).padStart(8, '0');
  const emitida = new Date(somarDias(semana, Math.floor(rnd() * 5)) + 'T10:00:00-03:00');
  const n = await db.query<{ id: number }>(`INSERT INTO nfes (chave, posto_id, distribuidora_id, emitente_cnpj, emitente_nome, emitida_em, semana,
      municipio, mod_frete, status, assinatura) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'0','aceita','nao_verificada') RETURNING id`,
    [base + dvChave(base), postoId, distIds[dist], completarCnpj(String(99000001 + dist) + '0001'), DISTS[dist]!.nome, emitida, semana, municipio]);
  for (const [produto, preco] of itens) {
    await db.query('INSERT INTO nfe_itens (nfe_id, produto_id, descricao, cfop, litros, preco_litro) VALUES ($1,$2,$3,$4,$5,$6)',
      [n.rows[0]!.id, produto, PRODUTOS.find(p => p.id === produto)!.nome.toUpperCase(), '5655', 5000 + Math.round(rnd() * 15000), preco]);
  }
}

function preco(uf: string, dist: number, ajustePosto: number, s: number, p: ProdutoId): number {
  const regional = p === 'et' ? ETANOL_AJUSTE[uf]! : UF_AJUSTE[uf]!;
  return Math.round((BASE[p] + regional + DISTS[dist]!.ajuste * (p === 'et' ? 0.8 : 1) + ajustePosto + deriva[s]![p] + gauss() * 0.034) * 10000) / 10000;
}

const semanasFechadas = semanas.filter(s => prazoEncerrado(s, agora));
for (const [uf, micros] of microsPorUf) {
  const escolhidas = micros.sort((a, b) => a.localeCompare(b)).filter((_, i) => i % 3 === 0).slice(0, 8);
  if (uf === 'SP' && !escolhidas.includes('35032')) escolhidas.push('35032');
  for (const micro of escolhidas) {
    const municipio = municipioDaMicro.get(micro)!;
    const quantos = micro === '35032' ? 12 : 2 + Math.floor(rnd() * 11);
    const ajusteMicro = gauss() * 0.03;
    for (let k = 0; k < quantos; k++) {
      nPosto++;
      const cnpj = completarCnpj(String(70000000 + nPosto) + '0001');
      const postoId = await criarPosto(`posto${nPosto}@demo.precodepraca.dev`, `Posto Demonstração ${nPosto}`, municipio, cnpj);
      const dist = sortearDist(), ajuste = ajusteMicro + gauss() * 0.03, vendeS500 = rnd() < 0.75;
      for (const [s, semana] of semanas.entries()) {
        if (rnd() > (semana === atual ? 0.5 : 0.94)) continue;
        const itens = PRODUTOS.filter(p => p.id !== 's500' || vendeS500).map(p => [p.id, preco(uf, dist, ajuste, s, p.id)] as [ProdutoId, number]);
        await inserirNota(postoId, dist, semana, municipio, itens);
      }
      if (!vendeS500) for (const semana of semanasFechadas) await db.query('INSERT INTO sem_compra VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [postoId, semana, 's500']);
    }
  }
}

// Conta de demonstração em Campinas: em dia com as semanas publicadas, semana atual em aberto para testar o envio
const demoId = await criarPosto('demo@precodepraca.dev', 'Posto Exemplo Ltda', '3509502', '44555666000181');
for (const [s, semana] of semanas.entries()) {
  if (semana === atual) continue;
  await inserirNota(demoId, 0, semana, '3509502', PRODUTOS.map(p => [p.id, preco('SP', 0, -0.01, s, p.id)]));
}
await criarPosto('admin@precodepraca.dev', 'Administração', '3550308', completarCnpj('700999990001'), true);

const publicadas = await fecharSemanasPendentes(db, agora);
console.log(`${nPosto} postos de demonstração, ${nNota} notas, semanas publicadas: ${publicadas.join(', ')}`);
console.log('Entre com demo@precodepraca.dev / demo1234 (posto) ou admin@precodepraca.dev / admin1234 (administração).');
await db.end();
