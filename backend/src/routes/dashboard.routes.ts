import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { round2 } from "../services/commission.service";
import {
  computeManagerCommission,
  currentRange,
  getAttendantItemRanking,
  getAttendantRanking,
  getNetworkAttendantItemRanking,
  getNetworkAttendantRanking,
  getStationRanking,
  monthRangeFromParam,
} from "../services/ranking.service";
import { getItemBreakdown, summarizeRedemptions, weightedAverage } from "../services/summary.service";
import { getBenchmark, getNetworkMonthlyHistory, getPaceAlerts, getWeeklyDigest } from "../services/insights.service";
import { computeGoalProgress } from "../services/commission.service";

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

// Detalhe de um posto: dados cadastrais, equipe com atingimento (geral, ou de UM item com ?itemId=) e
// destaques (top 3 / bottom 3). Usado pelo dono ao clicar num posto na visão por item, e pelo próprio
// gerente do posto.
dashboardRouter.get("/station-detail", requireRole("MANAGER", "OWNER"), async (req, res) => {
  const stationId = req.query.stationId as string | undefined;
  if (!stationId) return res.status(400).json({ error: "Informe o posto (stationId)." });

  const station = await prisma.station.findUnique({
    where: { id: stationId },
    include: {
      manager: { select: { id: true, name: true, email: true, photoUrl: true } },
      _count: { select: { attendants: true } },
    },
  });
  if (!station) return res.status(404).json({ error: "Posto não encontrado." });

  const { role, networkId, stationId: authStationId } = req.auth!;
  if (role === "OWNER" && station.networkId !== networkId) {
    return res.status(403).json({ error: "Sem acesso a este posto." });
  }
  if (role === "MANAGER" && station.id !== authStationId) {
    return res.status(403).json({ error: "Sem acesso a este posto." });
  }

  const itemId = req.query.itemId as string | undefined;
  if (itemId) {
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item || item.networkId !== station.networkId) {
      return res.status(400).json({ error: "Item inválido para esta rede." });
    }
  }
  const monthParsed = monthQuerySchema.safeParse(req.query);
  const range = monthParsed.success && monthParsed.data.month ? monthRangeFromParam(monthParsed.data.month) : undefined;

  const attendants = itemId
    ? await getAttendantItemRanking(stationId, itemId, range)
    : await getAttendantRanking(stationId, range);

  return res.json({
    station: {
      id: station.id,
      name: station.name,
      razaoSocial: station.razaoSocial,
      code: station.code,
      address: station.address,
      manager: station.manager,
      attendantsCount: station._count.attendants,
    },
    itemFiltered: !!itemId,
    attendants,
    top3: attendants.slice(0, 3),
    bottom3: [...attendants].slice(-3).reverse(),
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

/** Resolve a lista de stationIds visível a quem chama (rede toda pro dono, só o posto pro gerente). */
async function scopedStationIds(auth: { role: string; stationId: string | null; networkId: string | null }): Promise<string[]> {
  if (auth.role === "MANAGER") return auth.stationId ? [auth.stationId] : [];
  const stations = await prisma.station.findMany({ where: { networkId: auth.networkId! }, select: { id: true } });
  return stations.map((s) => s.id);
}

// Alertas de ritmo: postos/frentistas cuja projeção de fechamento do período está abaixo do limiar,
// mesmo que ainda dê tempo de reagir.
dashboardRouter.get("/alerts", requireRole("MANAGER", "OWNER"), async (req, res) => {
  const stationIds = await scopedStationIds(req.auth!);
  const alerts = await getPaceAlerts(stationIds);
  return res.json(alerts);
});

// Série histórica dos últimos N meses (padrão 6) da rede: comissão total e atingimento médio por mês.
dashboardRouter.get("/history", requireRole("OWNER"), async (req, res) => {
  const networkId = req.auth!.networkId!;
  const months = Math.min(12, Math.max(1, Number(req.query.months) || 6));
  const history = await getNetworkMonthlyHistory(networkId, months);
  return res.json(history);
});

// Comparativo anônimo com a média de outras redes na plataforma no período atual.
dashboardRouter.get("/benchmark", requireRole("OWNER"), async (req, res) => {
  const networkId = req.auth!.networkId!;
  const benchmark = await getBenchmark(networkId);
  return res.json(benchmark);
});

// Resumo dos últimos 7 dias da rede — substitui, dentro do app, o e-mail semanal (sem provedor de
// envio configurado no ambiente). O frontend decide quando mostrar (uma vez por semana).
dashboardRouter.get("/weekly-digest", requireRole("OWNER"), async (req, res) => {
  const networkId = req.auth!.networkId!;
  const digest = await getWeeklyDigest(networkId);
  return res.json(digest);
});

// Exporta em CSV a comissão de cada meta (posto, frentista, item, realizado, meta, %, comissão) no
// período atual — pronto pra colar em planilha/folha de pagamento.
dashboardRouter.get("/export-csv", requireRole("MANAGER", "OWNER"), async (req, res) => {
  const stationIds = await scopedStationIds(req.auth!);
  const now = currentRange();

  const goals = await prisma.goal.findMany({
    where: { stationId: { in: stationIds }, startDate: { lte: now.end }, endDate: { gte: now.start } },
    include: { item: true, attendant: { select: { name: true } }, station: { select: { name: true } } },
    orderBy: [{ station: { name: "asc" } }, { item: { name: "asc" } }],
  });

  function csvEscape(value: string): string {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  }

  const header = ["Posto", "Frentista", "Item", "Realizado", "Meta", "Unidade", "Atingimento (%)", "Comissão (R$)"];
  const rows = await Promise.all(
    goals.map(async (goal) => {
      const progress = await computeGoalProgress(goal.id);
      return [
        goal.station.name,
        goal.attendant?.name ?? "Meta coletiva",
        goal.item.name,
        String(progress.actualValue),
        String(progress.targetValue),
        goal.item.unit,
        String(progress.achievementPercent),
        progress.commissionAmount.toFixed(2),
      ]
        .map(csvEscape)
        .join(",");
    })
  );

  const csv = [header.join(","), ...rows].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="comissoes.csv"`);
  return res.send("﻿" + csv); // BOM pro Excel abrir acentos corretamente
});
