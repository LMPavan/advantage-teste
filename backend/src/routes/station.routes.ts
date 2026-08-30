import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { generateInviteCode } from "../utils/inviteCode";

export const stationRouter = Router();
stationRouter.use(requireAuth);

/** Gera um par de códigos de convite (gerente/frentista) garantindo que não colidam com códigos existentes. */
async function generateUniqueInviteCodes() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const managerInviteCode = generateInviteCode();
    const attendantInviteCode = generateInviteCode();
    const clash = await prisma.station.findFirst({
      where: { OR: [{ managerInviteCode }, { attendantInviteCode }] },
      select: { id: true },
    });
    if (!clash) return { managerInviteCode, attendantInviteCode };
  }
  throw new Error("Não foi possível gerar códigos de convite únicos. Tente novamente.");
}

/** Remove os códigos de convite da resposta quando quem consulta é um frentista (não precisa deles). */
function withCodesVisibleTo<T extends { managerInviteCode?: string; attendantInviteCode?: string }>(
  station: T,
  role: string
): T {
  if (role === "ATTENDANT") {
    const { managerInviteCode, attendantInviteCode, ...rest } = station;
    return rest as T;
  }
  return station;
}

const createStationSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  address: z.string().optional(),
  manager: z
    .object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
    })
    .optional(),
});

// OWNER cria um novo posto na sua rede, opcionalmente já criando o gerente responsável.
stationRouter.post("/", requireRole("OWNER"), async (req, res) => {
  const parsed = createStationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const { name, code, address, manager } = parsed.data;
  const networkId = req.auth!.networkId!;
  const inviteCodes = await generateUniqueInviteCodes();

  const station = await prisma.$transaction(async (tx) => {
    const station = await tx.station.create({
      data: { name, code, address, networkId, ...inviteCodes },
    });

    if (manager) {
      const existing = await tx.user.findUnique({ where: { email: manager.email } });
      if (existing) throw new Error("EMAIL_IN_USE");
      const passwordHash = await bcrypt.hash(manager.password, 10);
      const managerUser = await tx.user.create({
        data: { name: manager.name, email: manager.email, passwordHash, role: "MANAGER" },
      });
      await tx.station.update({ where: { id: station.id }, data: { managerId: managerUser.id } });
    }

    await tx.redemptionPolicy.create({
      data: { stationId: station.id, allowDaily: false, allowWeekly: true, allowMonthly: true },
    });

    return tx.station.findUniqueOrThrow({
      where: { id: station.id },
      include: { manager: { select: { id: true, name: true, email: true } }, redemptionPolicy: true },
    });
  }).catch((err) => {
    if (err instanceof Error && err.message === "EMAIL_IN_USE") return null;
    throw err;
  });

  if (!station) {
    return res.status(409).json({ error: "Já existe um usuário com este e-mail." });
  }

  return res.status(201).json(station);
});

// Lista postos: OWNER vê todos os postos da rede; MANAGER/ATTENDANT veem apenas o seu.
stationRouter.get("/", async (req, res) => {
  const { role, networkId, stationId } = req.auth!;

  if (role === "OWNER") {
    const stations = await prisma.station.findMany({
      where: { networkId: networkId! },
      include: { manager: { select: { id: true, name: true, email: true, photoUrl: true } }, redemptionPolicy: true, _count: { select: { attendants: true } } },
      orderBy: { createdAt: "asc" },
    });
    return res.json(stations.map((s) => withCodesVisibleTo(s, role)));
  }

  if (!stationId) return res.json([]);
  const station = await prisma.station.findUnique({
    where: { id: stationId },
    include: { manager: { select: { id: true, name: true, email: true, photoUrl: true } }, redemptionPolicy: true, _count: { select: { attendants: true } } },
  });
  return res.json(station ? [withCodesVisibleTo(station, role)] : []);
});

stationRouter.get("/:id", async (req, res) => {
  const station = await prisma.station.findUnique({
    where: { id: req.params.id },
    include: { manager: { select: { id: true, name: true, email: true, photoUrl: true } }, redemptionPolicy: true },
  });
  if (!station) return res.status(404).json({ error: "Posto não encontrado." });

  const { role, networkId, stationId } = req.auth!;
  if (role === "OWNER" && station.networkId !== networkId) {
    return res.status(403).json({ error: "Sem acesso a este posto." });
  }
  if (role !== "OWNER" && station.id !== stationId) {
    return res.status(403).json({ error: "Sem acesso a este posto." });
  }

  return res.json(withCodesVisibleTo(station, role));
});

