import { Item } from "@prisma/client";
import { prisma } from "../prisma";
import { aggregateEntries, computeAchievementPercent, computeActualValue, computeCommission, round2 } from "./commission.service";
import { currentRange } from "./ranking.service";

export interface MixSimulatorInput {
  newCommissionValue: number;
  marginPerLiter: number;
}

export interface MixSimulatorResult {
  currentCommissionValue: number;
  currentMixPercent: number;
  currentMonthlyCost: number;
  newCommissionValue: number;
  marginPerLiter: number;
  extraCostAtSameMix: number;
  requiredMixGrowthPoints: number | null;
  requiredMixPercent: number | null;
  breakEvenReached: boolean;
  totalLiters: number;
}

interface GoalAgg {
  targetValue: number;
  comumLitersTotal: number;
  aditivadaLitersTotal: number;
}

async function loadCurrentGoalAggregates(networkId: string, itemId: string): Promise<GoalAgg[]> {
  const now = currentRange();
  const goals = await prisma.goal.findMany({
    where: {
      itemId,
      station: { networkId },
      startDate: { lte: now.end },
      endDate: { gte: now.start },
    },
    include: { entries: true },
  });
  return goals.map((g) => {
    const agg = aggregateEntries(g.entries);
    return {
      targetValue: Number(g.targetValue),
      comumLitersTotal: agg.comumLitersTotal,
      aditivadaLitersTotal: agg.aditivadaLitersTotal,
    };
  });
}

/**
 * Comissão total da rede pra este item MIX_RATIO, com uma taxa hipotética e um crescimento de mix
 * (em pontos percentuais) aplicado a cada meta — desloca litros de "comum" pra "aditivada" mantendo o
 * volume total de cada meta fixo, e recalcula a comissão de cada uma com a fórmula real do item.
 */
function totalCommissionAtGrowth(item: Item, commissionValue: number, goals: GoalAgg[], growthPoints: number): number {
  const modifiedItem: Item = { ...item, commissionValue: commissionValue as unknown as Item["commissionValue"] };
  let total = 0;
  for (const g of goals) {
    const totalLiters = g.comumLitersTotal + g.aditivadaLitersTotal;
    const extraLiters = (growthPoints / 100) * totalLiters;
    const agg = {
      simpleTotal: 0,
      comumLitersTotal: Math.max(0, g.comumLitersTotal - extraLiters),
      aditivadaLitersTotal: g.aditivadaLitersTotal + extraLiters,
    };
    const actualValue = computeActualValue(modifiedItem, agg);
    const achievementPercent = computeAchievementPercent(actualValue, g.targetValue, modifiedItem.direction);
    total += computeCommission(modifiedItem, agg, actualValue, achievementPercent);
  }
  return round2(total);
}

/**
 * Simula o custo de mudar a comissão de um item MIX_RATIO (ex.: Mix Aditivada) e quanto o mix médio
 * da rede precisaria crescer pra que a margem extra informada (lucro a mais por litro de aditivada
 * vendido, vs. comum) cubra esse custo extra — mantendo o volume total vendido de cada meta fixo.
 */
export async function simulateMixCommissionChange(
  networkId: string,
  itemId: string,
  input: MixSimulatorInput
): Promise<MixSimulatorResult> {
  const item = await prisma.item.findUniqueOrThrow({ where: { id: itemId } });
  if (item.networkId !== networkId || item.calculationType !== "MIX_RATIO") {
    throw new Error("Item inválido para o simulador de mix.");
  }

  const goals = await loadCurrentGoalAggregates(networkId, itemId);
  const totalComum = goals.reduce((s, g) => s + g.comumLitersTotal, 0);
  const totalAditivada = goals.reduce((s, g) => s + g.aditivadaLitersTotal, 0);
  const totalLiters = totalComum + totalAditivada;
  const currentMixPercent = totalLiters > 0 ? round2((totalAditivada / totalLiters) * 100) : 0;

  const currentCommissionValue = Number(item.commissionValue);
  const currentMonthlyCost = totalCommissionAtGrowth(item, currentCommissionValue, goals, 0);
  const newCostAtSameMix = totalCommissionAtGrowth(item, input.newCommissionValue, goals, 0);
  const extraCostAtSameMix = round2(newCostAtSameMix - currentMonthlyCost);

  const base: Omit<MixSimulatorResult, "requiredMixGrowthPoints" | "requiredMixPercent" | "breakEvenReached"> = {
    currentCommissionValue,
    currentMixPercent,
    currentMonthlyCost,
    newCommissionValue: input.newCommissionValue,
    marginPerLiter: input.marginPerLiter,
    extraCostAtSameMix,
    totalLiters: round2(totalLiters),
  };

  // Sem custo extra (taxa igual ou menor): já "compensa" sem precisar crescer nada.
  if (extraCostAtSameMix <= 0) {
    return { ...base, requiredMixGrowthPoints: 0, requiredMixPercent: currentMixPercent, breakEvenReached: true };
  }

  const maxGrowth = round2(Math.max(0, 100 - currentMixPercent));
  function netGain(growthPoints: number): number {
    const newCost = totalCommissionAtGrowth(item, input.newCommissionValue, goals, growthPoints);
    const extraCost = newCost - currentMonthlyCost;
    const extraMargin = input.marginPerLiter * (growthPoints / 100) * totalLiters;
    return extraMargin - extraCost;
  }

  if (maxGrowth <= 0 || netGain(maxGrowth) < 0) {
    // Mesmo levando o mix a 100%, a margem extra informada não cobre o custo do aumento de comissão.
    return { ...base, requiredMixGrowthPoints: null, requiredMixPercent: null, breakEvenReached: false };
  }

  // Busca binária: netGain(0) é negativo (custo sem crescimento nenhum) e netGain(maxGrowth) é
  // positivo (já confirmado acima) — encontra o ponto de equilíbrio entre os dois.
  let low = 0;
  let high = maxGrowth;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (netGain(mid) < 0) low = mid;
    else high = mid;
  }
  const requiredMixGrowthPoints = round2(high);

  return {
    ...base,
    requiredMixGrowthPoints,
    requiredMixPercent: round2(currentMixPercent + requiredMixGrowthPoints),
    breakEvenReached: true,
  };
}
