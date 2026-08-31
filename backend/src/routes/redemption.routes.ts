import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeGoalProgress } from "../services/commission.service";

export const redemptionRouter = Router();
redemptionRouter.use(requireAuth);

const redemptionSchema = z.object({
  period: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  periodStart: z.string(),
  periodEnd: z.string(),
});

// Frentista solicita o resgate da comissão acumulada em um período, respeitando a política do posto.
redemptionRouter.post("/", requireRole("ATTENDANT"), async (req, res) => {
  const parsed = redemptionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const { period, periodStart, periodEnd } = parsed.data;
  const { userId, stationId } = req.auth!;
  if (!stationId) return res.status(400).json({ error: "Usuário sem posto vinculado." });

  const policy = await prisma.redemptionPolicy.findUnique({ where: { stationId } });
  const allowed =
    (period === "DAILY" && policy?.allowDaily) ||
    (period === "WEEKLY" && policy?.allowWeekly) ||
    (period === "MONTHLY" && policy?.allowMonthly);
  if (!allowed) {
    return res.status(403).json({ error: "Esta periodicidade de resgate não está liberada pelo administrador." });
  }

  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  const goals = await prisma.goal.findMany({
    where: {
      stationId,
      OR: [{ attendantId: userId }, { attendantId: null }],
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });

  let totalCommission = 0;
  for (const goal of goals) {
    const progress = await computeGoalProgress(goal.id);
    totalCommission += progress.commissionAmount;
  }
  totalCommission = Math.round(totalCommission * 100) / 100;

  if (totalCommission <= 0) {
    return res.status(400).json({ error: "Não há comissão acumulada neste período para resgate." });
  }

  const redemption = await prisma.redemption.create({
    data: {
      attendantId: userId,
      stationId,
      period,
      periodStart: start,
      periodEnd: end,
      commissionAmount: totalCommission,
      status: "PENDING",
    },
  });

  return res.status(201).json(redemption);
});

// Lista resgates: ATTENDANT vê os seus; MANAGER/OWNER veem os do posto/rede para aprovar.
redemptionRouter.get("/", async (req, res) => {
  const { role, userId, stationId, networkId } = req.auth!;

  if (role === "ATTENDANT") {
    const redemptions = await prisma.redemption.findMany({
      where: { attendantId: userId },
      orderBy: { requestedAt: "desc" },
    });
    return res.json(redemptions);
  }

  if (role === "MANAGER") {
    const redemptions = await prisma.redemption.findMany({
      where: { stationId: stationId! },
      include: { attendant: { select: { id: true, name: true } } },
      orderBy: { requestedAt: "desc" },
    });
    return res.json(redemptions);
  }

  const stations = await prisma.station.findMany({ where: { networkId: networkId! }, select: { id: true } });
  const redemptions = await prisma.redemption.findMany({
    where: { stationId: { in: stations.map((s) => s.id) } },
    include: { attendant: { select: { id: true, name: true } }, station: { select: { id: true, name: true } } },
    orderBy: { requestedAt: "desc" },
  });
  return res.json(redemptions);
});

const decisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "PAID"]),
  notes: z.string().optional(),
});

// Gerente/dono aprova, rejeita ou marca como pago um pedido de resgate.
redemptionRouter.patch("/:id/decision", requireRole("MANAGER", "OWNER"), async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }

  const redemption = await prisma.redemption.findUnique({ where: { id: req.params.id } });
  if (!redemption) return res.status(404).json({ error: "Resgate não encontrado." });

  const { role, stationId, networkId } = req.auth!;
  if (role === "MANAGER" && redemption.stationId !== stationId) {
    return res.status(403).json({ error: "Sem acesso a este resgate." });
  }
  if (role === "OWNER") {
    const station = await prisma.station.findUnique({ where: { id: redemption.stationId } });
    if (station?.networkId !== networkId) {
      return res.status(403).json({ error: "Sem acesso a este resgate." });
    }
  }

  const updated = await prisma.redemption.update({
    where: { id: redemption.id },
    data: {
      status: parsed.data.status,
      notes: parsed.data.notes,
      decidedById: req.auth!.userId,
      decidedAt: new Date(),
    },
  });

  return res.json(updated);
});
