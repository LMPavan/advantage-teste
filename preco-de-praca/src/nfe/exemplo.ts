import { SignedXml } from 'xml-crypto';
import { PRODUTOS, type ProdutoId } from '../dominio/produtos.ts';
import { dvChave } from './documentos.ts';

// Gera NF-e no leiaute 4.00 só com os campos que o sistema lê. Usada nos testes e no modo de demonstração.

export interface DadosExemplo {
  numero: number;
  emitidaEm: string; // ISO com fuso, ex.: 2026-10-20T09:14:00-03:00
  emitente: { cnpj: string; nome: string; municipio: string; uf: string };
  destinatario: { cnpj: string; nome: string; municipio: string; municipioNome: string; uf: string };
  modFrete?: '0' | '1';
  itens: { produto: ProdutoId; litros: number; precoLitro: number; cfop?: string }[];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function montarChave(d: DadosExemplo): string {
  const aamm = d.emitidaEm.slice(2, 4) + d.emitidaEm.slice(5, 7);
  const base = d.destinatario.municipio.slice(0, 2) + aamm + d.emitente.cnpj + '55' + '001'
    + String(d.numero).padStart(9, '0') + '1' + String(d.numero * 7919 % 1e8).padStart(8, '0');
  return base + dvChave(base);
}

export function gerarNfeXml(d: DadosExemplo): string {
  const chave = montarChave(d);
  const det = d.itens.map((it, i) => {
    const p = PRODUTOS.find(x => x.id === it.produto)!;
    return `<det nItem="${i + 1}"><prod><cProd>${p.id.toUpperCase()}</cProd><xProd>${esc(p.nome.toUpperCase())}</xProd>`
      + `<CFOP>${it.cfop ?? '5655'}</CFOP><uCom>L</uCom><qCom>${it.litros.toFixed(4)}</qCom><vUnCom>${it.precoLitro.toFixed(4)}</vUnCom>`
      + `<vProd>${(it.litros * it.precoLitro).toFixed(2)}</vProd><comb><cProdANP>${p.anp}</cProdANP><descANP>${esc(p.nome.toUpperCase())}</descANP>`
      + `<UFCons>${d.destinatario.uf}</UFCons></comb></prod></det>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe xmlns="http://www.portalfiscal.inf.br/nfe">`
    + `<infNFe Id="NFe${chave}" versao="4.00">`
    + `<ide><cUF>${d.destinatario.municipio.slice(0, 2)}</cUF><natOp>VENDA DE COMBUSTIVEL</natOp><mod>55</mod><serie>1</serie>`
    + `<nNF>${d.numero}</nNF><dhEmi>${d.emitidaEm}</dhEmi><tpNF>1</tpNF></ide>`
    + `<emit><CNPJ>${d.emitente.cnpj}</CNPJ><xNome>${esc(d.emitente.nome)}</xNome><enderEmit><cMun>${d.emitente.municipio}</cMun><UF>${d.emitente.uf}</UF></enderEmit></emit>`
    + `<dest><CNPJ>${d.destinatario.cnpj}</CNPJ><xNome>${esc(d.destinatario.nome)}</xNome><enderDest><cMun>${d.destinatario.municipio}</cMun>`
    + `<xMun>${esc(d.destinatario.municipioNome)}</xMun><UF>${d.destinatario.uf}</UF></enderDest></dest>`
    + det + `<transp><modFrete>${d.modFrete ?? '0'}</modFrete></transp></infNFe></NFe></nfeProc>`;
}

/** Assina como a SEFAZ exige: referência ao infNFe, enveloped + C14N, RSA-SHA1, assinatura logo após o infNFe. */
export function assinarNfe(xml: string, chavePrivadaPem: string, certificadoPem: string): string {
  const sig = new SignedXml({
    privateKey: chavePrivadaPem,
    publicCert: certificadoPem,
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  });
  sig.addReference({
    xpath: "//*[local-name(.)='infNFe']",
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
  });
  sig.computeSignature(xml, { location: { reference: "//*[local-name(.)='infNFe']", action: 'after' } });
  return sig.getSignedXml();
}
