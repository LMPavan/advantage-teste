import { X509Certificate } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Document, Element } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';

export interface ResultadoAssinatura {
  status: 'valida' | 'invalida' | 'ausente';
  /** CNPJ do titular do certificado (e-CNPJ), quando encontrado no CN */
  cnpjCertificado: string | null;
  /** O certificado foi encadeado até uma raiz da ICP-Brasil configurada */
  cadeiaIcp: boolean;
  certificadoValidoNaEmissao: boolean;
  motivo?: string;
  /** infNFe exatamente como foi assinado; os dados devem ser lidos daqui, não do documento original */
  conteudoAssinado?: string;
}

const NS_DSIG = 'http://www.w3.org/2000/09/xmldsig#';

function paraPem(base64: string): string {
  const limpo = base64.replace(/\s+/g, '');
  return `-----BEGIN CERTIFICATE-----\n${limpo.match(/.{1,64}/g)!.join('\n')}\n-----END CERTIFICATE-----\n`;
}

export function verificarAssinatura(xml: string, doc: Document, chave: string, emitidaEm: Date, autoridades: X509Certificate[]): ResultadoAssinatura {
  const base = { cnpjCertificado: null, cadeiaIcp: false, certificadoValidoNaEmissao: false };
  const assinaturas = Array.from(doc.getElementsByTagNameNS(NS_DSIG, 'Signature')) as Element[];
  const assinatura = assinaturas.find(s => {
    const ref = s.getElementsByTagNameNS(NS_DSIG, 'Reference')[0];
    return ref?.getAttribute('URI') === '#NFe' + chave;
  });
  if (!assinatura) return { ...base, status: 'ausente', motivo: 'A nota não tem assinatura digital da distribuidora.' };

  const certTexto = assinatura.getElementsByTagNameNS(NS_DSIG, 'X509Certificate')[0]?.textContent;
  if (!certTexto) return { ...base, status: 'invalida', motivo: 'A assinatura não traz o certificado digital do emitente.' };

  let cert: X509Certificate;
  try {
    cert = new X509Certificate(paraPem(certTexto));
  } catch {
    return { ...base, status: 'invalida', motivo: 'Certificado digital ilegível.' };
  }
  const cnpjCertificado = /CN=[^\n]*:(\d{14})/.exec(cert.subject)?.[1] ?? null;
  const certificadoValidoNaEmissao = emitidaEm >= new Date(cert.validFrom) && emitidaEm <= new Date(cert.validTo);

  const sig = new SignedXml({ publicCert: cert.toString(), getCertFromKeyInfo: () => null });
  let ok = false;
  try {
    sig.loadSignature(assinatura as unknown as Node);
    ok = sig.checkSignature(xml);
  } catch (e) {
    return { ...base, cnpjCertificado, certificadoValidoNaEmissao, status: 'invalida', motivo: 'Assinatura não confere: ' + (e instanceof Error ? e.message : String(e)) };
  }
  if (!ok) return { ...base, cnpjCertificado, certificadoValidoNaEmissao, status: 'invalida', motivo: 'Assinatura não confere: o conteúdo da nota foi alterado depois de assinado.' };

  return {
    status: 'valida',
    cnpjCertificado,
    certificadoValidoNaEmissao,
    cadeiaIcp: encadeiaAteRaiz(cert, autoridades),
    conteudoAssinado: sig.getSignedReferences()[0],
  };
}

export function encadeiaAteRaiz(cert: X509Certificate, autoridades: X509Certificate[]): boolean {
  let atual = cert;
  for (let profundidade = 0; profundidade < 8; profundidade++) {
    const emissor = autoridades.find(ca => ca.subject === atual.issuer && atual.verify(ca.publicKey));
    if (!emissor) return false;
    if (emissor.subject === emissor.issuer) return emissor.verify(emissor.publicKey);
    atual = emissor;
  }
  return false;
}

/** Lê os certificados da ICP-Brasil (PEM ou DER) de uma pasta. */
export function carregarAutoridades(dir: string): X509Certificate[] {
  if (!dir) return [];
  const certs: X509Certificate[] = [];
  for (const arquivo of readdirSync(dir)) {
    if (!/\.(crt|cer|pem)$/i.test(arquivo)) continue;
    const bruto = readFileSync(join(dir, arquivo));
    const texto = bruto.toString('latin1');
    const blocos = texto.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
    try {
      if (blocos) blocos.forEach(b => certs.push(new X509Certificate(b)));
      else certs.push(new X509Certificate(bruto));
    } catch {
      // arquivo que não é certificado: ignorado
    }
  }
  return certs;
}
