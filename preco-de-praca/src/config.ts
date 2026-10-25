import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PASTA_ICP = fileURLToPath(new URL('../data/icp-brasil/', import.meta.url));

function num(nome: string, padrao: number): number {
  const v = process.env[nome];
  if (v === undefined || v === '') return padrao;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${nome} precisa ser um número`);
  return n;
}

export const config = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5432/precodepraca',
  porta: num('PORT', 3000),
  kMinimo: num('K_MINIMO', 5),
  prazoDias: num('PRAZO_DIAS', 2),
  // Sem configuração, usa data/icp-brasil quando existir (npm run icp)
  icpBrasilCaDir: process.env.ICP_BRASIL_CA_DIR || (existsSync(PASTA_ICP) ? PASTA_ICP : ''),
  demo: process.env.DEMO === '1',
  producao: process.env.NODE_ENV === 'production',
  // Se definido, o cadastro exige este código (piloto fechado)
  codigoConvite: process.env.CODIGO_CONVITE || '',
  diasTeste: num('DIAS_TESTE', 30),
  // "Não comprei" aceito por no máximo N semanas seguidas por produto
  semCompraMaxSeguidas: num('SEM_COMPRA_MAX_SEGUIDAS', 2),
  // Desvio máximo em relação à mediana de referência antes de mandar para revisão manual
  desvioRevisao: num('DESVIO_REVISAO', 0.15),
};
