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
  // Carga inicial do piloto: até esta data (YYYY-MM-DD, inclusive) aceita notas das últimas N semanas
  // e não publica nenhuma semana; no dia seguinte publica todas de uma vez.
  cargaInicialAte: process.env.CARGA_INICIAL_ATE || '',
  cargaInicialSemanas: num('CARGA_INICIAL_SEMANAS', 8),
  // E-mail (lembretes e recuperação de senha). Sem SMTP_URL, as mensagens só vão para o log.
  smtpUrl: process.env.SMTP_URL || '',
  emailRemetente: process.env.EMAIL_REMETENTE || 'Preço de Praça <nao-responda@precodepraca.com.br>',
  appUrl: (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000').replace(/\/$/, ''),
  // Versão vigente dos termos; mudar a versão pede novo aceite de todos
  termosVersao: process.env.TERMOS_VERSAO || '2026-10-piloto-v1',
  // Dados do operador do serviço que aparecem nos termos e na política de privacidade
  operador: {
    nome: process.env.OPERADOR_NOME || '[nome da empresa operadora]',
    cnpj: process.env.OPERADOR_CNPJ || '[CNPJ]',
    email: process.env.OPERADOR_EMAIL || '[e-mail de contato]',
    foro: process.env.OPERADOR_FORO || '[cidade/UF]',
  },
  // Desvio máximo em relação à mediana de referência antes de mandar para revisão manual
  desvioRevisao: num('DESVIO_REVISAO', 0.15),
};
