import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { aggregateEntries, computeActualValue, round2 } from "../services/commission.service";

export const challengeRouter = Router();
challengeRouter.use(requireAuth);

/** Soma os lançamentos de um frentista para um item, dentro da janela do desafio. */
async function computeRealized(
  attendantId: string,
  itemId: string,
  item: { calculationType: "SIMPLE" | "MIX_RATIO" },
  startAt: Date,
  endAt: Date
): Promise<number> {
  const entries = await prisma.entry.findMany({
    where: {
      attendantId,
      date: { gte: startAt, lte: endAt },
      goal: { itemId },
    },
  });
  const agg = aggregateEntries(entries);
  return round2(computeActualValue(item, agg));
}

type ChallengeStatus = "ACTIVE" | "WON" | "LOST" | "EXPIRED";

function computeStatus(
  type: "SOLO" | "DUEL",
  ended: boolean,
  myValue: number,
  targetValue: number | null,
  opponentValue: number | null
): ChallengeStatus {
  if (type === "SOLO") {
    if (targetValue !== null && myValue >= targetValue) return "WON";
    return ended ? "EXPIRED" : "ACTIVE";
  }
  // DUEL: só decide no fim
  if (!ended) return "ACTIVE";
  const opp = opponentValue ?? 0;
  if (myValue > opp) return "WON";
  if (myValue < opp) return "LOST";
  return "EXPIRED"; // empate
}

const challengeSchema = z.object({
  stationId: z.string().optional(),
  itemId: z.string().min(1),
  type: z.enum(["SOLO", "DUEL"]),
  title: z.string().min(1),
  attendantId: z.string().min(1),
  opponentId: z.string().optional(),
  targetValue: z.number().positive().optional(),
  bonusAmount: z.number().positive(),
  startAt: z.string(),
  endAt: z.string(),
});

// MANAGER cria desafios/duelos para o próprio posto. OWNER pode em qualquer posto da rede.
challengeRouter.post("/", requireRole("MANAGER", "OWNER"), async (req, res) => {
  const parsed = challengeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const data = parsed.data;
  const { role, stationId: authStationId, networkId } = req.auth!;

  const targetStationId = role === "MANAGER" ? authStationId : data.stationId;
  if (!targetStationId) {
    return res.status(400).json({ error: "Informe o posto (stationId) do desafio." });
  }

  const station = await prisma.station.findUnique({ where: { id: targetStationId } });
  if (!station) return res.status(404).json({ error: "Posto não encontrado." });
  if (role === "OWNER" && station.networkId !== networkId) {
    return res.status(403).json({ error: "Sem acesso a este posto." });
  }
  if (role === "MANAGER" && !station.managerCanManageGoals) {
    return res.status(403).json({ error: "O dono da rede não liberou o cadastro de metas/desafios para gerentes neste posto." });
  }

  const item = await prisma.item.findUnique({ where: { id: data.itemId } });
  if (!item || item.networkId !== station.networkId) {
    return res.status(400).json({ error: "Item inválido para esta rede." });
  }

  const attendant = await prisma.user.findUnique({ where: { id: data.attendantId } });
  if (!attendant || attendant.role !== "ATTENDANT" || attendant.stationId !== targetStationId) {
    return res.status(400).json({ error: "Frentista inválido para este posto." });
  }

  if (data.type === "SOLO" && data.targetValue === undefined) {
    return res.status(400).json({ error: "Informe o valor-alvo (targetValue) do desafio solo." });
  }
  if (data.type === "DUEL") {
    if (!data.opponentId || data.opponentId === data.attendantId) {
      return res.status(400).json({ error: "Informe um adversário (opponentId) diferente do desafiante." });
    }
    const opponent = await prisma.user.findUnique({ where: { id: data.opponentId } });
    if (!opponent || opponent.role !== "ATTENDANT" || opponent.stationId !== targetStationId) {
      return res.status(400).json({ error: "Adversário inválido para este posto." });
    }
  }

  const startAt = new Date(data.startAt);
  const endAt = new Date(`${data.endAt.length === 10 ? data.endAt + "T23:59:59.999Z" : data.endAt}`);

  const challenge = await prisma.challenge.create({
    data: {
      stationId: targetStationId,
      itemId: data.itemId,
      type: data.type,
      title: data.title,
      attendantId: data.attendantId,
      opponentId: data.type === "DUEL" ? data.opponentId : undefined,
      targetValue: data.type === "SOLO" ? data.targetValue : undefined,
      bonusAmount: data.bonusAmount,
      startAt,
      endAt,
      createdById: req.auth!.userId,
    },
  });

  return res.status(201).json(challenge);
});

// Lista desafios: ATTENDANT vê os seus (como desafiante ou adversário); MANAGER vê os do posto;
// OWNER vê os da rede (opcionalmente ?stationId=). Cada desafio já vem com o progresso calculado.
challengeRouter.get("/", async (req, res) => {
  const { role, userId, stationId, networkId } = req.auth!;

  let where: any = {};
  if (role === "ATTENDANT") {
    where = { OR: [{ attendantId: userId }, { opponentId: userId }] };
  } else if (role === "MANAGER") {
    where = { stationId };
  } else {
    const filterStationId = req.query.stationId as string | undefined;
    if (filterStationId) {
      where = { stationId: filterStationId };
    } else {
      const stations = await prisma.station.findMany({ where: { networkId: networkId! }, select: { id: true } });
      where = { stationId: { in: stations.map((s) => s.id) } };
    }
  }

  const challenges = await prisma.challenge.findMany({
    where,
    include: {
      item: true,
      station: { select: { id: true, name: true } },
      attendant: { select: { id: true, name: true, photoUrl: true } },
      opponent: { select: { id: true, name: true, photoUrl: true } },
    },
    orderBy: { endAt: "desc" },
  });

  const now = new Date();
  const decorated = await Promise.all(
    challenges.map(async (c) => {
      const myValue = await computeRealized(c.attendantId, c.itemId, c.item, c.startAt, c.endAt);
      const opponentValue = c.opponentId ? await computeRealized(c.opponentId, c.itemId, c.item, c.startAt, c.endAt) : null;
      const ended = now > c.endAt;
      const status = computeStatus(c.type, ended, myValue, c.targetValue ? Number(c.targetValue) : null, opponentValue);
      return {
        ...c,
        targetValue: c.targetValue ? Number(c.targetValue) : null,
        bonusAmount: Number(c.bonusAmount),
        myValue,
        opponentValue,
        status,
      };
    })
  );

  return res.json(decorated);
});
