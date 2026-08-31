import { prisma } from "../prisma";
import { computeGoalProgress, round2 } from "./commission.service";
import { computeAttendantBadges } from "./badges.service";

export interface XpLevel {
  name: string;
  min: number;
}

// Progressão de longo prazo, separada do ranking mensal: acumula pra sempre, não zera todo mês.
export const XP_LEVELS: XpLevel[] = [
  { name: "Bronze", min: 0 },
  { name: "Prata", min: 500 },
  { name: "Ouro", min: 1500 },
  { name: "Platina", min: 3500 },
  { name: "Diamante", min: 7000 },
];

export interface XpSummary {
  xp: number;
  goalsHitAllTime: number;
  badgesAchieved: number;
  level: string;
  levelIndex: number;
  nextLevel: string | null;
  nextLevelAt: number | null;
  progressToNextPercent: number;
}

/**
 * XP acumulado de todo o histórico do frentista: 100 por meta batida (achievementPercent >= 100,
 * em qualquer período, aberto ou fechado) + 50 por conquista (badge) alcançada. Convertido num nível
 * fixo (Bronze → Diamante) que só sobe, nunca desce — diferente do ranking mensal.
 */
export async function computeAttendantXp(attendantId: string, stationId: string): Promise<XpSummary> {
  const goals = await prisma.goal.findMany({ where: { attendantId }, select: { id: true } });
  const progresses = await Promise.all(goals.map((g) => computeGoalProgress(g.id)));
  const goalsHitAllTime = progresses.filter((p) => p.achievementPercent >= 100).length;

  const badges = await computeAttendantBadges(attendantId, stationId);
  const badgesAchieved = badges.filter((b) => b.achieved).length;

  const xp = goalsHitAllTime * 100 + badgesAchieved * 50;

  let levelIndex = 0;
  for (let i = 0; i < XP_LEVELS.length; i++) {
    if (xp >= XP_LEVELS[i].min) levelIndex = i;
  }
  const level = XP_LEVELS[levelIndex];
  const next = XP_LEVELS[levelIndex + 1] ?? null;
  const progressToNextPercent = next
    ? round2(Math.min(100, ((xp - level.min) / (next.min - level.min)) * 100))
    : 100;

  return {
    xp,
    goalsHitAllTime,
    badgesAchieved,
    level: level.name,
    levelIndex,
    nextLevel: next?.name ?? null,
    nextLevelAt: next?.min ?? null,
    progressToNextPercent,
  };
}
