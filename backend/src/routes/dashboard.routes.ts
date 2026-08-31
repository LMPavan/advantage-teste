import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { round2 } from "../services/commission.service";
import {
  computeManagerCommission,
  getAttendantItemRanking,
  getAttendantRanking,
  getNetworkAttendantItemRanking,
  getNetworkAttendantRanking,
  getStationRanking,
  monthRangeFromParam,
} from "../services/ranking.service";
import { getItemBreakdown, summarizeRedemptions, weightedAverage } from "../services/summary.service";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

// Visão executiva do dono: ranking de postos/gerentes e de frentistas em toda a rede (período atual).
// Com ?itemId=, os dois rankings passam a considerar só aquele item (ex.: só "Lubrificantes"), em vez
// da média combinada de todos os itens — mesmo padrão do ranking do frentista por item.
dashboardRouter.get("/executive", requireRole("OWNER"), async (req, res) => {
  const networkId = req.auth!.networkId!;
  const itemId = req.query.itemId as string | undefined;

  if (itemId) {
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item || item.networkId !== networkId) {
      return res.status(400).json({ error: "Item inválido para esta rede." });
    }
  }

  const [stationRankings, attendantRankings] = await Promise.all([
    getStationRanking(networkId, undefined, itemId),
    itemId ? getNetworkAttendantItemRanking(networkId, itemId) : getNetworkAttendantRanking(networkId),
  ]);

  return res.json({
    stationsCount: stationRankings.length,
    totalCommission: round2(stationRankings.reduce((sum, s) => sum + s.totalCommission, 0)),
    stationRankings,
    attendantRankings,
    itemFiltered: !!itemId,
  });
});

// Visão do gerente: desempenho consolidado da equipe do próprio posto (período atual).
dashboardRouter.get("/team", requireRole("MANAGER"), async (req, res) => {
  const stationId = req.auth!.stationId!;
  const rows = await getAttendantRanking(stationId);
  return res.json({
    stationId,
    attendants: rows.map((r) => ({
      attendantId: r.attendantId,
      name: r.name,
      goalsCount: r.goalsCount,
      avgAchievement: r.avgAchievement,
      totalCommission: r.totalCommission,
    })),
  });
});

const monthQuerySchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() });

// Ranking gamificado dos frentistas do posto (usado por ATTENDANT, MANAGER e OWNER).
// ATTENDANT/MANAGER usam seu próprio posto; OWNER precisa informar ?stationId=.
// Com ?itemId=, retorna o ranking de um único item (valor realizado + % de atingimento), em vez da
// média combinada de todos os itens.
dashboardRouter.get("/station-ranking", requireRole("ATTENDANT", "MANAGER", "OWNER"), async (req, res) => {
  const { role, stationId: authStationId, networkId } = req.auth!;
  const monthParsed = monthQuerySchema.safeParse(req.query);
  const month = monthParsed.success ? monthParsed.data.month : undefined;
  const itemId = req.query.itemId as string | undefined;

  let targetStationId = authStationId ?? undefined;
  if (role === "OWNER") {
    targetStationId = (req.query.stationId as string | undefined) ?? undefined;
    if (!targetStationId) {
      return res.status(400).json({ error: "Informe o posto (stationId)." });
    }
    const station = await prisma.station.findUnique({ where: { id: targetStationId } });
    if (!station || station.networkId !== networkId) {
      return res.status(403).json({ error: "Sem acesso a este posto." });
    }
  }
  if (!targetStationId) return res.json([]);

  const range = month ? monthRangeFromParam(month) : undefined;

  if (itemId) {
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item || item.networkId !== networkId) {
      return res.status(400).json({ error: "Item inválido para esta rede." });
    }
    const rows = await getAttendantItemRanking(targetStationId, itemId, range);
    return res.json(rows);
  }

  const rows = await getAttendantRanking(targetStationId, range);
  return res.json(rows);
});

// Ranking gamificado dos postos/gerentes da rede (usado por MANAGER e OWNER).
dashboardRouter.get("/network-ranking", requireRole("MANAGER", "OWNER"), async (req, res) => {
  const networkId = req.auth!.networkId!;
  const monthParsed = monthQuerySchema.safeParse(req.query);
  const month = monthParsed.success ? monthParsed.data.month : undefined;

  const rows = await getStationRanking(networkId, month ? monthRangeFromParam(month) : undefined);
  return res.json(rows);
});

