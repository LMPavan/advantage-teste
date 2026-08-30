import { prisma } from "../prisma";
import { computeGoalProgress, round2 } from "./commission.service";

export interface DateRange {
  start: Date;
  end: Date;
}

export function previousMonthRange(reference = new Date()): DateRange {
  const start = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  const end = new Date(reference.getFullYear(), reference.getMonth(), 0);
  return { start, end };
}

/**
 * Intervalo "atual": um único instante (agora). Usado como padrão para as visões de "período atual"
 * — combinado com o filtro de sobreposição (startDate <= end && endDate >= start), ele seleciona
 * exatamente as metas que estão ativas neste momento, sem misturar metas de meses já fechados.
 */
export function currentRange(reference = new Date()): DateRange {
  return { start: reference, end: reference };
}

/** Converte um parâmetro "YYYY-MM" no intervalo do respectivo mês; usa o mês anterior por padrão. */
export function monthRangeFromParam(month?: string): DateRange {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthIndex] = month.split("-").map(Number);
    const start = new Date(year, monthIndex - 1, 1);
    const end = new Date(year, monthIndex, 0);
    return { start, end };
  }
  return previousMonthRange();
}

export interface AttendantRankingRow {
  attendantId: string;
  name: string;
  photoUrl: string | null;
  stationId: string;
  stationName: string;
  avgAchievement: number;
  totalCommission: number;
  goalsCount: number;
}

/** Ranking dos frentistas de um posto, restrito a um intervalo de datas (padrão: metas ativas agora). */
export async function getAttendantRanking(stationId: string, range: DateRange = currentRange()): Promise<AttendantRankingRow[]> {
  const [attendants, station] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ATTENDANT", stationId },
      select: { id: true, name: true, photoUrl: true },
    }),
    prisma.station.findUniqueOrThrow({ where: { id: stationId }, select: { name: true } }),
  ]);

  if (attendants.length === 0) return [];

  const goals = await prisma.goal.findMany({
    where: {
      stationId,
      attendantId: { in: attendants.map((a) => a.id) },
      startDate: { lte: range.end },
      endDate: { gte: range.start },
    },
  });

  const rows = await Promise.all(
    attendants.map(async (attendant) => {
      const attendantGoals = goals.filter((g) => g.attendantId === attendant.id);
      const progresses = await Promise.all(attendantGoals.map((g) => computeGoalProgress(g.id)));
      const avgAchievement = progresses.length
        ? round2(progresses.reduce((sum, p) => sum + p.achievementPercent, 0) / progresses.length)
        : 0;
      const totalCommission = round2(progresses.reduce((sum, p) => sum + p.commissionAmount, 0));
      const row: AttendantRankingRow = {
        attendantId: attendant.id,
        name: attendant.name,
        photoUrl: attendant.photoUrl,
        stationId,
        stationName: station.name,
        avgAchievement,
        totalCommission,
        goalsCount: attendantGoals.length,
      };
      return row;
    })
  );

  rows.sort((a, b) => b.avgAchievement - a.avgAchievement);
  return rows;
}

/** Ranking de frentistas em toda a rede (usado no mural / hall da fama). */
export async function getNetworkAttendantRanking(networkId: string, range: DateRange = currentRange()): Promise<AttendantRankingRow[]> {
  const stations = await prisma.station.findMany({ where: { networkId }, select: { id: true } });
  const perStation = await Promise.all(stations.map((s) => getAttendantRanking(s.id, range)));
  return perStation.flat().sort((a, b) => b.avgAchievement - a.avgAchievement);
}

export interface StationRankingRow {
  stationId: string;
  stationName: string;
  managerId: string | null;
  managerName: string | null;
  managerPhotoUrl: string | null;
  avgAchievement: number;
  totalCommission: number;
  attendantsCount: number;
}

/** Ranking dos postos/gerentes de uma rede, restrito a um intervalo de datas (padrão: metas ativas agora). */
export async function getStationRanking(networkId: string, range: DateRange = currentRange()): Promise<StationRankingRow[]> {
  const stations = await prisma.station.findMany({
    where: { networkId },
    include: {
      manager: { select: { id: true, name: true, photoUrl: true } },
      _count: { select: { attendants: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows = await Promise.all(
    stations.map(async (station) => {
      const goals = await prisma.goal.findMany({
        where: {
          stationId: station.id,
          startDate: { lte: range.end },
          endDate: { gte: range.start },
        },
      });
      const progresses = await Promise.all(goals.map((g) => computeGoalProgress(g.id)));
      const avgAchievement = progresses.length
        ? round2(progresses.reduce((sum, p) => sum + p.achievementPercent, 0) / progresses.length)
        : 0;
      const totalCommission = round2(progresses.reduce((sum, p) => sum + p.commissionAmount, 0));
      const row: StationRankingRow = {
        stationId: station.id,
        stationName: station.name,
        managerId: station.manager?.id ?? null,
        managerName: station.manager?.name ?? null,
        managerPhotoUrl: station.manager?.photoUrl ?? null,
        avgAchievement,
        totalCommission,
        attendantsCount: station._count.attendants,
      };
      return row;
    })
  );

  rows.sort((a, b) => b.avgAchievement - a.avgAchievement);
  return rows;
}
