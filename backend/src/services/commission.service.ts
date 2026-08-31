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
 * - MIX_RATIO: % de penetração da aditivada = aditivada / (comum + aditivada) * 100.
 *   Quanto maior, melhor (mais aditivada em relação ao total vendido).
 */
export function computeActualValue(item: Pick<Item, "calculationType">, agg: EntryAggregate): number {
  if (item.calculationType === "MIX_RATIO") {
    const total = agg.comumLitersTotal + agg.aditivadaLitersTotal;
    if (total <= 0) return 0;
    return (agg.aditivadaLitersTotal / total) * 100;
  }
  return agg.simpleTotal;
}

/**
 * Percentual de atingimento da meta.
 * Para itens "HIGHER_IS_BETTER" (padrão, inclui mix): atual / meta.
 * Para itens "LOWER_IS_BETTER": meta / atual.
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
 * Comissão gerada com base no tipo de comissionamento configurado pelo admin no item, no valor
 * realizado e no percentual de atingimento (payout threshold ou proporcional) — só quando o item
 * está vinculado à meta (linkedToGoal). Quando não está, a comissão é paga integralmente por
 * unidade vendida, sem nenhuma condição de bater a meta (ex.: 3 centavos por litro de aditivada,
 * pago sempre) — payoutMode/achievementThresholdPercent são ignorados nesse caso.
 */
export function computeCommission(
  item: Pick<Item, "commissionType" | "commissionValue" | "payoutMode" | "achievementThresholdPercent" | "linkedToGoal">,
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
      if (!item.linkedToGoal) return round2(rate); // pago sempre, sem condição de meta
      return round2(achievementPercent >= threshold ? rate : 0);
    default:
      baseCommission = 0;
  }

  if (!item.linkedToGoal) {
    return round2(baseCommission);
  }

  if (item.payoutMode === PayoutMode.THRESHOLD) {
    return round2(achievementPercent >= threshold ? baseCommission : 0);
  }

  // PROPORTIONAL: paga proporcional ao atingimento, limitado a 100%.
  const factor = Math.min(achievementPercent, 100) / 100;
  return round2(baseCommission * factor);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Estimativa de comissão de um único lançamento (dia), aplicando apenas a taxa por unidade do item —
 * SEM considerar o percentual mínimo (threshold) nem o teto do modo proporcional, já que esses dois só
 * fazem sentido sobre o total do período fechado. Serve como indicador de ritmo diário ("quanto esse
 * dia valeria, mantido o ritmo"), não como o valor definitivo já garantido — a comissão real só é
 * conhecida ao final do período, no card da meta.
 */
export function computeDailyCommissionEstimate(
  item: Pick<Item, "calculationType" | "commissionType" | "commissionValue">,
  entry: { value: any; comumLiters: any; aditivadaLiters: any }
): number {
  const rate = Number(item.commissionValue);
  const value = entry.value ? Number(entry.value) : 0;
  const aditivadaLiters = entry.aditivadaLiters ? Number(entry.aditivadaLiters) : 0;

  switch (item.commissionType) {
    case CommissionType.CENTS_PER_LITER: {
      const liters = item.calculationType === "MIX_RATIO" ? aditivadaLiters : value;
      return round2(liters * (rate / 100));
    }
    case CommissionType.CURRENCY_PER_LITER:
    case CommissionType.CURRENCY_PER_UNIT:
      return round2(value * rate);
    case CommissionType.PERCENTAGE_OF_VALUE:
      return round2(value * (rate / 100));
    case CommissionType.FIXED_PER_PERIOD:
    default:
      return 0; // não decompõe por dia: só existe ao fechar o período.
  }
}

export interface TodayProgress {
  actualValue: number;
  estimatedCommission: number;
}

/**
 * Progresso do dia: agrega só os lançamentos da meta feitos numa data específica (padrão: hoje), para
 * o frentista acompanhar o ritmo diário lado a lado com o acumulado do período (goal.progress).
 */
export function computeTodayProgress(
  item: Pick<Item, "calculationType" | "commissionType" | "commissionValue">,
  entries: { date: Date; value: any; comumLiters: any; aditivadaLiters: any }[],
  dateIso: string
): TodayProgress {
  const todaysEntries = entries.filter((e) => e.date.toISOString().slice(0, 10) === dateIso);
  const agg = aggregateEntries(todaysEntries);
  return {
    actualValue: round2(computeActualValue(item, agg)),
    estimatedCommission: computeDailyCommissionEstimate(item, {
      value: agg.simpleTotal,
      comumLiters: agg.comumLitersTotal,
      aditivadaLiters: agg.aditivadaLitersTotal,
    }),
  };
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
