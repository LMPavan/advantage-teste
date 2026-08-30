import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeGoalProgress } from "../services/commission.service";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

interface AttendantRanking {
  attendantId: string;
  name: string;
  stationId: string;
  stationName: string;
  avgAchievement: number;
  totalCommission: number;
  goalsCount: number;
}

interface StationRanking {
  stationId: string;
  stationName: string;
  managerName: string | null;
  avgAchievement: number;
  totalCommission: number;
  attendantsCount: number;
}

// Visão executiva do dono: ranking de postos/gerentes e de frentistas em toda a rede.
dashboardRouter.get("/executive", requireRole("OWNER"), async (req, res) => {
  const networkId = req.auth!.networkId!;

  const stations = await prisma.station.findMany({
    where: { networkId },
    include: { manager: true, attendants: true },
  });

  const attendantMap = new Map<string, AttendantRanking>();
  const stationRankings: StationRanking[] = [];

  for (const station of stations) {
    const goals = await prisma.goal.findMany({ where: { stationId: station.id } });
    let stationAchievementSum = 0;
    let stationCommissionSum = 0;

    for (const goal of goals) {
      const progress = await computeGoalProgress(goal.id);
      stationAchievementSum += progress.achievementPercent;
      stationCommissionSum += progress.commissionAmount;

      if (goal.attendantId) {
        const attendant = station.attendants.find((a) => a.id === goal.attendantId);
        if (attendant) {
          const current = attendantMap.get(attendant.id) ?? {
            attendantId: attendant.id,
            name: attendant.name,
            stationId: station.id,
            stationName: station.name,
            avgAchievement: 0,
            totalCommission: 0,
            goalsCount: 0,
          };
          current.avgAchievement =
            (current.avgAchievement * current.goalsCount + progress.achievementPercent) / (current.goalsCount + 1);
          current.totalCommission = Math.round((current.totalCommission + progress.commissionAmount) * 100) / 100;
          current.goalsCount += 1;
          attendantMap.set(attendant.id, current);
        }
      }
    }

    stationRankings.push({
      stationId: station.id,
      stationName: station.name,
      managerName: station.manager?.name ?? null,
      avgAchievement: goals.length ? Math.round((stationAchievementSum / goals.length) * 100) / 100 : 0,
      totalCommission: Math.round(stationCommissionSum * 100) / 100,
      attendantsCount: station.attendants.length,
    });
  }

  const attendantRankings = Array.from(attendantMap.values())
    .map((a) => ({ ...a, avgAchievement: Math.round(a.avgAchievement * 100) / 100 }))
    .sort((a, b) => b.avgAchievement - a.avgAchievement);

  stationRankings.sort((a, b) => b.avgAchievement - a.avgAchievement);

  return res.json({
    stationsCount: stations.length,
    totalCommission: Math.round(stationRankings.reduce((sum, s) => sum + s.totalCommission, 0) * 100) / 100,
    stationRankings,
    attendantRankings,
  });
});

// Visão do gerente: desempenho consolidado da equipe do próprio posto.
dashboardRouter.get("/team", requireRole("MANAGER"), async (req, res) => {
  const stationId = req.auth!.stationId!;

  const attendants = await prisma.user.findMany({ where: { role: "ATTENDANT", stationId } });
  const goals = await prisma.goal.findMany({ where: { stationId }, include: { item: true } });

  const results = await Promise.all(
    attendants.map(async (attendant) => {
      const attendantGoals = goals.filter((g) => g.attendantId === attendant.id);
      const progresses = await Promise.all(attendantGoals.map((g) => computeGoalProgress(g.id)));
      const avgAchievement = progresses.length
        ? Math.round((progresses.reduce((s, p) => s + p.achievementPercent, 0) / progresses.length) * 100) / 100
        : 0;
      const totalCommission = Math.round(progresses.reduce((s, p) => s + p.commissionAmount, 0) * 100) / 100;
      return {
        attendantId: attendant.id,
        name: attendant.name,
        goalsCount: attendantGoals.length,
        avgAchievement,
        totalCommission,
      };
    })
  );

  results.sort((a, b) => b.avgAchievement - a.avgAchievement);
  return res.json({ stationId, attendants: results });
});