// Mural / hall da fama: top 3 frentistas e top 3 postos do mês anterior (ou de ?month=), em toda a rede.
// Visível para os três papéis, já que celebra os destaques de toda a rede.
dashboardRouter.get("/hall-of-fame", requireRole("ATTENDANT", "MANAGER", "OWNER"), async (req, res) => {
  const networkId = req.auth!.networkId!;
  const monthParsed = monthQuerySchema.safeParse(req.query);
  const range = monthRangeFromParam(monthParsed.success ? monthParsed.data.month : undefined);

  const [attendantRankings, stationRankings] = await Promise.all([
    getNetworkAttendantRanking(networkId, range),
    getStationRanking(networkId, range),
  ]);

  return res.json({
    month: `${range.start.getFullYear()}-${String(range.start.getMonth() + 1).padStart(2, "0")}`,
    topAttendants: attendantRankings.filter((a) => a.goalsCount > 0).slice(0, 3),
    topStations: stationRankings.filter((s) => s.attendantsCount > 0).slice(0, 3),
  });
});

// Painel do dono: KPIs consolidados de toda a rede no período atual.
dashboardRouter.get("/owner-summary", requireRole("OWNER"), async (req, res) => {
  const networkId = req.auth!.networkId!;

  const stations = await prisma.station.findMany({ where: { networkId }, select: { id: true } });
  const stationIds = stations.map((s) => s.id);

  const [managersCount, attendantsCount, itemBreakdown, redemptions, stationRankings] = await Promise.all([
    prisma.station.count({ where: { networkId, managerId: { not: null } } }),
    prisma.user.count({ where: { role: "ATTENDANT", stationId: { in: stationIds } } }),
    getItemBreakdown({ stationId: { in: stationIds } }),
    prisma.redemption.findMany({ where: { stationId: { in: stationIds } }, select: { status: true, commissionAmount: true } }),
    getStationRanking(networkId),
  ]);

  return res.json({
    stationsCount: stations.length,
    managersCount,
    attendantsCount,
    totalCommission: round2(itemBreakdown.reduce((sum, i) => sum + i.totalCommission, 0)),
    avgAchievement: weightedAverage(itemBreakdown),
    itemBreakdown,
    redemptionSummary: summarizeRedemptions(redemptions),
    bestStation: stationRankings[0] ?? null,
    worstStation: stationRankings.length > 1 ? stationRankings[stationRankings.length - 1] : null,
  });
});

// Painel do gerente: KPIs consolidados do próprio posto no período atual.
dashboardRouter.get("/manager-summary", requireRole("MANAGER"), async (req, res) => {
  const stationId = req.auth!.stationId!;

  const [attendantsCount, itemBreakdown, redemptions, attendantRanking, managerCommission] = await Promise.all([
    prisma.user.count({ where: { role: "ATTENDANT", stationId } }),
    getItemBreakdown({ stationId }),
    prisma.redemption.findMany({ where: { stationId }, select: { status: true, commissionAmount: true } }),
    getAttendantRanking(stationId),
    computeManagerCommission(stationId),
  ]);

  return res.json({
    attendantsCount,
    totalCommission: round2(itemBreakdown.reduce((sum, i) => sum + i.totalCommission, 0)),
    avgAchievement: weightedAverage(itemBreakdown),
    itemBreakdown,
    redemptionSummary: summarizeRedemptions(redemptions),
    topAttendant: attendantRanking[0] ?? null,
    attendantNeedingAttention: attendantRanking.length > 1 ? attendantRanking[attendantRanking.length - 1] : null,
    managerCommission,
  });
});

// Comissão de cada gerente da rede (visão do dono), conforme o modo configurado por posto.
dashboardRouter.get("/manager-commissions", requireRole("OWNER"), async (req, res) => {
  const networkId = req.auth!.networkId!;
  const stations = await prisma.station.findMany({
    where: { networkId },
    include: { manager: { select: { id: true, name: true, photoUrl: true } } },
    orderBy: { createdAt: "asc" },
  });

  const rows = await Promise.all(
    stations
      .filter((s) => s.managerId)
      .map(async (station) => ({
        stationId: station.id,
        stationName: station.name,
        managerId: station.managerId,
        managerName: station.manager?.name ?? null,
        managerPhotoUrl: station.manager?.photoUrl ?? null,
        commission: await computeManagerCommission(station.id),
      }))
  );

  return res.json(rows);
});
