import { prisma } from "../prisma";
import { computeDailyCommissionEstimate, computeGoalProgress, computeProjection, round2 } from "./commission.service";
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

// ---------------------------------------------------------------------------
// Resumo semanal do dono (substitui, dentro do próprio app, o e-mail semanal que exigiria um
// provedor de envio configurado — ver getWeeklyDigest).
// ---------------------------------------------------------------------------

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

interface EntityCommission {
  total: number;
  byStation: Map<string, { stationId: string; stationName: string; estimatedCommission: number }>;
  byAttendant: Map<string, { attendantId: string; name: string; stationName: string; estimatedCommission: number }>;
}

/**
 * Soma a comissão ESTIMADA (mesma lógica do "ritmo de hoje" já usado nas metas — reaproveita
 * computeDailyCommissionEstimate por lançamento) de todos os lançamentos da rede num intervalo,
 * agrupada por posto e por frentista. Não é a comissão final do período (que depende de threshold e
 * teto proporcional), é um indicador de volume de atividade da janela.
 */
async function sumEstimatedCommissionByEntity(networkId: string, start: Date, end: Date): Promise<EntityCommission> {
  const stations = await prisma.station.findMany({ where: { networkId }, select: { id: true } });
  const stationIds = stations.map((s) => s.id);
  const byStation = new Map<string, { stationId: string; stationName: string; estimatedCommission: number }>();
  const byAttendant = new Map<string, { attendantId: string; name: string; stationName: string; estimatedCommission: number }>();
  if (stationIds.length === 0) return { total: 0, byStation, byAttendant };

  const entries = await prisma.entry.findMany({
    where: { date: { gte: start, lte: end }, goal: { stationId: { in: stationIds } } },
    include: {
      goal: { include: { item: true, station: { select: { id: true, name: true } } } },
      attendant: { select: { id: true, name: true } },
    },
  });

  let total = 0;
  for (const entry of entries) {
    const estimate = computeDailyCommissionEstimate(entry.goal.item, entry);
    total += estimate;

    const station = byStation.get(entry.goal.station.id) ?? {
      stationId: entry.goal.station.id,
      stationName: entry.goal.station.name,
      estimatedCommission: 0,
    };
    station.estimatedCommission = round2(station.estimatedCommission + estimate);
    byStation.set(entry.goal.station.id, station);

    const attendant = byAttendant.get(entry.attendant.id) ?? {
      attendantId: entry.attendant.id,
      name: entry.attendant.name,
      stationName: entry.goal.station.name,
      estimatedCommission: 0,
    };
    attendant.estimatedCommission = round2(attendant.estimatedCommission + estimate);
    byAttendant.set(entry.attendant.id, attendant);
  }

  return { total: round2(total), byStation, byAttendant };
}

export interface WeeklyDigest {
  weekStart: string;
  weekEnd: string;
  totalEstimatedCommission: number;
  previousWeekEstimatedCommission: number;
  changePercent: number | null;
  topStation: { stationId: string; stationName: string; estimatedCommission: number } | null;
  topAttendant: { attendantId: string; name: string; stationName: string; estimatedCommission: number } | null;
  activeAlertsCount: number;
}

/** Resumo dos últimos 7 dias da rede: comissão estimada, variação vs. semana anterior, destaques e alertas ativos. */
export async function getWeeklyDigest(networkId: string): Promise<WeeklyDigest> {
  const now = new Date();
  const weekEnd = endOfDay(now);
  const weekStart = startOfDay(new Date(now.getTime() - 6 * 86400000));
  const prevWeekEnd = endOfDay(new Date(weekStart.getTime() - 86400000));
  const prevWeekStart = startOfDay(new Date(prevWeekEnd.getTime() - 6 * 86400000));

  const stations = await prisma.station.findMany({ where: { networkId }, select: { id: true } });
  const stationIds = stations.map((s) => s.id);

  const [current, previous, alerts] = await Promise.all([
    sumEstimatedCommissionByEntity(networkId, weekStart, weekEnd),
    sumEstimatedCommissionByEntity(networkId, prevWeekStart, prevWeekEnd),
    getPaceAlerts(stationIds),
  ]);

  const topStation = [...current.byStation.values()].sort((a, b) => b.estimatedCommission - a.estimatedCommission)[0] ?? null;
  const topAttendant = [...current.byAttendant.values()].sort((a, b) => b.estimatedCommission - a.estimatedCommission)[0] ?? null;
  const changePercent = previous.total > 0 ? round2(((current.total - previous.total) / previous.total) * 100) : null;

  return {
    weekStart: isoDate(weekStart),
    weekEnd: isoDate(weekEnd),
    totalEstimatedCommission: current.total,
    previousWeekEstimatedCommission: previous.total,
    changePercent,
    topStation,
    topAttendant,
    activeAlertsCount: alerts.length,
  };
}
