import type { X509Certificate } from 'node:crypto';
import { config } from '../config.ts';
import type { ProdutoId } from '../dominio/produtos.ts';
import { prazoEncerrado, prazoEnvio, semanaDoInstante } from '../dominio/semanas.ts';
import { verificarAssinatura, type ResultadoAssinatura } from './assinatura.ts';
import { chaveValida, formatarCnpj } from './documentos.ts';
import { lerNfe, type ItemNfe, type Nfe } from './parser.ts';

export type Gravidade = 'ok' | 'info' | 'revisao' | 'recusa';
export interface Verificacao { gravidade: Gravidade; texto: string }

export interface ContextoValidacao {
  cnpjPosto: string;
  municipioPosto: string | null;
  agora: Date;
  municipioExiste: (codigo: string) => boolean;
  faixaProduto: (produto: ProdutoId) => { min: number; max: number };
  /** Mediana publicada mais recente da área do posto, para o teste de plausibilidade */
  medianaReferencia: (produto: ProdutoId) => number | null;
  autoridades: X509Certificate[];
}

export interface ItemValidado extends ItemNfe { produto: ProdutoId; foraDaFaixa: boolean }

export interface ResultadoValidacao {
  status: 'aceita' | 'em_revisao' | 'recusada';
  nfe: Nfe;
  semana: string;
  itens: ItemValidado[];
  verificacoes: Verificacao[];
  assinatura: ResultadoAssinatura;
}

// Venda de combustível para comercialização (adquirido de terceiros ou de produção própria), dentro e fora do estado
const CFOPS_REVENDA = ['5652', '6652', '5655', '6655'];

const brl = (v: number) => 'R$ ' + v.toFixed(4).replace('.', ',');

