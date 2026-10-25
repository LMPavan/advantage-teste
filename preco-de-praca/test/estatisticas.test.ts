import { describe, expect, it } from 'vitest';
import { mediaPonderada, resumir } from '../src/estatistica/estatisticas.ts';

describe('resumir', () => {
  it('calcula média, mediana e moda, sem mínima nem máxima', () => {
    const r = resumir([5.701, 5.704, 5.80, 5.62, 5.7049]);
    expect(r).toMatchObject({ postos: 5, mediana: 5.704 });
    expect(r).not.toHaveProperty('minimo');
    expect(r).not.toHaveProperty('maximo');
    expect(r.media).toBeCloseTo(5.70598, 4);
    // 5,701 / 5,704 / 5,7049 caem todos em R$ 5,70
    expect(r.moda).toBe(5.7);
    expect(r.modaPostos).toBe(3);
  });
  it('mediana com quantidade par é a média dos dois centrais', () => {
    expect(resumir([1, 2, 3, 4]).mediana).toBe(2.5);
  });
  it('sem preço repetido não há moda', () => {
    const r = resumir([5.61, 5.72, 5.83, 5.94, 6.05]);
    expect(r.moda).toBeNull();
    expect(r.modaPostos).toBeNull();
  });
  it('empate na moda escolhe o menor preço', () => {
    expect(resumir([5.1, 5.1, 5.3, 5.3, 5.5]).moda).toBe(5.1);
  });
});

describe('mediaPonderada', () => {
  it('pondera pelo volume de cada carga', () => {
    expect(mediaPonderada([{ litros: 10000, precoLitro: 5.0 }, { litros: 5000, precoLitro: 5.3 }])).toBeCloseTo(5.1, 10);
  });
});
