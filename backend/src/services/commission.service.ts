import { CommissionType, GoalDirection, Item, PayoutMode } from "@prisma/client";
import { prisma } from "../prisma";

export interface EntryAggregate {
  simpleTotal: number;
  comumLitersTotal: number;
  aditivadaLitersTotal: number;
}

export interface GoalProgress {
  actualValue: number;
  targetValue: number;
  achievementPercent: number; // pode passar de 100
  commissionAmount: number;
}

/** Soma os lançamentos (Entry) de uma meta dentro do intervalo informado. */
export function aggregateEntries(
  entries: { value: any; comumLiters: any; aditivadaLiters: any }[]
): EntryAggregate {
  return entries.reduce(
    (acc, e) => {
      acc.simpleTotal += e.value ? Number(e.value) : 0;
      acc.comumLitersTotal += e.comumLiters ? Number(e.comumLiters) : 0;
      acc.aditivadaLitersTotal += e.aditivadaLiters ? Number(e.aditivadaLiters) : 0;
      return acc;
    },
    { simpleTotal: 0, comumLitersTotal: 0, aditivadaLitersTotal: 0 }
  );
}

/**
 * Valor realizado do item a partir dos lançamentos agregados.
 * - SIMPLE: soma direta dos valores lançados (litros, unidades ou R$).
 * - MIX_RATIO: (comum + aditivada) / aditivada.
 */
export function computeActualValue(item: Pick<Item, "calculationType">, agg: EntryAggregate): number {
  if (item.calculationType === "MIX_RATIO") {
    if (agg.aditivadaLitersTotal <= 0) return 0;
    return (agg.comumLitersTotal + agg.aditivadaLitersTotal) / agg.aditivadaLitersTotal;
  }
  return agg.simpleTotal;
}

/**
 * Percentual de atingimento da meta.
 * Para itens "HIGHER_IS_BETTER" (padrão): atual / meta.
 * Para itens "LOWER_IS_BETTER" (ex.: mix, quanto menor melhor): meta / atual.
 */
export function computeAchievementPercent(
  actualValue: number,
  targetValue: number,
  direction: GoalDirection
): number {
  if (targetValue <= 0) return 0;
  if (direction === "LOWER_IS_BETTER") {
    if (actualValue <= 0) return 0;
    return (targetValue / actualValue) * 100;
  }
  return (actualValue / targetValue) * 100;
}

/**
 * Comissão gerada com base no tipo de comissionamento configurado pelo admin no item,
 * no valor realizado e no percentual de atingimento (payout threshold ou proporcional).
 */
export function computeCommission(
  item: Pick<Item, "commissionType" | "commissionValue" | "payoutMode" | "achievementThresholdPercent">,
  agg: EntryAggregate,
  actualValue: number,
  achievementPercent: number
): number {
  const rate = Number(item.commissionValue);
  const threshold = Number(item.achievementThresholdPercent);

  let baseCommission = 0;
  switch (item.commissionType) {
    case CommissionType.CENTS_PER_LITER: {
      // litros de referência: para mix, os litros de aditivada vendidos; caso contrário, o próprio valor.
      const liters = agg.aditivadaLitersTotal > 0 ? agg.aditivadaLitersTotal : actualValue;
      baseCommission = liters * (rate / 100);
      break;
    }
    case CommissionType.CURRENCY_PER_LITER:
      baseCommission = actualValue * rate;
      break;
    case CommissionType.CURRENCY_PER_UNIT:
      baseCommission = actualValue * rate;
      break;
    case CommissionType.PERCENTAGE_OF_VALUE:
      baseCommission = actualValue * (rate / 100);
      break;
    case CommissionType.FIXED_PER_PERIOD:
      baseCommission = achievementPercent >= threshold ? rate : 0;
      return round2(baseCommission);
    default:
      baseCommission = 0;
  }

  if (item.payoutMode === PayoutMode.THRESHOLD) {
    return round2(achievementPercent >= threshold ? baseCommission : 0);
  }

  // PROPORTIONAL: paga proporcional ao atingimento, limitado a 100%.
  const factor = Math.min(achievementPercent, 100) / 100;
  return round2(baseCommission * factor);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Calcula o progresso completo de uma meta (usa os lançamentos já filtrados pelo período desejado). */
export async function computeGoalProgress(goalId: string): Promise<GoalProgress> {
  const goal = await prisma.goal.findUniqueOrThrow({
    where: { id: goalId },
    include: { item: true, entries: true },
  });

  const agg = aggregateEntries(goal.entries);
  const actualValue = computeActualValue(goal.item, agg);
  const achievementPercent = computeAchievementPercent(
    actualValue,
    Number(goal.targetValue),
    goal.item.direction
  );
  const commissionAmount = computeCommission(goal.item, agg, actualValue, achievementPercent);

  return {
    actualValue: round2(actualValue),
    targetValue: Number(goal.targetValue),
    achievementPercent: round2(achievementPercent),
    commissionAmount,
  };
}
