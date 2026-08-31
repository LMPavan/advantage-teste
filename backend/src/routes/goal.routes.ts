import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeDailyCommissionEstimate, computeGoalProgress, computeTodayProgress, round2 } from "../services/commission.service";
import { currentRange } from "../services/ranking.service";

/** Confere se o usuário autenticado pode ver esta meta (mesmo posto para ATTENDANT/MANAGER, mesma rede para OWNER). */
async function canAccessGoal(
  goal: { stationId: string },
  auth: { role: string; stationId: string | null; networkId: string | null }
): Promise<boolean> {
  if (auth.role === "ATTENDANT" || auth.role === "MANAGER") {
    return goal.stationId === auth.stationId;
  }
  const station = await prisma.station.findUnique({ where: { id: goal.stationId }, select: { networkId: true } });
  return station?.networkId === auth.networkId;
}

export const goalRouter = Router();
goalRouter.use(requireAuth);

const goalSchema = z.object({
  stationId: z.string().optional(),
  itemId: z.string().min(1),
  attendantId: z.string().optional(),
  period: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  targetValue: z.number().positive(),
  startDate: z.string(),
  endDate: z.string(),
});

// MANAGER cria metas para o seu posto (individuais por frentista ou coletivas). OWNER também pode.
goalRouter.post("/", requireRole("MANAGER", "OWNER"), async (req, res) => {
  const parsed = goalSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const { role, stationId: authStationId, networkId } = req.auth!;
  const data = parsed.data;

  const targetStationId = role === "MANAGER" ? authStationId : data.stationId;
  if (!targetStationId) {
    return res.status(400).json({ error: "Informe o posto (stationId) da meta." });
  }

  const station = await prisma.station.findUnique({ where: { id: targetStationId } });
  if (!station) return res.status(404).json({ error: "Posto não encontrado." });
  if (role === "OWNER" && station.networkId !== networkId) {
    return res.status(403).json({ error: "Sem acesso a este posto." });
  }
  if (role === "MANAGER" && !station.managerCanManageGoals) {
    return res.status(403).json({ error: "O dono da rede não liberou o cadastro de metas para gerentes neste posto." });
  }

  const item = await prisma.item.findUnique({ where: { id: data.itemId } });
  if (!item || item.networkId !== station.networkId) {
    return res.status(400).json({ error: "Item inválido para esta rede." });
  }

  if (data.attendantId) {
    // Aceita um frentista do posto ou o próprio gerente do posto (meta pessoal de comissão personalizada).
    const assignee = await prisma.user.findUnique({ where: { id: data.attendantId } });
    const isValidAttendant = assignee?.role === "ATTENDANT" && assignee.stationId === targetStationId;
    const isValidManager = assignee?.role === "MANAGER" && station.managerId === assignee.id;
    if (!assignee || (!isValidAttendant && !isValidManager)) {
      return res.status(400).json({ error: "Frentista ou gerente inválido para este posto." });
    }
  }

  const goal = await prisma.goal.create({
    data: {
      stationId: targetStationId,
      itemId: data.itemId,
      attendantId: data.attendantId,
      period: data.period,
      targetValue: data.targetValue,
      startDate: new Date(data.startDate),
      // Fim do dia (não meia-noite) para a meta continuar ativa até o fim do último dia do período.
      endDate: new Date(`${data.endDate}T23:59:59.999Z`),
      createdById: req.auth!.userId,
    },
    include: { item: true, attendant: { select: { id: true, name: true, email: true } } },
  });

  return res.status(201).json(goal);
});

