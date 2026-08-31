import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { signToken } from "../utils/jwt";

export const authRouter = Router();

// Aceita tanto um data URI (foto redimensionada no navegador) quanto uma URL http(s).
// Limite generoso o bastante para um avatar comprimido em JPEG, mas evita payloads abusivos.
const photoUrlSchema = z.string().max(300_000).optional();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerOwnerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  networkName: z.string().min(1),
  photoUrl: photoUrlSchema,
});

// Cadastro inicial: cria o dono do posto/rede e a própria rede em uma única operação.
authRouter.post("/register-owner", async (req, res) => {
  const parsed = registerOwnerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const { name, email, password, networkName, photoUrl } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Já existe um usuário com este e-mail." });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { user, network } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, passwordHash, role: "OWNER", photoUrl },
    });
    const network = await tx.network.create({
      data: { name: networkName, ownerId: user.id },
    });
    return { user, network };
  });

  const token = signToken({ userId: user.id, role: user.role, networkId: network.id, stationId: null });

  return res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      photoUrl: user.photoUrl,
      networkId: network.id,
      stationId: null,
    },
  });
});

const registerWithCodeSchema = z.object({
  role: z.enum(["MANAGER", "ATTENDANT"]),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  inviteCode: z.string().min(1),
  photoUrl: photoUrlSchema,
});

// Auto-cadastro de gerente ou frentista a partir do código de convite compartilhado pelo posto.
authRouter.post("/register", async (req, res) => {
  const parsed = registerWithCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const { role, name, email, password, inviteCode, photoUrl } = parsed.data;
  const code = inviteCode.trim().toUpperCase();

  const station = await prisma.station.findFirst({
    where: role === "MANAGER" ? { managerInviteCode: code } : { attendantInviteCode: code },
  });
  if (!station) {
    return res.status(400).json({ error: "Código de convite inválido." });
  }
  if (role === "MANAGER" && station.managerId) {
    return res.status(409).json({ error: "Este posto já possui um gerente. Fale com o dono da rede." });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Já existe um usuário com este e-mail." });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.$transaction(async (tx) => {
    // stationId identifica frentistas (relação Station.attendants); o gerente é vinculado
    // via Station.managerId, então não deve ocupar essa mesma coluna.
    const user = await tx.user.create({
      data: { name, email, passwordHash, role, photoUrl, stationId: role === "ATTENDANT" ? station.id : undefined },
    });
    if (role === "MANAGER") {
      await tx.station.update({ where: { id: station.id }, data: { managerId: user.id } });
    }
    return user;
  });

  const token = signToken({ userId: user.id, role: user.role, networkId: station.networkId, stationId: station.id });

  return res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      photoUrl: user.photoUrl,
      networkId: station.networkId,
      stationId: station.id,
    },
  });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { ownedNetwork: true, managedStation: true },
  });
  if (!user) {
    return res.status(401).json({ error: "Credenciais inválidas." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Credenciais inválidas." });
  }

  const networkId =
    user.ownedNetwork?.id ??
    user.managedStation?.networkId ??
    (user.stationId
      ? (await prisma.station.findUnique({ where: { id: user.stationId } }))?.networkId ?? null
      : null);

  const stationId = user.managedStation?.id ?? user.stationId ?? null;

  const token = signToken({
    userId: user.id,
    role: user.role,
    networkId,
    stationId,
  });

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      photoUrl: user.photoUrl,
      networkId,
      stationId,
    },
  });
});

authRouter.get("/me", async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token ausente." });
  }
  try {
    const { verifyToken } = await import("../utils/jwt");
    const payload = verifyToken(header.slice("Bearer ".length));
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return res.status(401).json({ error: "Usuário não encontrado." });
    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      photoUrl: user.photoUrl,
      networkId: payload.networkId,
      stationId: payload.stationId,
    });
  } catch {
    return res.status(401).json({ error: "Token inválido." });
  }
});
