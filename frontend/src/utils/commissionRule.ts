import type { Item } from "../types";

function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Frase com a taxa de comissão do item, em linguagem simples (ex.: "R$1,50 por litro vendido"). */
export function describeCommissionRate(item: Item): string {
  const rate = Number(item.commissionValue);
  switch (item.commissionType) {
    case "CENTS_PER_LITER":
      return `${formatBRL(rate / 100)} por litro vendido`;
    case "CURRENCY_PER_LITER":
      return `${formatBRL(rate)} por litro vendido`;
    case "CURRENCY_PER_UNIT":
      return `${formatBRL(rate)} por unidade vendida`;
    case "PERCENTAGE_OF_VALUE":
      return `${rate}% sobre o valor vendido`;
    case "FIXED_PER_PERIOD":
      return `${formatBRL(rate)} fixo ao bater a meta no período`;
    default:
      return "";
  }
}

/** Frase com a condição de pagamento (vinculado ou não à meta, threshold ou proporcional). */
export function describeCommissionCondition(item: Item): string {
  if (!item.linkedToGoal) {
    return "Pago integralmente por unidade vendida, mesmo sem bater a meta.";
  }
  if (item.payoutMode === "THRESHOLD") {
    return `Só é pago (valor cheio) se você atingir ao menos ${item.achievementThresholdPercent}% da meta.`;
  }
  return "Pago proporcionalmente ao seu atingimento da meta (limitado a 100%).";
}

/** Explicação completa da regra de comissão de um item, para exibir ao frentista. */
export function describeCommissionRule(item: Item): string {
  return `${describeCommissionRate(item)}. ${describeCommissionCondition(item)}`;
}
