import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../prisma";
import { signToken } from "../utils/jwt";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerOwnerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  networkName: z.string().min(1),
});

// Cadastro inicial: cria o dono do posto/rede e a própria rede em uma única operação.
authRouter.post("/register-owner", async (req, res) => {
  const parsed = registerOwnerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const { name, email, password, networkName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Já existe um usuário com este e-mail." });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { user, network } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, passwordHash, role: "OWNER" },
    });
    const network = await tx.network.create({
      data: { name: networkName, ownerId: user.id },
    });
    return { user, network };
  });

  const token = signToken({ userId: user.id, role: user.role, networkId: network.id, stationId: null });

  return res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, networkId: network.id, stationId: null },
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
      networkId: payload.networkId,
      stationId: payload.stationId,
    });
  } catch {
    return res.status(401).json({ error: "Token inválido." });
  }
});
