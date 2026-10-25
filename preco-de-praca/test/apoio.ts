import { readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { assinarNfe, gerarNfeXml, type DadosExemplo } from '../src/nfe/exemplo.ts';

const dir = new URL('../data/demo/', import.meta.url);
export const CHAVE_TESTE = readFileSync(new URL('distribuidora-teste.key', dir), 'utf8');
export const CERT_TESTE = readFileSync(new URL('distribuidora-teste.crt', dir), 'utf8');
export const CA_TESTE = new X509Certificate(readFileSync(new URL('ca-teste.crt', dir)));

export const CNPJ_DISTRIBUIDORA = '99000001000101';
export const CNPJ_POSTO = '44555666000181';

export function dadosNota(extra: Partial<DadosExemplo> = {}): DadosExemplo {
  return {
    numero: 184552,
    emitidaEm: '2026-10-20T09:14:00-03:00',
    emitente: { cnpj: CNPJ_DISTRIBUIDORA, nome: 'DISTRIBUIDORA DEMONSTRACAO LTDA', municipio: '3536505', uf: 'SP' },
    destinatario: { cnpj: CNPJ_POSTO, nome: 'POSTO EXEMPLO LTDA', municipio: '3509502', municipioNome: 'CAMPINAS', uf: 'SP' },
    itens: [
      { produto: 'gc', litros: 15000, precoLitro: 5.7612 },
      { produto: 'et', litros: 10000, precoLitro: 3.8125 },
    ],
    ...extra,
  };
}

export function notaAssinada(extra: Partial<DadosExemplo> = {}): string {
  return assinarNfe(gerarNfeXml(dadosNota(extra)), CHAVE_TESTE, CERT_TESTE);
}