export function validarNfe(xml: string, ctx: ContextoValidacao): ResultadoValidacao {
  const original = lerNfe(xml);
  const v: Verificacao[] = [];
  const add = (gravidade: Gravidade, texto: string) => v.push({ gravidade, texto });

  const assinatura = verificarAssinatura(xml, original.documento, original.chave, original.emitidaEm, ctx.autoridades);
  // Com assinatura válida, os dados vêm do trecho assinado. Isso impede que alguém acrescente conteúdo fora da área assinada.
  const nfe = assinatura.conteudoAssinado ? lerNfe(assinatura.conteudoAssinado) : original;
  if (nfe.chave !== original.chave) throw new Error('Conteúdo assinado não corresponde à nota enviada.');

  if (nfe.modelo !== '55') add('recusa', `Modelo ${nfe.modelo || 'ausente'}: só aceitamos NF-e modelo 55.`);
  if (chaveValida(nfe.chave)) add('ok', 'Chave de acesso válida (44 dígitos e dígito verificador).');
  else add('recusa', 'Chave de acesso inválida.');
  if (nfe.tipo !== '1') add('recusa', 'A nota não é de saída da distribuidora (tpNF diferente de 1).');

  if (nfe.destinatario.cnpj === ctx.cnpjPosto) add('ok', 'Destinatário é o CNPJ do seu posto.');
  else add('recusa', `Destinatário ${formatarCnpj(nfe.destinatario.cnpj) || 'ausente'} não é o CNPJ do seu posto (${formatarCnpj(ctx.cnpjPosto)}).`);
  if (nfe.emitente.cnpj === nfe.destinatario.cnpj) add('recusa', 'Emitente e destinatário são o mesmo CNPJ.');

  let semana = '';
  if (isNaN(nfe.emitidaEm.getTime())) {
    add('recusa', 'Data de emissão ausente ou inválida.');
  } else {
    semana = semanaDoInstante(nfe.emitidaEm);
    if (nfe.emitidaEm.getTime() > ctx.agora.getTime() + 864e5) add('recusa', 'Data de emissão no futuro.');
    else if (prazoEncerrado(semana, ctx.agora)) add('recusa', `O prazo para notas da semana de ${dataBr(semana)} terminou em ${prazoEnvio(semana).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`);
    else add('ok', `Emitida em ${nfe.emitidaEm.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}, conta para a semana de ${dataBr(semana)}.`);
  }

  if (!ctx.municipioExiste(nfe.destinatario.municipio)) add('recusa', `Município do destinatário (${nfe.destinatario.municipio || 'sem código'}) não encontrado na base do IBGE.`);
  else if (ctx.municipioPosto && ctx.municipioPosto !== nfe.destinatario.municipio) add('recusa', 'O endereço do destinatário é de outro município que o das notas anteriores deste CNPJ.');
  else add('ok', `Localização pelo endereço do destinatário: ${nfe.destinatario.municipioNome}/${nfe.destinatario.uf}.`);

  // Assinatura digital
  if (assinatura.status === 'ausente') add('revisao', assinatura.motivo!);
  else if (assinatura.status === 'invalida') add('recusa', assinatura.motivo!);
  else {
    if (assinatura.cnpjCertificado && assinatura.cnpjCertificado.slice(0, 8) !== nfe.emitente.cnpj.slice(0, 8)) {
      add('recusa', 'O certificado que assinou a nota não pertence à empresa emitente.');
    } else if (!assinatura.cnpjCertificado) {
      add('revisao', 'Não foi possível ler o CNPJ do certificado que assinou a nota.');
    } else {
      add('ok', 'Assinatura digital confere: a nota não foi alterada depois de emitida.');
    }
    if (!assinatura.certificadoValidoNaEmissao) add('revisao', 'O certificado da distribuidora não estava válido na data de emissão.');
    if (ctx.autoridades.length === 0) add('info', 'Cadeia do certificado não verificada: configure ICP_BRASIL_CA_DIR.');
    else if (assinatura.cadeiaIcp) add('ok', 'Certificado emitido pela ICP-Brasil.');
    else add('revisao', 'O certificado não encadeia até uma autoridade da ICP-Brasil.');
  }

  // Itens
  const combustiveis = nfe.itens.filter((i): i is ItemNfe & { produto: ProdutoId } => i.produto !== null);
  if (combustiveis.length === 0) add('recusa', 'Nenhum item de gasolina C, etanol hidratado, diesel S10 ou diesel S500 na nota.');
  const cfopsRuins = [...new Set(combustiveis.filter(i => !CFOPS_REVENDA.includes(i.cfop)).map(i => i.cfop))];
  if (cfopsRuins.length) add('revisao', `CFOP ${cfopsRuins.join(', ')} não é de venda de combustível para revenda.`);
  else if (combustiveis.length) add('ok', 'CFOP de venda de combustível para revenda.');

  const itens: ItemValidado[] = combustiveis.map(i => {
    const faixa = ctx.faixaProduto(i.produto);
    const ref = ctx.medianaReferencia(i.produto);
    if (!(i.litros > 0) || !(i.precoLitro > 0)) {
      add('recusa', `${i.descricao}: quantidade ou preço ausente.`);
      return { ...i, foraDaFaixa: true };
    }
    if (i.precoLitro < faixa.min || i.precoLitro > faixa.max) {
      add('recusa', `${i.descricao}: ${brl(i.precoLitro)}/L está fora da faixa possível para o produto.`);
      return { ...i, foraDaFaixa: true };
    }
    if (ref && Math.abs(i.precoLitro - ref) / ref > config.desvioRevisao) {
      add('revisao', `${i.descricao}: ${brl(i.precoLitro)}/L está a mais de ${Math.round(config.desvioRevisao * 100)}% da mediana da sua região (${brl(ref)}).`);
      return { ...i, foraDaFaixa: true };
    }
    return { ...i, foraDaFaixa: false };
  });
  if (itens.length && itens.every(i => !i.foraDaFaixa)) add('ok', 'Preços dentro da faixa esperada para a sua região.');

  const status = v.some(x => x.gravidade === 'recusa') ? 'recusada' : v.some(x => x.gravidade === 'revisao') ? 'em_revisao' : 'aceita';
  return { status, nfe, semana, itens, verificacoes: v, assinatura };
}

function dataBr(semana: string): string {
  const [a, m, d] = semana.split('-');
  return `${d}/${m}/${a}`;
}
