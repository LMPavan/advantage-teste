import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

export const messageRouter = Router();
messageRouter.use(requireAuth);

const targetTypeSchema = z.enum(["USER", "STATION_TEAM", "NETWORK_MANAGERS", "NETWORK_ATTENDANTS", "NETWORK_ALL"]);

const sendMessageSchema = z.object({
  targetType: targetTypeSchema,
  targetId: z.string().optional(),
  body: z.string().min(1).max(4000),
});

// Dono manda para um gerente/frentista específico, para a equipe de um posto, para todos os
// gerentes, todos os frentistas ou toda a rede. Gerente só manda para um frentista específico do
// próprio posto ou para toda a sua equipe.
messageRouter.post("/", requireRole("OWNER", "MANAGER"), async (req, res) => {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const { role, userId, networkId, stationId } = req.auth!;
  const { targetType, targetId, body } = parsed.data;

  if (role === "MANAGER" && targetType !== "USER" && targetType !== "STATION_TEAM") {
    return res.status(403).json({ error: "Gerentes só podem enviar mensagens para a própria equipe." });
  }

  let recipientIds: string[] = [];
  let audienceLabel = "";

  if (targetType === "USER") {
    if (!targetId) return res.status(400).json({ error: "Informe o destinatário." });
    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target || target.role === "OWNER") {
      return res.status(400).json({ error: "Destinatário inválido." });
    }
    if (role === "MANAGER") {
      if (target.role !== "ATTENDANT" || target.stationId !== stationId) {
        return res.status(403).json({ error: "Você só pode mandar mensagem para frentistas do seu posto." });
      }
    } else {
      const targetNetworkId =
        target.role === "MANAGER"
          ? (await prisma.station.findUnique({ where: { managerId: target.id } }))?.networkId
          : (await prisma.station.findUnique({ where: { id: target.stationId ?? "" } }))?.networkId;
      if (targetNetworkId !== networkId) {
        return res.status(403).json({ error: "Destinatário fora da sua rede." });
      }
    }
    recipientIds = [target.id];
    audienceLabel = `Direto para ${target.name}`;
  } else if (targetType === "STATION_TEAM") {
    const targetStationId = role === "MANAGER" ? stationId! : targetId;
    if (!targetStationId) return res.status(400).json({ error: "Informe o posto." });
    const station = await prisma.station.findUnique({ where: { id: targetStationId } });
    if (!station || (role === "OWNER" && station.networkId !== networkId)) {
      return res.status(403).json({ error: "Posto inválido." });
    }
    if (role === "MANAGER" && station.id !== stationId) {
      return res.status(403).json({ error: "Você só pode mandar mensagem para a sua própria equipe." });
    }
    const attendants = await prisma.user.findMany({ where: { role: "ATTENDANT", stationId: station.id }, select: { id: true } });
    recipientIds = attendants.map((a) => a.id);
    audienceLabel = `Equipe do posto ${station.name}`;
  } else {
    // NETWORK_MANAGERS / NETWORK_ATTENDANTS / NETWORK_ALL — apenas OWNER (já barrado acima para MANAGER)
    const stations = await prisma.station.findMany({ where: { networkId: networkId! } });
    const managerIds = stations.map((s) => s.managerId).filter((id): id is string => !!id);
    const attendants = await prisma.user.findMany({
      where: { role: "ATTENDANT", stationId: { in: stations.map((s) => s.id) } },
      select: { id: true },
    });
    const attendantIds = attendants.map((a) => a.id);

    if (targetType === "NETWORK_MANAGERS") {
      recipientIds = managerIds;
      audienceLabel = "Todos os gerentes da rede";
    } else if (targetType === "NETWORK_ATTENDANTS") {
      recipientIds = attendantIds;
      audienceLabel = "Todos os frentistas da rede";
    } else {
      recipientIds = [...managerIds, ...attendantIds];
      audienceLabel = "Toda a rede";
    }
  }

  recipientIds = Array.from(new Set(recipientIds));
  if (recipientIds.length === 0) {
    return res.status(400).json({ error: "Nenhum destinatário encontrado para este envio." });
  }

  const message = await prisma.message.create({
    data: {
      senderId: userId,
      networkId: networkId!,
      audienceLabel,
      body,
      recipients: { create: recipientIds.map((id) => ({ userId: id })) },
    },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  return res.status(201).json({ ...message, recipientsCount: recipientIds.length });
});

// Caixa de entrada do usuário logado: todas as mensagens recebidas (diretas ou em massa), mais recentes primeiro.
messageRouter.get("/", async (req, res) => {
  const recipients = await prisma.messageRecipient.findMany({
    where: { userId: req.auth!.userId },
    include: {
      message: {
        include: { sender: { select: { id: true, name: true, role: true, photoUrl: true } } },
      },
    },
    orderBy: { message: { createdAt: "desc" } },
  });

  return res.json(
    recipients.map((r) => ({
      id: r.message.id,
      body: r.message.body,
      audienceLabel: r.message.audienceLabel,
      createdAt: r.message.createdAt,
      sender: r.message.sender,
      readAt: r.readAt,
    }))
  );
});

// Opções de destinatário para montar o formulário de composição, de acordo com o papel de quem envia.
messageRouter.get("/recipients", requireRole("OWNER", "MANAGER"), async (req, res) => {
  const { role, networkId, stationId } = req.auth!;

  if (role === "MANAGER") {
    const attendants = await prisma.user.findMany({
      where: { role: "ATTENDANT", stationId: stationId! },
      select: { id: true, name: true, role: true },
    });
    return res.json({ users: attendants, stations: [] });
  }

  const stations = await prisma.station.findMany({ where: { networkId: networkId! }, select: { id: true, name: true, managerId: true } });
  const stationIds = stations.map((s) => s.id);
  const [managers, attendants] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: stations.map((s) => s.managerId).filter((id): id is string => !!id) } }, select: { id: true, name: true, role: true } }),
    prisma.user.findMany({ where: { role: "ATTENDANT", stationId: { in: stationIds } }, select: { id: true, name: true, role: true } }),
  ]);

  return res.json({
    users: [...managers, ...attendants],
    stations: stations.map((s) => ({ id: s.id, name: s.name })),
  });
});

// Marca uma mensagem como lida para o usuário logado.
messageRouter.patch("/:id/read", async (req, res) => {
  const updated = await prisma.messageRecipient.updateMany({
    where: { messageId: req.params.id, userId: req.auth!.userId, readAt: null },
    data: { readAt: new Date() },
  });
  return res.json({ updated: updated.count });
});

// Marca todas as mensagens não lidas do usuário logado como lidas (usado ao fechar o pop-up).
messageRouter.post("/read-all", async (req, res) => {
  const updated = await prisma.messageRecipient.updateMany({
    where: { userId: req.auth!.userId, readAt: null },
    data: { readAt: new Date() },
  });
  return res.json({ updated: updated.count });
});
