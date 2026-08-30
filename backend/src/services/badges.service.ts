import { prisma } from "../prisma";
import { computeGoalProgress } from "./commission.service";
import { getAttendantRanking, previousMonthRange } from "./ranking.service";

export interface Badge {
  id: string;
  label: string;
  description: string;
  icon: string;
  achieved: boolean;
}

const COMMISSION_MILESTONES = [
  { id: "commission-first", amount: 0.01, label: "Primeira comissão", icon: "🎉", description: "Gerou sua primeira comissão." },
  { id: "commission-100", amount: 100, label: "R$100 em comissão", icon: "💵", description: "Acumulou R$100 em comissão (histórico)." },
  { id: "commission-500", amount: 500, label: "R$500 em comissão", icon: "💰", description: "Acumulou R$500 em comissão (histórico)." },
  { id: "commission-1000", amount: 1000, label: "R$1.000 em comissão", icon: "🏦", description: "Acumulou R$1.000 em comissão (histórico)." },
  { id: "commission-5000", amount: 5000, label: "R$5.000 em comissão", icon: "💎", description: "Acumulou R$5.000 em comissão (histórico)." },
];

function longestDailyStreak(dates: Date[]): number {
  const days = Array.from(new Set(dates.map((d) => d.toISOString().slice(0, 10)))).sort();
  let longest = days.length > 0 ? 1 : 0;
  let current = longest;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1]);
    const curr = new Date(days[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    current = diffDays === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

/** Calcula as conquistas (medalhas) de um frentista a partir do histórico completo de metas, lançamentos e resgates. */
export async function computeAttendantBadges(attendantId: string, stationId: string): Promise<Badge[]> {
  const goals = await prisma.goal.findMany({ where: { attendantId }, include: { item: true } });
  const progresses = await Promise.all(goals.map((g) => computeGoalProgress(g.id)));

  const totalCommission = progresses.reduce((sum, p) => sum + p.commissionAmount, 0);
  const anyGoalHit = progresses.some((p) => p.achievementPercent >= 100);
  const mixGoalHit = goals.some((g, i) => g.item.calculationType === "MIX_RATIO" && progresses[i].achievementPercent >= 100);

  const prevRange = previousMonthRange();
  const prevMonthGoalIndexes = goals
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => g.startDate <= prevRange.end && g.endDate >= prevRange.start);
  const perfectMonth =
    prevMonthGoalIndexes.length > 0 && prevMonthGoalIndexes.every(({ i }) => progresses[i].achievementPercent >= 100);

  const stationRanking = await getAttendantRanking(stationId, prevRange);
  const ownRank = stationRanking.findIndex((r) => r.attendantId === attendantId) + 1;
  const wasChampion = ownRank === 1;
  const wasPodium = ownRank >= 1 && ownRank <= 3;

  const entryDates = await prisma.entry.findMany({ where: { attendantId }, select: { date: true } });
  const streak = longestDailyStreak(entryDates.map((e) => e.date));

  const paidRedemptions = await prisma.redemption.count({ where: { attendantId, status: "PAID" } });

  const badges: Badge[] = [
    ...COMMISSION_MILESTONES.map((m) => ({
      id: m.id,
      label: m.label,
      description: m.description,
      icon: m.icon,
      achieved: totalCommission >= m.amount,
    })),
    {
      id: "goal-hit",
      label: "Meta batida",
      description: "Atingiu 100% ou mais em pelo menos uma meta.",
      icon: "🎯",
      achieved: anyGoalHit,
    },
    {
      id: "mix-master",
      label: "Mestre do mix",
      description: "Bateu a meta de mix de aditivada.",
      icon: "⛽",
      achieved: mixGoalHit,
    },
    {
      id: "perfect-month",
      label: "Mês perfeito",
      description: "Bateu 100% ou mais em todas as metas do mês fechado anterior.",
      icon: "🌟",
      achieved: perfectMonth,
    },
    {
      id: "champion",
      label: "Campeão do mês",
      description: "Foi o 1º colocado do posto no mês fechado anterior.",
      icon: "🥇",
      achieved: wasChampion,
    },
    {
      id: "podium",
      label: "Pódio",
      description: "Ficou entre os 3 primeiros do posto no mês fechado anterior.",
      icon: "🥉",
      achieved: wasPodium,
    },
    {
      id: "streak-5",
      label: "Sequência",
      description: "Lançou vendas em 5 dias seguidos.",
      icon: "🔥",
      achieved: streak >= 5,
    },
    {
      id: "redemption-paid",
      label: "Resgate na conta",
      description: "Teve um resgate marcado como pago.",
      icon: "🏧",
      achieved: paidRedemptions > 0,
    },
  ];

  return badges;
}
