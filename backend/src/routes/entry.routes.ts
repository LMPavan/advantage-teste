import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeGoalProgress } from "../services/commission.service";

export const entryRouter = Router();
entryRouter.use(requireAuth);

const entrySchema = z.object({
  goalId: z.string().min(1),
  date: z.string(),
  value: z.number().optional(),
  comumLiters: z.number().optional(),
  aditivadaLiters: z.number().optional(),
  attendantId: z.string().optional(),
});

// Lançamento diário de venda/apontamento. O frentista lança o próprio; o gerente pode lançar pela equipe.
entryRouter.post("/", requireRole("ATTENDANT", "MANAGER"), async (req, res) => {
  const parsed = entrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const data = parsed.data;
  const { role, userId, stationId } = req.auth!;

  const goal = await prisma.goal.findUnique({ where: { id: data.goalId }, include: { item: true } });
  if (!goal) return res.status(404).json({ error: "Meta não encontrada." });
  if (goal.stationId !== stationId) {
    return res.status(403).json({ error: "Sem acesso a esta meta." });
  }

  let attendantId = userId;
  if (role === "MANAGER") {
    if (data.attendantId && data.attendantId !== userId) {
      const attendant = await prisma.user.findUnique({ where: { id: data.attendantId } });
      if (!attendant || attendant.stationId !== stationId) {
        return res.status(400).json({ error: "Frentista inválido para este posto." });
      }
      attendantId = data.attendantId;
    } else if (goal.attendantId === userId) {
      // Meta pessoal do próprio gerente (comissão personalizada).
      attendantId = userId;
    } else {
      return res.status(400).json({ error: "Informe o frentista (attendantId)." });
    }
  } else if (goal.attendantId && goal.attendantId !== userId) {
    return res.status(403).json({ error: "Esta meta pertence a outro frentista." });
  }

  if (goal.item.calculationType === "MIX_RATIO") {
    if (data.comumLiters === undefined || data.aditivadaLiters === undefined) {
      return res.status(400).json({ error: "Para itens de mix, informe comumLiters e aditivadaLiters." });
    }
  } else if (data.value === undefined) {
    return res.status(400).json({ error: "Informe o valor lançado." });
  }

  const entry = await prisma.entry.create({
    data: {
      goalId: data.goalId,
      attendantId,
      date: new Date(data.date),
      value: data.value,
      comumLiters: data.comumLiters,
      aditivadaLiters: data.aditivadaLiters,
    },
  });

  const progress = await computeGoalProgress(data.goalId);
  return res.status(201).json({ entry, progress });
});

entryRouter.get("/", async (req, res) => {
  const goalId = req.query.goalId as string | undefined;
  if (!goalId) return res.status(400).json({ error: "Informe goalId." });

  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  if (!goal) return res.status(404).json({ error: "Meta não encontrada." });
  if (goal.stationId !== req.auth!.stationId && req.auth!.role !== "OWNER") {
    return res.status(403).json({ error: "Sem acesso a esta meta." });
  }

  const entries = await prisma.entry.findMany({
    where: { goalId },
    orderBy: { date: "desc" },
    include: { attendant: { select: { id: true, name: true } } },
  });
  return res.json(entries);
});
