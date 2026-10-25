// Mínima e máxima não são calculadas: cada uma é o preço efetivo de um único participante.
export interface Resumo {
  postos: number;
  media: number;
  mediana: number;
  /** Preço mais frequente arredondado ao centavo; null quando nenhum valor se repete */
  moda: number | null;
  modaPostos: number | null;
}

const r4 = (v: number) => Math.round(v * 10000) / 10000;

export function resumir(valores: number[]): Resumo {
  if (valores.length === 0) throw new Error('resumir() precisa de pelo menos um valor');
  const a = [...valores].sort((x, y) => x - y);
  const n = a.length;
  const media = a.reduce((s, x) => s + x, 0) / n;
  const mediana = n % 2 ? a[(n - 1) / 2]! : (a[n / 2 - 1]! + a[n / 2]!) / 2;
  const contagem = new Map<number, number>();
  for (const x of a) {
    const centavos = Math.round(x * 100);
    contagem.set(centavos, (contagem.get(centavos) ?? 0) + 1);
  }
  let moda: number | null = null, modaPostos = 1;
  for (const [centavos, c] of contagem) {
    if (c > modaPostos || (c === modaPostos && moda !== null && centavos < moda)) { moda = centavos; modaPostos = c; }
  }
  return {
    postos: n, media: r4(media), mediana: r4(mediana),
    moda: moda === null ? null : moda / 100, modaPostos: moda === null ? null : modaPostos,
  };
}

/** Média ponderada por volume: cada posto entra uma vez por semana, mesmo com várias cargas. */
export function mediaPonderada(itens: { litros: number; precoLitro: number }[]): number {
  let litros = 0, total = 0;
  for (const i of itens) { litros += i.litros; total += i.litros * i.precoLitro; }
  return total / litros;
}
