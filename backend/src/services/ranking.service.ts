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

export interface ItemAttendantRankingRow {
  attendantId: string;
  name: string;
  photoUrl: string | null;
  stationId: string;
  stationName: string;
  itemId: string;
  itemName: string;
  unit: string;
  actualValue: number;
  targetValue: number;
  achievementPercent: number;
  commissionAmount: number;
}

/**
 * Ranking dos frentistas de um posto para UM item específico (ex.: só "Lubrificantes"), mostrando o
 * valor realizado e o percentual de atingimento de cada um — não apenas a média combinada de todos os
 * itens. Frentistas sem meta deste item no período não entram na lista.
 */
export async function getAttendantItemRanking(
  stationId: string,
  itemId: string,
  range: DateRange = currentRange()
): Promise<ItemAttendantRankingRow[]> {
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
      itemId,
      attendantId: { in: attendants.map((a) => a.id) },
      startDate: { lte: range.end },
      endDate: { gte: range.start },
    },
    include: { item: true },
  });

  const rows: ItemAttendantRankingRow[] = [];
  for (const attendant of attendants) {
    // Assume no máximo uma meta ativa deste item por frentista no período (o fluxo normal do app
    // não cria mais de uma meta concorrente do mesmo item/período para o mesmo frentista).
    const goal = goals.find((g) => g.attendantId === attendant.id);
    if (!goal) continue;
    const progress = await computeGoalProgress(goal.id);
    rows.push({
      attendantId: attendant.id,
      name: attendant.name,
      photoUrl: attendant.photoUrl,
      stationId,
      stationName: station.name,
      itemId: goal.itemId,
      itemName: goal.item.name,
      unit: goal.item.unit,
      actualValue: progress.actualValue,
      targetValue: progress.targetValue,
      achievementPercent: progress.achievementPercent,
      commissionAmount: progress.commissionAmount,
    });
  }

  rows.sort((a, b) => b.achievementPercent - a.achievementPercent);
  return rows;
}

/** Ranking de frentistas em toda a rede (usado no mural / hall da fama). */
export async function getNetworkAttendantRanking(networkId: string, range: DateRange = currentRange()): Promise<AttendantRankingRow[]> {
  const stations = await prisma.station.findMany({ where: { networkId }, select: { id: true } });
  const perStation = await Promise.all(stations.map((s) => getAttendantRanking(s.id, range)));
  return perStation.flat().sort((a, b) => b.avgAchievement - a.avgAchievement);
}

/** Ranking de frentistas de UM item específico em toda a rede (visão executiva do dono por item). */
export async function getNetworkAttendantItemRanking(
  networkId: string,
  itemId: string,
  range: DateRange = currentRange()
): Promise<ItemAttendantRankingRow[]> {
  const stations = await prisma.station.findMany({ where: { networkId }, select: { id: true } });
  const perStation = await Promise.all(stations.map((s) => getAttendantItemRanking(s.id, itemId, range)));
  return perStation.flat().sort((a, b) => b.achievementPercent - a.achievementPercent);
}

export interface ManagerCommissionSummary {
  mode: "NONE" | "TEAM_SUM" | "CUSTOM";
  percent: number;
  teamCommission: number;
  personalCommission: number;
  totalCommission: number;
}

/**
 * Comissão do gerente de um posto, conforme o modo configurado pelo dono da rede:
 * - NONE: não recebe comissão.
 * - TEAM_SUM: percentual configurado sobre a soma da comissão gerada pela equipe (frentistas) no período.
 * - CUSTOM: soma da comissão das metas próprias do gerente (cadastradas pelo dono como as de um frentista).
 */
export async function computeManagerCommission(
  stationId: string,
  range: DateRange = currentRange()
): Promise<ManagerCommissionSummary | null> {
  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station || !station.managerId) return null;

  const percent = Number(station.managerCommissionPercent);

  if (station.managerCommissionMode === "CUSTOM") {
    const goals = await prisma.goal.findMany({
      where: {
        stationId,
        attendantId: station.managerId,
        startDate: { lte: range.end },
        endDate: { gte: range.start },
      },
    });
    const progresses = await Promise.all(goals.map((g) => computeGoalProgress(g.id)));
    const personalCommission = round2(progresses.reduce((sum, p) => sum + p.commissionAmount, 0));
    return { mode: "CUSTOM", percent, teamCommission: 0, personalCommission, totalCommission: personalCommission };
  }

  if (station.managerCommissionMode === "NONE") {
    return { mode: "NONE", percent, teamCommission: 0, personalCommission: 0, totalCommission: 0 };
  }

  // TEAM_SUM
  const teamRows = await getAttendantRanking(stationId, range);
  const teamCommission = round2(teamRows.reduce((sum, r) => sum + r.totalCommission, 0));
  const totalCommission = round2(teamCommission * (percent / 100));
  return { mode: "TEAM_SUM", percent, teamCommission, personalCommission: 0, totalCommission };
}

export interface StationRankingRow {
  stationId: string;
  stationName: string;
  stationRazaoSocial: string | null;
  managerId: string | null;
  managerName: string | null;
  managerPhotoUrl: string | null;
  avgAchievement: number;
  totalCommission: number;
  attendantsCount: number;
  // Só fazem sentido somados quando itemId é informado (mesma unidade); em modo combinado ficam null.
  actualTotal: number | null;
  targetTotal: number | null;
  unit: string | null;
}

/**
 * Ranking dos postos/gerentes de uma rede, restrito a um intervalo de datas (padrão: metas ativas
 * agora). Com itemId, considera só as metas daquele item (ex.: só "Lubrificantes"), em vez da média
 * combinada de todos os itens do posto — e nesse caso também soma o realizado e o alvo do posto
 * inteiro naquele item (actualTotal/targetTotal), para a visão "atingimento por posto vs. alvo".
 */
export async function getStationRanking(
  networkId: string,
  range: DateRange = currentRange(),
  itemId?: string
): Promise<StationRankingRow[]> {
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
          ...(itemId ? { itemId } : {}),
          startDate: { lte: range.end },
          endDate: { gte: range.start },
        },
        include: { item: true },
      });
      const progresses = await Promise.all(goals.map((g) => computeGoalProgress(g.id)));
      const avgAchievement = progresses.length
        ? round2(progresses.reduce((sum, p) => sum + p.achievementPercent, 0) / progresses.length)
        : 0;
      const totalCommission = round2(progresses.reduce((sum, p) => sum + p.commissionAmount, 0));
      const row: StationRankingRow = {
        stationId: station.id,
        stationName: station.name,
        stationRazaoSocial: station.razaoSocial,
        managerId: station.manager?.id ?? null,
        managerName: station.manager?.name ?? null,
        managerPhotoUrl: station.manager?.photoUrl ?? null,
        avgAchievement,
        totalCommission,
        attendantsCount: station._count.attendants,
        actualTotal: itemId && progresses.length ? round2(progresses.reduce((sum, p) => sum + p.actualValue, 0)) : null,
        targetTotal: itemId && progresses.length ? round2(progresses.reduce((sum, p) => sum + p.targetValue, 0)) : null,
        unit: itemId && goals.length ? goals[0].item.unit : null,
      };
      return row;
    })
  );

  rows.sort((a, b) => b.avgAchievement - a.avgAchievement);
  return rows;
}
