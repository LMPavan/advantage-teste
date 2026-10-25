import { DOMParser, type Document, type Element } from '@xmldom/xmldom';
import { identificarProduto, type ProdutoId } from '../dominio/produtos.ts';

export interface ItemNfe {
  descricao: string;
  codigoAnp: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  produto: ProdutoId | null;
  /** Quantidade e preço convertidos para litro */
  litros: number;
  precoLitro: number;
}

export interface Nfe {
  chave: string;
  modelo: string;
  tipo: string; // tpNF: 1 = saída
  numero: string;
  emitidaEm: Date;
  emitente: { cnpj: string; nome: string; municipio: string; uf: string };
  destinatario: { cnpj: string; nome: string; municipio: string; municipioNome: string; uf: string };
  modFrete: string;
  itens: ItemNfe[];
  documento: Document;
  infNFe: Element;
}

export class ErroLeitura extends Error {}

const NS_NFE = 'http://www.portalfiscal.inf.br/nfe';

function filhos(el: Element, nome: string): Element[] {
  const out: Element[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as Element).localName === nome) out.push(n as Element);
  }
  return out;
}

/** Texto do caminho de filhos diretos, ex.: texto(infNFe, 'emit/enderEmit/UF'). */
function texto(el: Element | undefined, caminho: string): string {
  let atual: Element | undefined = el;
  for (const parte of caminho.split('/')) {
    if (!atual) return '';
    atual = filhos(atual, parte)[0];
  }
  return atual?.textContent?.trim() ?? '';
}

function numero(s: string): number {
  return s === '' ? NaN : Number(s);
}

export function lerNfe(xml: string): Nfe {
  if (!xml || !xml.trimStart().startsWith('<')) throw new ErroLeitura('O arquivo não é um XML. Envie o XML da NF-e, não o PDF do DANFE.');
  if (/<!DOCTYPE/i.test(xml)) throw new ErroLeitura('XML com DOCTYPE não é aceito.');
  let doc: Document;
  try {
    doc = new DOMParser({ onError: (nivel, msg) => { if (nivel !== 'warning') throw new ErroLeitura(msg); } }).parseFromString(xml, 'text/xml');
  } catch (e) {
    throw new ErroLeitura('XML malformado: ' + (e instanceof Error ? e.message : String(e)));
  }
  const todos = doc.getElementsByTagNameNS(NS_NFE, 'infNFe');
  if (todos.length === 0) throw new ErroLeitura('Não encontramos a NF-e no arquivo (tag infNFe ausente).');
  // Mais de um infNFe abre espaço para ataque de troca de conteúdo assinado; uma NF-e tem exatamente um.
  if (todos.length > 1) throw new ErroLeitura('O arquivo contém mais de uma NF-e. Envie uma nota por arquivo.');
  const inf = todos[0]!;
  const chave = (inf.getAttribute('Id') ?? '').replace(/^NFe/, '');

  const itens: ItemNfe[] = filhos(inf, 'det').map(det => {
    const prod = filhos(det, 'prod')[0];
    const descricao = texto(prod, 'xProd');
    const codigoAnp = texto(prod, 'comb/cProdANP');
    const unidade = texto(prod, 'uCom').toUpperCase();
    const quantidade = numero(texto(prod, 'qCom'));
    const valorUnitario = numero(texto(prod, 'vUnCom'));
    // Algumas distribuidoras faturam em m³
    const fator = unidade === 'M3' || unidade === 'M³' ? 1000 : 1;
    return {
      descricao, codigoAnp, cfop: texto(prod, 'CFOP'), unidade, quantidade, valorUnitario,
      produto: identificarProduto(codigoAnp, descricao),
      litros: quantidade * fator,
      precoLitro: valorUnitario / fator,
    };
  });

  const dhEmi = texto(inf, 'ide/dhEmi');
  return {
    chave,
    modelo: texto(inf, 'ide/mod'),
    tipo: texto(inf, 'ide/tpNF'),
    numero: texto(inf, 'ide/nNF'),
    emitidaEm: new Date(dhEmi),
    emitente: {
      cnpj: texto(inf, 'emit/CNPJ'),
      nome: texto(inf, 'emit/xNome'),
      municipio: texto(inf, 'emit/enderEmit/cMun'),
      uf: texto(inf, 'emit/enderEmit/UF'),
    },
    destinatario: {
      cnpj: texto(inf, 'dest/CNPJ'),
      nome: texto(inf, 'dest/xNome'),
      municipio: texto(inf, 'dest/enderDest/cMun'),
      municipioNome: texto(inf, 'dest/enderDest/xMun'),
      uf: texto(inf, 'dest/enderDest/UF'),
    },
    modFrete: texto(inf, 'transp/modFrete'),
    itens,
    documento: doc,
    infNFe: inf,
  };
}
