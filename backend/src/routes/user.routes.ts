import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

export const userRouter = Router();
userRouter.use(requireAuth);

const createAttendantSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  stationId: z.string().optional(),
});

// MANAGER cria frentistas para o seu posto. OWNER também pode, informando stationId.
userRouter.post("/attendants", requireRole("MANAGER", "OWNER"), async (req, res) => {
  const parsed = createAttendantSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const { name, email, password, stationId: bodyStationId } = parsed.data;
  const { role, stationId: authStationId, networkId } = req.auth!;

  const targetStationId = role === "MANAGER" ? authStationId : bodyStationId;
  if (!targetStationId) {
    return res.status(400).json({ error: "Informe o posto (stationId) do frentista." });
  }

  const station = await prisma.station.findUnique({ where: { id: targetStationId } });
  if (!station) return res.status(404).json({ error: "Posto não encontrado." });
  if (role === "OWNER" && station.networkId !== networkId) {
    return res.status(403).json({ error: "Sem acesso a este posto." });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Já existe um usuário com este e-mail." });

  const passwordHash = await bcrypt.hash(password, 10);
  const attendant = await prisma.user.create({
    data: { name, email, passwordHash, role: "ATTENDANT", stationId: targetStationId },
  });

  return res.status(201).json({ id: attendant.id, name: attendant.name, email: attendant.email });
});

// Lista a equipe: MANAGER/ATTENDANT veem o time do próprio posto; OWNER pode filtrar por ?stationId=
userRouter.get("/team", async (req, res) => {
  const { role, stationId, networkId } = req.auth!;

  let targetStationId: string | undefined;
  if (role === "OWNER") {
    targetStationId = req.query.stationId as string | undefined;
    if (!targetStationId) {
      const stations = await prisma.station.findMany({ where: { networkId: networkId! }, select: { id: true } });
      const attendants = await prisma.user.findMany({
        where: { role: "ATTENDANT", stationId: { in: stations.map((s) => s.id) } },
        select: { id: true, name: true, email: true, stationId: true, createdAt: true },
      });
      return res.json(attendants);
    }
  } else {
    targetStationId = stationId ?? undefined;
  }

  if (!targetStationId) return res.json([]);
  const attendants = await prisma.user.findMany({
    where: { role: "ATTENDANT", stationId: targetStationId },
    select: { id: true, name: true, email: true, stationId: true, createdAt: true },
    orderBy: { name: "asc" },
  });
  return res.json(attendants);
});
