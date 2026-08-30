import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

export const itemRouter = Router();
itemRouter.use(requireAuth);

const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  unit: z.string().min(1),
  calculationType: z.enum(["SIMPLE", "MIX_RATIO"]),
  direction: z.enum(["HIGHER_IS_BETTER", "LOWER_IS_BETTER"]),
  commissionType: z.enum([
    "CENTS_PER_LITER",
    "CURRENCY_PER_LITER",
    "CURRENCY_PER_UNIT",
    "PERCENTAGE_OF_VALUE",
    "FIXED_PER_PERIOD",
  ]),
  commissionValue: z.number(),
  payoutMode: z.enum(["THRESHOLD", "PROPORTIONAL"]),
  achievementThresholdPercent: z.number().min(0).max(1000).default(100),
});

// OWNER (administrador da rede) cadastra os itens de meta e define como o comissionamento funciona.
itemRouter.post("/", requireRole("OWNER"), async (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const item = await prisma.item.create({
    data: { ...parsed.data, networkId: req.auth!.networkId! },
  });
  return res.status(201).json(item);
});

// Qualquer usuário autenticado da rede pode listar os itens ativos (para montar metas/lançamentos).
itemRouter.get("/", async (req, res) => {
  const items = await prisma.item.findMany({
    where: { networkId: req.auth!.networkId! },
    orderBy: { name: "asc" },
  });
  return res.json(items);
});

itemRouter.patch("/:id", requireRole("OWNER"), async (req, res) => {
  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const item = await prisma.item.findUnique({ where: { id: req.params.id } });
  if (!item || item.networkId !== req.auth!.networkId) {
    return res.status(404).json({ error: "Item não encontrado." });
  }
  const updated = await prisma.item.update({ where: { id: item.id }, data: parsed.data });
  return res.json(updated);
});
