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
  // Se false, a comissão é paga integralmente por unidade vendida, sem depender de bater a meta —
  // payoutMode/achievementThresholdPercent são ignorados nesse caso (mas continuam sendo salvos).
  linkedToGoal: z.boolean().default(true),
  payoutMode: z.enum(["THRESHOLD", "PROPORTIONAL"]),
  achievementThresholdPercent: z.number().min(0).max(1000).default(100),
  active: z.boolean().optional(),
});

/**
 * Itens de comissão valem para a rede inteira (todos os postos), não só o posto do gerente — por
 * isso o OWNER sempre pode, e o MANAGER só se o dono liberou managerCanManageItems no posto dele.
 */
async function canManageItems(auth: { role: string; stationId: string | null }): Promise<boolean> {
  if (auth.role === "OWNER") return true;
  if (auth.role !== "MANAGER" || !auth.stationId) return false;
  const station = await prisma.station.findUnique({ where: { id: auth.stationId }, select: { managerCanManageItems: true } });
  return station?.managerCanManageItems ?? false;
}

itemRouter.post("/", requireRole("OWNER", "MANAGER"), async (req, res) => {
  if (!(await canManageItems(req.auth!))) {
    return res.status(403).json({ error: "O dono da rede não liberou o cadastro de itens para gerentes." });
  }
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const item = await prisma.item.create({
    data: { ...parsed.data, networkId: req.auth!.networkId! },
  });
  return res.status(201).json(item);
});

// Qualquer usuário autenticado da rede pode listar os itens (para montar metas/lançamentos). Por
// padrão só os ativos; ?includeInactive=true (tela de administração) traz também os desativados.
itemRouter.get("/", async (req, res) => {
  const includeInactive = req.query.includeInactive === "true";
  const items = await prisma.item.findMany({
    where: { networkId: req.auth!.networkId!, ...(includeInactive ? {} : { active: true }) },
    orderBy: { name: "asc" },
  });
  return res.json(items);
});

itemRouter.patch("/:id", requireRole("OWNER", "MANAGER"), async (req, res) => {
  if (!(await canManageItems(req.auth!))) {
    return res.status(403).json({ error: "O dono da rede não liberou a edição de itens para gerentes." });
  }
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

// Exclui um item de verdade só se ele nunca foi usado em nenhuma meta (histórico intacto). Se já
// tiver meta vinculada (mesmo de período fechado), recusa e sugere desativar em vez de excluir.
itemRouter.delete("/:id", requireRole("OWNER", "MANAGER"), async (req, res) => {
  if (!(await canManageItems(req.auth!))) {
    return res.status(403).json({ error: "O dono da rede não liberou a exclusão de itens para gerentes." });
  }
  const item = await prisma.item.findUnique({ where: { id: req.params.id } });
  if (!item || item.networkId !== req.auth!.networkId) {
    return res.status(404).json({ error: "Item não encontrado." });
  }

  const goalsCount = await prisma.goal.count({ where: { itemId: item.id } });
  if (goalsCount > 0) {
    return res.status(409).json({
      error: "Este item já tem metas cadastradas (inclusive de períodos passados) e não pode ser excluído. Desative-o em vez de excluir.",
    });
  }

  await prisma.item.delete({ where: { id: item.id } });
  return res.status(204).send();
});