const updatePolicySchema = z.object({
  allowDaily: z.boolean().optional(),
  allowWeekly: z.boolean().optional(),
  allowMonthly: z.boolean().optional(),
});

// OWNER (ou o próprio gerente do posto) define quais periodicidades de resgate estão liberadas.
stationRouter.patch("/:id/redemption-policy", requireRole("OWNER", "MANAGER"), async (req, res) => {
  const parsed = updatePolicySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }

  const station = await prisma.station.findUnique({ where: { id: req.params.id } });
  if (!station) return res.status(404).json({ error: "Posto não encontrado." });

  const { role, networkId, stationId } = req.auth!;
  if (role === "OWNER" && station.networkId !== networkId) {
    return res.status(403).json({ error: "Sem acesso a este posto." });
  }
  if (role === "MANAGER" && station.id !== stationId) {
    return res.status(403).json({ error: "Sem acesso a este posto." });
  }
  if (role === "MANAGER" && !station.managerCanManageRedemptionPolicy) {
    return res.status(403).json({ error: "O dono da rede não liberou a gestão da política de resgate para gerentes neste posto." });
  }

  const policy = await prisma.redemptionPolicy.upsert({
    where: { stationId: station.id },
    update: parsed.data,
    create: { stationId: station.id, ...parsed.data },
  });

  return res.json(policy);
});

const regenerateCodeSchema = z.object({
  type: z.enum(["MANAGER", "ATTENDANT"]),
});

// Regenera um código de convite (invalida o anterior). OWNER pode regenerar qualquer um dos
// códigos de qualquer posto da rede; MANAGER só pode regenerar o código de frentista do próprio posto.
stationRouter.post("/:id/invite-codes/regenerate", requireRole("OWNER", "MANAGER"), async (req, res) => {
  const parsed = regenerateCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }

  const station = await prisma.station.findUnique({ where: { id: req.params.id } });
  if (!station) return res.status(404).json({ error: "Posto não encontrado." });

  const { role, networkId, stationId } = req.auth!;
  if (role === "OWNER" && station.networkId !== networkId) {
    return res.status(403).json({ error: "Sem acesso a este posto." });
  }
  if (role === "MANAGER") {
    if (station.id !== stationId) {
      return res.status(403).json({ error: "Sem acesso a este posto." });
    }
    if (parsed.data.type !== "ATTENDANT") {
      return res.status(403).json({ error: "Apenas o dono da rede pode regenerar o código de gerente." });
    }
    if (!station.managerCanRegenerateInviteCode) {
      return res.status(403).json({ error: "O dono da rede não liberou a regeneração do código de convite para gerentes neste posto." });
    }
  }

  let newCode = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateInviteCode();
    const clash = await prisma.station.findFirst({
      where: { OR: [{ managerInviteCode: candidate }, { attendantInviteCode: candidate }] },
      select: { id: true },
    });
    if (!clash) {
      newCode = candidate;
      break;
    }
  }
  if (!newCode) return res.status(500).json({ error: "Não foi possível gerar um novo código. Tente novamente." });

  const updated = await prisma.station.update({
    where: { id: station.id },
    data: parsed.data.type === "MANAGER" ? { managerInviteCode: newCode } : { attendantInviteCode: newCode },
  });

  return res.json({
    managerInviteCode: updated.managerInviteCode,
    attendantInviteCode: updated.attendantInviteCode,
  });
});

const permissionsSchema = z.object({
  managerCanManageGoals: z.boolean().optional(),
  managerCanManageTeam: z.boolean().optional(),
  managerCanManageRedemptionPolicy: z.boolean().optional(),
  managerCanRegenerateInviteCode: z.boolean().optional(),
});

// Só o dono da rede decide quais ações ficam liberadas para o gerente deste posto.
stationRouter.patch("/:id/permissions", requireRole("OWNER"), async (req, res) => {
  const parsed = permissionsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }

  const station = await prisma.station.findUnique({ where: { id: req.params.id } });
  if (!station) return res.status(404).json({ error: "Posto não encontrado." });
  if (station.networkId !== req.auth!.networkId) {
    return res.status(403).json({ error: "Sem acesso a este posto." });
  }

  const updated = await prisma.station.update({ where: { id: station.id }, data: parsed.data });
  return res.json({
    managerCanManageGoals: updated.managerCanManageGoals,
    managerCanManageTeam: updated.managerCanManageTeam,
    managerCanManageRedemptionPolicy: updated.managerCanManageRedemptionPolicy,
    managerCanRegenerateInviteCode: updated.managerCanRegenerateInviteCode,
  });
});
