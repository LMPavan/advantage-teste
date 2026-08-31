import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { getStationRanking, StationRankingRow } from "../services/ranking.service";

export const tournamentRouter = Router();
tournamentRouter.use(requireAuth);

const tournamentSchema = z.object({
  title: z.string().min(1),
  prizeDescription: z.string().min(1),
  metric: z.enum(["AVG_ACHIEVEMENT", "TOTAL_COMMISSION"]),
  startAt: z.string(),
  endAt: z.string(),
});

// Torneio entre postos: sempre da rede toda (não escolhe posto), criado pelo dono.
tournamentRouter.post("/", requireRole("OWNER"), async (req, res) => {
  const parsed = tournamentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Dados inválidos.", details: parsed.error.flatten() });
  }
  const data = parsed.data;
  const networkId = req.auth!.networkId!;

  const startAt = new Date(data.startAt);
  const endAt = new Date(`${data.endAt.length === 10 ? data.endAt + "T23:59:59.999Z" : data.endAt}`);
  if (endAt <= startAt) {
    return res.status(400).json({ error: "A data de fim deve ser depois da data de início." });
  }

  const tournament = await prisma.tournament.create({
    data: {
      networkId,
      title: data.title,
      prizeDescription: data.prizeDescription,
      metric: data.metric,
      startAt,
      endAt,
      createdById: req.auth!.userId,
    },
  });

  return res.status(201).json(tournament);
});

type LeaderboardEntry = StationRankingRow & { rank: number };

function sortByMetric(rows: StationRankingRow[], metric: "AVG_ACHIEVEMENT" | "TOTAL_COMMISSION"): LeaderboardEntry[] {
  const sorted = [...rows].sort((a, b) =>
    metric === "TOTAL_COMMISSION" ? b.totalCommission - a.totalCommission : b.avgAchievement - a.avgAchievement
  );
  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

// Lista os torneios da rede (dono vê todos; gerente vê os do próprio posto na rede), com o ranking
// calculado ao vivo a partir das metas do período do torneio — não existe tabela de resultado.
tournamentRouter.get("/", requireRole("OWNER", "MANAGER"), async (req, res) => {
  const networkId = req.auth!.networkId!;
  const tournaments = await prisma.tournament.findMany({
    where: { networkId },
    orderBy: { endAt: "desc" },
  });

  const now = new Date();
  const decorated = await Promise.all(
    tournaments.map(async (t) => {
      const rows = await getStationRanking(networkId, { start: t.startAt, end: t.endAt });
      const leaderboard = sortByMetric(
        rows.filter((r) => r.attendantsCount > 0),
        t.metric
      );
      const ended = now > t.endAt;
      return {
        id: t.id,
        title: t.title,
        prizeDescription: t.prizeDescription,
        metric: t.metric,
        startAt: t.startAt,
        endAt: t.endAt,
        status: ended ? "FINISHED" : "ACTIVE",
        leaderboard,
        winnerStationId: ended && leaderboard.length > 0 ? leaderboard[0].stationId : null,
      };
    })
  );

  return res.json(decorated);
});