// Lista metas com o progresso já calculado. Por padrão mostra apenas metas ativas agora (que já
// começaram e ainda não terminaram) — metas de períodos fechados não aparecem aqui.
// ATTENDANT: apenas as suas + coletivas do posto. MANAGER: todas do posto. OWNER: toda a rede (opcionalmente ?stationId=).
goalRouter.get("/", async (req, res) => {
  const { role, stationId, networkId, userId } = req.auth!;
  const now = currentRange();

  let where: any = { startDate: { lte: now.end }, endDate: { gte: now.start } };
  if (role === "ATTENDANT") {
    where = { ...where, stationId, OR: [{ attendantId: userId }, { attendantId: null }] };
  } else if (role === "MANAGER") {
    where = { ...where, stationId };
  } else {
    const filterStationId = req.query.stationId as string | undefined;
    if (filterStationId) {
      where = { ...where, stationId: filterStationId };
    } else {
      const stations = await prisma.station.findMany({ where: { networkId: networkId! }, select: { id: true } });
      where = { ...where, stationId: { in: stations.map((s) => s.id) } };
    }
  }

  const goals = await prisma.goal.findMany({
    where,
    include: { item: true, attendant: { select: { id: true, name: true, email: true } }, station: true, entries: true },
    orderBy: { startDate: "desc" },
  });

  const todayIso = new Date().toISOString().slice(0, 10);
  const withProgress = await Promise.all(
    goals.map(async (goal) => {
      const { entries, ...rest } = goal;
      const progress = await computeGoalProgress(goal.id);
      const today = computeTodayProgress(goal.item, entries, todayIso);
      return { ...rest, progress, today };
    })
  );

  return res.json(withProgress);
});

goalRouter.get("/:id", async (req, res) => {
  const goal = await prisma.goal.findUnique({
    where: { id: req.params.id },
    include: { item: true, attendant: { select: { id: true, name: true, email: true } }, station: true, entries: true },
  });
  if (!goal) return res.status(404).json({ error: "Meta não encontrada." });
  if (!(await canAccessGoal(goal, req.auth!))) {
    return res.status(403).json({ error: "Sem acesso a esta meta." });
  }

  const progress = await computeGoalProgress(goal.id);
  return res.json({ ...goal, progress });
});

const dailyQuerySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Detalhamento dia a dia de uma meta: o que foi lançado em cada dia e uma estimativa de comissão
// diária (taxa aplicada ao valor do dia, sem o corte de percentual mínimo/teto — esses só valem sobre
// o período fechado). Por padrão cobre o período inteiro da meta; aceita ?start=&end= (semana, mês
// customizado etc.) escolhido pelo frentista na tela de detalhe.
goalRouter.get("/:id/daily", async (req, res) => {
  const parsedQuery = dailyQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    return res.status(400).json({ error: "Parâmetros de data inválidos." });
  }

  const goal = await prisma.goal.findUnique({
    where: { id: req.params.id },
    include: { item: true, entries: true },
  });
  if (!goal) return res.status(404).json({ error: "Meta não encontrada." });
  if (!(await canAccessGoal(goal, req.auth!))) {
    return res.status(403).json({ error: "Sem acesso a esta meta." });
  }

  const rangeStart = parsedQuery.data.start ?? goal.startDate.toISOString().slice(0, 10);
  const rangeEnd = parsedQuery.data.end ?? goal.endDate.toISOString().slice(0, 10);
  const isMix = goal.item.calculationType === "MIX_RATIO";

  const byDate = new Map<string, { value: number; comumLiters: number; aditivadaLiters: number }>();
  for (const entry of goal.entries) {
    const date = entry.date.toISOString().slice(0, 10);
    if (date < rangeStart || date > rangeEnd) continue;
    const current = byDate.get(date) ?? { value: 0, comumLiters: 0, aditivadaLiters: 0 };
    current.value += entry.value ? Number(entry.value) : 0;
    current.comumLiters += entry.comumLiters ? Number(entry.comumLiters) : 0;
    current.aditivadaLiters += entry.aditivadaLiters ? Number(entry.aditivadaLiters) : 0;
    byDate.set(date, current);
  }

  const days = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, agg]) => ({
      date,
      value: isMix ? null : round2(agg.value),
      comumLiters: isMix ? round2(agg.comumLiters) : null,
      aditivadaLiters: isMix ? round2(agg.aditivadaLiters) : null,
      ratio:
        isMix && agg.comumLiters + agg.aditivadaLiters > 0
          ? round2((agg.aditivadaLiters / (agg.comumLiters + agg.aditivadaLiters)) * 100)
          : null,
      estimatedCommission: computeDailyCommissionEstimate(goal.item, agg),
    }));

  return res.json({
    goalId: goal.id,
    itemName: goal.item.name,
    unit: goal.item.unit,
    calculationType: goal.item.calculationType,
    commissionType: goal.item.commissionType,
    rangeStart,
    rangeEnd,
    days,
  });
});
