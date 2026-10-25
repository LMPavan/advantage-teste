import { describe, expect, it } from 'vitest';
import { chaveValida, cnpjValido, completarCnpj, dvChave } from '../src/nfe/documentos.ts';

describe('chave de acesso', () => {
  it('calcula o dígito verificador em módulo 11', () => {
    // Exemplo do Manual de Orientação do Contribuinte da NF-e
    expect(dvChave('5206043300991100250655012000000780026730161')).toBe(5);
  });
  it('rejeita chave com dígito errado ou tamanho errado', () => {
    expect(chaveValida('52060433009911002506550120000007800267301615')).toBe(true);
    expect(chaveValida('52060433009911002506550120000007800267301616')).toBe(false);
    expect(chaveValida('123')).toBe(false);
  });
});

describe('CNPJ', () => {
  it('valida dígitos verificadores', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11.222.333/0001-80')).toBe(false);
    expect(cnpjValido('00000000000000')).toBe(false);
  });
  it('completa os dígitos de uma base', () => {
    expect(completarCnpj('112223330001')).toBe('11222333000181');
  });
});
