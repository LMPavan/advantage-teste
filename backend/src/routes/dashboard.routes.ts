import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeGoalProgress, round2 } from "../services/commission.service";
import {
  getAttendantRanking,
  getNetworkAttendantRanking,
  getStationRanking,
  monthRangeFromParam,
} from "../services/ranking.service";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

// Visão executiva do dono: ranking de postos/gerentes e de frentistas em toda a rede (período atual).
dashboardRouter.get("/executive", requireRole("OWNER"), async (req, res) => {
  const networkId = req.auth!.networkId!;

  const [stationRankings, attendantRankings] = await Promise.all([
    getStationRanking(networkId),
    getNetworkAttendantRanking(networkId),
  ]);

  return res.json({
    stationsCount: stationRankings.length,
    totalCommission: round2(stationRankings.reduce((sum, s) => sum + s.totalCommission, 0)),
    stationRankings,
    attendantRankings,
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
dashboardRouter.get("/station-ranking", requireRole("ATTENDANT", "MANAGER", "OWNER"), async (req, res) => {
  const { role, stationId: authStationId, networkId } = req.auth!;
  const monthParsed = monthQuerySchema.safeParse(req.query);
  const month = monthParsed.success ? monthParsed.data.month : undefined;

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

  const rows = await getAttendantRanking(targetStationId, month ? monthRangeFromParam(month) : undefined);
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
