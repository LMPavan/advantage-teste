import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

export const stationRouter = Router();
stationRouter.use(requireAuth);

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

  const station = await prisma.$transaction(async (tx) => {
    const station = await tx.station.create({
      data: { name, code, address, networkId },
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
      include: { manager: { select: { id: true, name: true, email: true } }, redemptionPolicy: true, _count: { select: { attendants: true } } },
      orderBy: { createdAt: "asc" },
    });
    return res.json(stations);
  }

  if (!stationId) return res.json([]);
  const station = await prisma.station.findUnique({
    where: { id: stationId },
    include: { manager: { select: { id: true, name: true, email: true } }, redemptionPolicy: true, _count: { select: { attendants: true } } },
  });
  return res.json(station ? [station] : []);
});

stationRouter.get("/:id", async (req, res) => {
  const station = await prisma.station.findUnique({
    where: { id: req.params.id },
    include: { manager: { select: { id: true, name: true, email: true } }, redemptionPolicy: true },
  });
  if (!station) return res.status(404).json({ error: "Posto não encontrado." });

  const { role, networkId, stationId } = req.auth!;
  if (role === "OWNER" && station.networkId !== networkId) {
    return res.status(403).json({ error: "Sem acesso a este posto." });
  }
  if (role !== "OWNER" && station.id !== stationId) {
    return res.status(403).json({ error: "Sem acesso a este posto." });
  }

  return res.json(station);
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

  const policy = await prisma.redemptionPolicy.upsert({
    where: { stationId: station.id },
    update: parsed.data,
    create: { stationId: station.id, ...parsed.data },
  });

  return res.json(policy);
});
