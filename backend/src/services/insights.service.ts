import { prisma } from "../prisma";
import { computeGoalProgress, computeProjection, round2 } from "./commission.service";
import { currentRange, getStationRanking, monthRangeFromParam } from "./ranking.service";

const PACE_ALERT_THRESHOLD = 80;

export interface PaceAlert {
  stationId: string;
  stationName: string;
  attendantId: string;
  attendantName: string;
  itemName: string;
  achievementPercent: number;
  projectedAchievementPercent: number;
  message: string;
}

/**
 * Postos/frentistas cujo RITMO atual (projeção linear até o fim do período) está abaixo do limiar —
 * ou seja, mesmo que ainda dê tempo, no ritmo de hoje eles fechariam o mês abaixo da meta.
 */
export async function getPaceAlerts(stationIds: string[]): Promise<PaceAlert[]> {
  const now = currentRange();
  const goals = await prisma.goal.findMany({
    where: {
      stationId: { in: stationIds },
      attendantId: { not: null },
      startDate: { lte: now.end },
      endDate: { gte: now.start },
    },
    include: { item: true, attendant: { select: { id: true, name: true } }, station: { select: { id: true, name: true } } },
  });

  const alerts: PaceAlert[] = [];
  for (const goal of goals) {
    if (!goal.attendant) continue;
    const progress = await computeGoalProgress(goal.id);
    const projection = computeProjection(progress, goal.startDate, goal.endDate);
    if (!projection || projection.projectedAchievementPercent >= PACE_ALERT_THRESHOLD) continue;
    if (projection.daysElapsed < 2) continue; // muito cedo no período pra alertar
    alerts.push({
      stationId: goal.station.id,
      stationName: goal.station.name,
      attendantId: goal.attendant.id,
      attendantName: goal.attendant.name,
      itemName: goal.item.name,
      achievementPercent: progress.achievementPercent,
      projectedAchievementPercent: projection.projectedAchievementPercent,
      message: `${goal.attendant.name} está no ritmo de fechar ${goal.item.name} em ${projection.projectedAchievementPercent}% da meta no ${goal.station.name}.`,
    });
  }

  alerts.sort((a, b) => a.projectedAchievementPercent - b.projectedAchievementPercent);
  return alerts;
}

export interface MonthlyHistoryPoint {
  month: string;
  totalCommission: number;
  avgAchievement: number;
}

/** Série histórica dos últimos N meses (incluindo o atual) da rede: comissão total e atingimento médio. */
export async function getNetworkMonthlyHistory(networkId: string, months: number): Promise<MonthlyHistoryPoint[]> {
  const points: MonthlyHistoryPoint[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
    const range = monthRangeFromParam(monthLabel);
    const rows = await getStationRanking(networkId, range);
    const totalCommission = round2(rows.reduce((sum, r) => sum + r.totalCommission, 0));
    const withGoals = rows.filter((r) => r.attendantsCount > 0);
    const avgAchievement = withGoals.length
      ? round2(withGoals.reduce((sum, r) => sum + r.avgAchievement, 0) / withGoals.length)
      : 0;
    points.push({ month: monthLabel, totalCommission, avgAchievement });
  }
  return points;
}

export interface BenchmarkResult {
  networksCompared: number;
  yourAvgAchievement: number;
  marketAvgAchievement: number;
  yourAvgCommissionPerStation: number;
  marketAvgCommissionPerStation: number;
}

/** Comparativo anônimo com a média de outras redes na plataforma (sem expor nomes/dados de terceiros). */
export async function getBenchmark(networkId: string): Promise<BenchmarkResult> {
  const range = currentRange();
  const [yourRows, otherNetworks] = await Promise.all([
    getStationRanking(networkId, range),
    prisma.network.findMany({ where: { id: { not: networkId } }, select: { id: true } }),
  ]);

  const yourWithGoals = yourRows.filter((r) => r.attendantsCount > 0);
  const yourAvgAchievement = yourWithGoals.length
    ? round2(yourWithGoals.reduce((sum, r) => sum + r.avgAchievement, 0) / yourWithGoals.length)
    : 0;
  const yourAvgCommissionPerStation = yourRows.length
    ? round2(yourRows.reduce((sum, r) => sum + r.totalCommission, 0) / yourRows.length)
    : 0;

  if (otherNetworks.length === 0) {
    return {
      networksCompared: 0,
      yourAvgAchievement,
      marketAvgAchievement: yourAvgAchievement,
      yourAvgCommissionPerStation,
      marketAvgCommissionPerStation: yourAvgCommissionPerStation,
    };
  }

  const perNetwork = await Promise.all(
    otherNetworks.map(async (n) => {
      const rows = await getStationRanking(n.id, range);
      const withGoals = rows.filter((r) => r.attendantsCount > 0);
      const avgAchievement = withGoals.length ? withGoals.reduce((sum, r) => sum + r.avgAchievement, 0) / withGoals.length : null;
      const avgCommission = rows.length ? rows.reduce((sum, r) => sum + r.totalCommission, 0) / rows.length : null;
      return { avgAchievement, avgCommission };
    })
  );

  const achievements = perNetwork.map((n) => n.avgAchievement).filter((v): v is number => v !== null);
  const commissions = perNetwork.map((n) => n.avgCommission).filter((v): v is number => v !== null);

  return {
    networksCompared: otherNetworks.length,
    yourAvgAchievement,
    marketAvgAchievement: achievements.length ? round2(achievements.reduce((a, b) => a + b, 0) / achievements.length) : yourAvgAchievement,
    yourAvgCommissionPerStation,
    marketAvgCommissionPerStation: commissions.length
      ? round2(commissions.reduce((a, b) => a + b, 0) / commissions.length)
      : yourAvgCommissionPerStation,
  };
}
