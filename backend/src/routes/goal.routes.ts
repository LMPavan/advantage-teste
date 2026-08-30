import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeGoalProgress } from "../services/commission.service";
import { currentRange } from "../services/ranking.service";

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

  const item = await prisma.item.findUnique({ where: { id: data.itemId } });
  if (!item || item.networkId !== station.networkId) {
    return res.status(400).json({ error: "Item inválido para esta rede." });
  }

  if (data.attendantId) {
    const attendant = await prisma.user.findUnique({ where: { id: data.attendantId } });
    if (!attendant || attendant.stationId !== targetStationId) {
      return res.status(400).json({ error: "Frentista inválido para este posto." });
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
      endDate: new Date(data.endDate),
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
    include: { item: true, attendant: { select: { id: true, name: true, email: true } }, station: true },
    orderBy: { startDate: "desc" },
  });

  const withProgress = await Promise.all(
    goals.map(async (goal) => ({ ...goal, progress: await computeGoalProgress(goal.id) }))
  );

  return res.json(withProgress);
});

goalRouter.get("/:id", async (req, res) => {
  const goal = await prisma.goal.findUnique({
    where: { id: req.params.id },
    include: { item: true, attendant: { select: { id: true, name: true, email: true } }, station: true, entries: true },
  });
  if (!goal) return res.status(404).json({ error: "Meta não encontrada." });

  const { role, stationId, userId } = req.auth!;
  if (role === "ATTENDANT" && goal.stationId !== stationId) {
    return res.status(403).json({ error: "Sem acesso a esta meta." });
  }
  if (role === "MANAGER" && goal.stationId !== stationId) {
    return res.status(403).json({ error: "Sem acesso a esta meta." });
  }
  void userId;

  const progress = await computeGoalProgress(goal.id);
  return res.json({ ...goal, progress });
});
