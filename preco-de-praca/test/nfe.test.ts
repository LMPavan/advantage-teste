import { describe, expect, it } from 'vitest';
import { gerarNfeXml } from '../src/nfe/exemplo.ts';
import { ErroLeitura, lerNfe } from '../src/nfe/parser.ts';
import { validarNfe, type ContextoValidacao } from '../src/nfe/validacao.ts';
import { CA_TESTE, CNPJ_POSTO, dadosNota, notaAssinada } from './apoio.ts';

const ctx = (extra: Partial<ContextoValidacao> = {}): ContextoValidacao => ({
  cnpjPosto: CNPJ_POSTO,
  municipioPosto: null,
  agora: new Date('2026-10-25T12:00:00-03:00'),
  municipioExiste: c => ['3509502', '3536505', '3550308'].includes(c),
  faixaProduto: () => ({ min: 2, max: 9.5 }),
  medianaReferencia: () => null,
  autoridades: [],
  ...extra,
});

describe('leitura do XML', () => {
  it('extrai emitente, destinatário, município IBGE e itens de combustível', () => {
    const n = lerNfe(notaAssinada());
    expect(n.emitente.cnpj).toBe('99000001000101');
    expect(n.destinatario).toMatchObject({ cnpj: CNPJ_POSTO, municipio: '3509502', uf: 'SP' });
    expect(n.itens.map(i => [i.produto, i.litros, i.precoLitro])).toEqual([['gc', 15000, 5.7612], ['et', 10000, 3.8125]]);
  });
  it('converte m³ para litro', () => {
    const xml = gerarNfeXml(dadosNota()).replace('<uCom>L</uCom><qCom>15000.0000</qCom><vUnCom>5.7612</vUnCom>', '<uCom>M3</uCom><qCom>15.0000</qCom><vUnCom>5761.2000</vUnCom>');
    const gc = lerNfe(xml).itens[0]!;
    expect(gc.litros).toBe(15000);
    expect(gc.precoLitro).toBeCloseTo(5.7612, 6);
  });
  it('recusa arquivo que não é XML ou tem duas notas', () => {
    expect(() => lerNfe('%PDF-1.4')).toThrow(ErroLeitura);
    const xml = notaAssinada();
    const duas = xml.replace('</nfeProc>', xml.slice(xml.indexOf('<NFe'), xml.indexOf('</nfeProc>')) + '</nfeProc>');
    expect(() => lerNfe(duas)).toThrow(/mais de uma NF-e/);
  });
});

describe('validação', () => {
  it('aceita nota assinada, do posto, dentro do prazo', () => {
    const r = validarNfe(notaAssinada(), ctx());
    expect(r.status).toBe('aceita');
    expect(r.semana).toBe('2026-10-19');
    expect(r.assinatura.status).toBe('valida');
    expect(r.itens).toHaveLength(2);
  });
  it('recusa nota com preço alterado depois de assinada', () => {
    const adulterada = notaAssinada().replace('<vUnCom>5.7612</vUnCom>', '<vUnCom>5.1612</vUnCom>');
    const r = validarNfe(adulterada, ctx());
    expect(r.status).toBe('recusada');
    expect(r.verificacoes.find(v => v.gravidade === 'recusa')?.texto).toMatch(/Assinatura não confere/);
  });
  it('lê os dados do trecho assinado, não de conteúdo acrescentado fora dele', () => {
    const xml = notaAssinada().replace('</nfeProc>', '<infAdic><vUnCom>1.0000</vUnCom></infAdic></nfeProc>');
    expect(validarNfe(xml, ctx()).itens[0]!.precoLitro).toBe(5.7612);
  });
  it('manda para revisão nota sem assinatura', () => {
    const r = validarNfe(gerarNfeXml(dadosNota()), ctx());
    expect(r.status).toBe('em_revisao');
    expect(r.assinatura.status).toBe('ausente');
  });
  it('recusa nota de outro destinatário', () => {
    const r = validarNfe(notaAssinada(), ctx({ cnpjPosto: '11222333000181' }));
    expect(r.status).toBe('recusada');
  });
  it('recusa nota depois do prazo da semana', () => {
    const r = validarNfe(notaAssinada(), ctx({ agora: new Date('2026-10-28T00:00:01-03:00') }));
    expect(r.status).toBe('recusada');
    expect(r.verificacoes.some(v => /prazo/.test(v.texto))).toBe(true);
  });
  it('aceita até terça 23h59 da semana seguinte', () => {
    expect(validarNfe(notaAssinada(), ctx({ agora: new Date('2026-10-27T23:59:00-03:00') })).status).toBe('aceita');
  });
  it('recusa nota de município diferente das notas anteriores do posto', () => {
    expect(validarNfe(notaAssinada(), ctx({ municipioPosto: '3550308' })).status).toBe('recusada');
  });
  it('manda para revisão preço muito longe da mediana da região', () => {
    const r = validarNfe(notaAssinada(), ctx({ medianaReferencia: p => (p === 'gc' ? 4.5 : null) }));
    expect(r.status).toBe('em_revisao');
    expect(r.itens.find(i => i.produto === 'gc')!.foraDaFaixa).toBe(true);
  });
  it('recusa preço fora da faixa possível', () => {
    const r = validarNfe(notaAssinada({ itens: [{ produto: 'gc', litros: 1000, precoLitro: 0.57 }] }), ctx());
    expect(r.status).toBe('recusada');
  });
  it('encadeia o certificado até a raiz configurada', () => {
    expect(validarNfe(notaAssinada(), ctx({ autoridades: [CA_TESTE] })).assinatura.cadeiaIcp).toBe(true);
  });
  it('manda para revisão CFOP que não é de revenda', () => {
    const r = validarNfe(notaAssinada({ itens: [{ produto: 's10', litros: 5000, precoLitro: 5.9, cfop: '5102' }] }), ctx());
    expect(r.status).toBe('em_revisao');
  });
});
