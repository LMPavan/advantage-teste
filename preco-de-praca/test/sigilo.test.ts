import { describe, expect, it } from 'vitest';
import { calcularCelulas, NIVEIS, type Celula, type Contribuicao } from '../src/estatistica/sigilo.ts';

const K = 5;
let proximo = 1;
function postos(n: number, onde: { micro: string; meso?: string; uf?: string }, dist = 1, preco = 5.7): Contribuicao[] {
  return Array.from({ length: n }, (_, i) => ({
    participanteId: proximo++, produto: 'gc' as const, distribuidoraId: dist, litros: 10000, precoLitro: preco + i / 100,
    regiao: 'SE', uf: onde.uf ?? 'SP', meso: onde.meso ?? '3507', micro: onde.micro,
  }));
}
const achar = (cs: Celula[], nivel: string, area: string, dist = 0) => cs.find(c => c.nivel === nivel && c.area === area && c.distribuidoraId === dist)!;

/**
 * Atacante aleatório: para cada célula aberta, monta muitas famílias de células abertas disjuntas dentro dela
 * e verifica se o que sobra tem entre 1 e K-1 postos (o que permitiria calcular o preço desse grupo pequeno).
 */
function semVazamento(cs: Celula[], tentativas = 150): boolean {
  let seed = 99;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const dentro = (q: Celula, p: Celula) => {
    if (q === p || !q.aberta) return false;
    if (p.distribuidoraId !== 0 && q.distribuidoraId !== p.distribuidoraId) return false;
    if (NIVEIS.indexOf(q.nivel) < NIVEIS.indexOf(p.nivel)) return false;
    return [...q.valores.keys()].every(id => p.valores.has(id));
  };
  for (const p of cs.filter(c => c.aberta)) {
    const candidatas = cs.filter(q => dentro(q, p));
    for (let t = 0; t < tentativas; t++) {
      const ordem = [...candidatas].sort(() => rnd() - 0.5);
      const usados = new Set<number>();
      for (const q of ordem) {
        const ids = [...q.valores.keys()];
        if (ids.some(id => usados.has(id))) continue;
        ids.forEach(id => usados.add(id));
        const sobra = p.valores.size - usados.size;
        if (sobra > 0 && sobra < K) return false;
      }
    }
  }
  return true;
}

describe('regra do mínimo de postos', () => {
  it('abre com 5 postos e fecha com 4', () => {
    expect(achar(calcularCelulas(postos(5, { micro: '35032' }), K), 'micro', '35032').aberta).toBe(true);
    expect(achar(calcularCelulas(postos(4, { micro: '35032' }), K), 'micro', '35032')).toMatchObject({ aberta: false, motivo: 'poucos_postos', resumo: null });
  });
  it('conta empresas, não postos: uma rede com 5 postos não abre a área sozinha', () => {
    const rede = postos(5, { micro: '35032' }).map(c => ({ ...c, participanteId: 999 }));
    expect(achar(calcularCelulas(rede, K), 'micro', '35032').aberta).toBe(false);
  });
  it('não existe célula de município', () => {
    const cs = calcularCelulas(postos(6, { micro: '35032' }), K);
    expect(new Set(cs.map(c => c.nivel))).toEqual(new Set(['brasil', 'regiao', 'uf', 'meso', 'micro']));
  });
  it('conta postos, não notas: várias cargas do mesmo posto viram uma média ponderada', () => {
    const base = postos(1, { micro: '35032' })[0]!;
    const cs = calcularCelulas([
      { ...base, litros: 10000, precoLitro: 5.0 }, { ...base, litros: 5000, precoLitro: 5.3 },
      ...postos(4, { micro: '35032' }),
    ], K);
    const c = achar(cs, 'micro', '35032');
    expect(c.valores.size).toBe(5);
    expect(c.valores.get(base.participanteId)).toBeCloseTo(5.1, 10);
  });
});

describe('proteção contra subtração', () => {
  it('fecha a microrregião aberta quando a mesorregião menos ela revelaria 2 postos', () => {
    const cs = calcularCelulas([...postos(6, { micro: '35032' }), ...postos(2, { micro: '35031' })], K);
    expect(achar(cs, 'meso', '3507').aberta).toBe(true);
    expect(achar(cs, 'micro', '35032')).toMatchObject({ aberta: false, motivo: 'protecao_subtracao' });
    expect(semVazamento(cs)).toBe(true);
  });
  it('deixa abrir quando o resto tem 5 ou mais postos', () => {
    const cs = calcularCelulas([...postos(6, { micro: '35032' }), ...postos(5, { micro: '35031' })], K);
    expect(achar(cs, 'micro', '35032').aberta).toBe(true);
    expect(achar(cs, 'micro', '35031').aberta).toBe(true);
  });
  it('protege a distribuidora pequena: estado inteiro menos a grande revelaria 1 posto', () => {
    const cs = calcularCelulas([...postos(6, { micro: '35032' }, 1), ...postos(1, { micro: '35032' }, 2)], K);
    expect(achar(cs, 'uf', 'SP').aberta).toBe(true);
    expect(achar(cs, 'uf', 'SP', 1).aberta).toBe(false);
    expect(semVazamento(cs)).toBe(true);
  });
  it('comparativo de distribuidoras só existe de UF para cima', () => {
    const cs = calcularCelulas(postos(8, { micro: '35032' }, 1), K);
    expect(cs.filter(c => c.distribuidoraId !== 0).map(c => c.nivel).sort()).toEqual(['brasil', 'regiao', 'uf']);
  });
  it('bloqueia a combinação estado menos distribuidora menos mesorregião', () => {
    // 20 postos da distribuidora 1 na meso A; 6 postos da 2 na meso B; meso C com 3 postos da 2 e 5 da 1
    const cs = calcularCelulas([
      ...postos(20, { meso: '3501', micro: '35011' }, 1),
      ...postos(6, { meso: '3502', micro: '35021' }, 2),
      ...postos(3, { meso: '3503', micro: '35031' }, 2), ...postos(5, { meso: '3503', micro: '35031' }, 1),
    ], K);
    expect(semVazamento(cs, 400)).toBe(true);
  });
  it('mantém a garantia em cenários aleatórios', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    for (let rodada = 0; rodada < 60; rodada++) {
      const cs: Contribuicao[] = [];
      for (const uf of ['SP', 'MG']) for (const meso of ['01', '02', '03']) for (const micro of ['1', '2', '3']) {
        const n = Math.floor(rnd() * 9);
        for (let i = 0; i < n; i++) cs.push(...postos(1, { uf, meso: uf + meso, micro: uf + meso + micro }, 1 + Math.floor(rnd() * 3), 5.5 + rnd() * 0.4));
      }
      expect(semVazamento(calcularCelulas(cs, K))).toBe(true);
    }
  });
});
