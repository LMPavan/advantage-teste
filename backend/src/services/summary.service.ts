import { Prisma, Redemption, RedemptionStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { computeGoalProgress, round2 } from "./commission.service";
import { currentRange, type DateRange } from "./ranking.service";

export interface ItemBreakdownRow {
  itemId: string;
  itemName: string;
  unit: string;
  totalCommission: number;
  avgAchievement: number;
  goalsCount: number;
}

/**
 * Quanto cada item de meta contribuiu em comissão/atingimento, para um conjunto de metas (posto ou
 * rede inteira), restrito a um intervalo de datas (padrão: metas ativas agora).
 */
export async function getItemBreakdown(
  where: Prisma.GoalWhereInput,
  range: DateRange = currentRange()
): Promise<ItemBreakdownRow[]> {
  const goals = await prisma.goal.findMany({
    where: { ...where, startDate: { lte: range.end }, endDate: { gte: range.start } },
    include: { item: true },
  });

  const map = new Map<string, { itemName: string; unit: string; commissionSum: number; achievementSum: number; count: number }>();
  for (const goal of goals) {
    const progress = await computeGoalProgress(goal.id);
    const current = map.get(goal.itemId) ?? { itemName: goal.item.name, unit: goal.item.unit, commissionSum: 0, achievementSum: 0, count: 0 };
    current.commissionSum += progress.commissionAmount;
    current.achievementSum += progress.achievementPercent;
    current.count += 1;
    map.set(goal.itemId, current);
  }

  return Array.from(map.entries())
    .map(([itemId, v]) => ({
      itemId,
      itemName: v.itemName,
      unit: v.unit,
      totalCommission: round2(v.commissionSum),
      avgAchievement: round2(v.achievementSum / v.count),
      goalsCount: v.count,
    }))
    .sort((a, b) => b.totalCommission - a.totalCommission);
}

export interface RedemptionStatusSummary {
  count: number;
  amount: number;
}

export type RedemptionSummary = Record<RedemptionStatus, RedemptionStatusSummary>;

/** Agrupa resgates por status (contagem + soma), usado nos paineis de dono/gerente. */
export function summarizeRedemptions(rows: Pick<Redemption, "status" | "commissionAmount">[]): RedemptionSummary {
  const summary: RedemptionSummary = {
    PENDING: { count: 0, amount: 0 },
    APPROVED: { count: 0, amount: 0 },
    REJECTED: { count: 0, amount: 0 },
    PAID: { count: 0, amount: 0 },
  };
  for (const row of rows) {
    summary[row.status].count += 1;
    summary[row.status].amount = round2(summary[row.status].amount + Number(row.commissionAmount));
  }
  return summary;
}

export function weightedAverage(rows: { avgAchievement: number; goalsCount: number }[]): number {
  const totalGoals = rows.reduce((sum, r) => sum + r.goalsCount, 0);
  if (totalGoals === 0) return 0;
  return round2(rows.reduce((sum, r) => sum + r.avgAchievement * r.goalsCount, 0) / totalGoals);
}
