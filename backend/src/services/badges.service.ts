import { prisma } from "../prisma";
import { computeGoalProgress } from "./commission.service";
import { getAttendantRanking, getNetworkAttendantRanking, previousMonthRange } from "./ranking.service";

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
  { id: "commission-10000", amount: 10000, label: "R$10.000 em comissão", icon: "🏆", description: "Acumulou R$10.000 em comissão (histórico)." },
  { id: "commission-25000", amount: 25000, label: "R$25.000 em comissão", icon: "🚀", description: "Acumulou R$25.000 em comissão (histórico)." },
  { id: "commission-50000", amount: 50000, label: "R$50.000 em comissão", icon: "👑", description: "Acumulou R$50.000 em comissão (histórico)." },
];

const GOALS_HIT_MILESTONES = [
  { id: "goals-10", count: 10, label: "10 metas batidas", icon: "🔟", description: "Bateu 10 metas ou mais (histórico)." },
  { id: "goals-50", count: 50, label: "50 metas batidas", icon: "🏅", description: "Bateu 50 metas ou mais (histórico)." },
  { id: "goals-100", count: 100, label: "100 metas batidas", icon: "💯", description: "Bateu 100 metas ou mais (histórico)." },
];

const REDEMPTION_COUNT_MILESTONES = [
  { id: "redemption-5", count: 5, label: "5 resgates pagos", icon: "🎫", description: "Teve 5 resgates marcados como pagos." },
  { id: "redemption-10", count: 10, label: "10 resgates pagos", icon: "💳", description: "Teve 10 resgates marcados como pagos." },
];

const TENURE_MILESTONES = [
  { id: "tenure-30", days: 30, label: "30 dias de casa", icon: "🏠", description: "Faz parte do time há 30 dias ou mais." },
  { id: "tenure-365", days: 365, label: "1 ano de casa", icon: "🎂", description: "Faz parte do time há 1 ano ou mais." },
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
  const [goals, station, user] = await Promise.all([
    prisma.goal.findMany({ where: { attendantId }, include: { item: true } }),
    prisma.station.findUniqueOrThrow({ where: { id: stationId }, select: { networkId: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: attendantId }, select: { createdAt: true, photoUrl: true } }),
  ]);
  const progresses = await Promise.all(goals.map((g) => computeGoalProgress(g.id)));

  const totalCommission = progresses.reduce((sum, p) => sum + p.commissionAmount, 0);
  const goalsHitCount = progresses.filter((p) => p.achievementPercent >= 100).length;
  const anyGoalHit = goalsHitCount > 0;
  const mixGoalHit = goals.some((g, i) => g.item.calculationType === "MIX_RATIO" && progresses[i].achievementPercent >= 100);
  const overachiever150 = progresses.some((p) => p.achievementPercent >= 150);
  const overachiever200 = progresses.some((p) => p.achievementPercent >= 200);
  const distinctItemsHit = new Set(goals.filter((g, i) => progresses[i].achievementPercent >= 100).map((g) => g.itemId));

  const prevRange = previousMonthRange();
  const prevMonthGoalIndexes = goals
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => g.startDate <= prevRange.end && g.endDate >= prevRange.start);
  const perfectMonth =
    prevMonthGoalIndexes.length > 0 && prevMonthGoalIndexes.every(({ i }) => progresses[i].achievementPercent >= 100);

  const [stationRanking, networkRanking, entryDates, paidRedemptions] = await Promise.all([
    getAttendantRanking(stationId, prevRange),
    getNetworkAttendantRanking(station.networkId, prevRange),
    prisma.entry.findMany({ where: { attendantId }, select: { date: true } }),
    prisma.redemption.findMany({ where: { attendantId, status: "PAID" }, select: { commissionAmount: true } }),
  ]);

  const ownStationRank = stationRanking.findIndex((r) => r.attendantId === attendantId) + 1;
  const wasChampion = ownStationRank === 1;
  const wasPodium = ownStationRank >= 1 && ownStationRank <= 3;

  const ownNetworkRank = networkRanking.findIndex((r) => r.attendantId === attendantId) + 1;
  const wasNetworkChampion = ownNetworkRank === 1;
  const wasNetworkPodium = ownNetworkRank >= 1 && ownNetworkRank <= 3;

  const streak = longestDailyStreak(entryDates.map((e) => e.date));
  const paidRedemptionsCount = paidRedemptions.length;
  const paidRedemptionsTotal = paidRedemptions.reduce((sum, r) => sum + Number(r.commissionAmount), 0);

  const tenureDays = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));

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
    ...GOALS_HIT_MILESTONES.map((m) => ({
      id: m.id,
      label: m.label,
      description: m.description,
      icon: m.icon,
      achieved: goalsHitCount >= m.count,
    })),
    {
      id: "overachiever-150",
      label: "Meta explodida",
      description: "Bateu uma meta com 150% ou mais de atingimento.",
      icon: "💥",
      achieved: overachiever150,
    },
    {
      id: "overachiever-200",
      label: "Meta estratosférica",
      description: "Bateu uma meta com 200% ou mais de atingimento.",
      icon: "🌠",
      achieved: overachiever200,
    },
    {
      id: "mix-master",
      label: "Mestre do mix",
      description: "Bateu a meta de mix de aditivada.",
      icon: "⛽",
      achieved: mixGoalHit,
    },
    {
      id: "versatility-3",
      label: "Multitarefa",
      description: "Bateu metas de 3 itens diferentes (histórico).",
      icon: "🧩",
      achieved: distinctItemsHit.size >= 3,
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
      id: "network-champion",
      label: "Campeão da rede",
      description: "Foi o 1º colocado entre todos os frentistas da rede no mês fechado anterior.",
      icon: "🌍",
      achieved: wasNetworkChampion,
    },
    {
      id: "network-podium",
      label: "Pódio da rede",
      description: "Ficou entre os 3 primeiros de toda a rede no mês fechado anterior.",
      icon: "🎗️",
      achieved: wasNetworkPodium,
    },
    {
      id: "streak-5",
      label: "Sequência",
      description: "Lançou vendas em 5 dias seguidos.",
      icon: "🔥",
      achieved: streak >= 5,
    },
    {
      id: "streak-10",
      label: "Sequência forte",
      description: "Lançou vendas em 10 dias seguidos.",
      icon: "⚡",
      achieved: streak >= 10,
    },
    {
      id: "streak-30",
      label: "Imparável",
      description: "Lançou vendas em 30 dias seguidos.",
      icon: "🌪️",
      achieved: streak >= 30,
    },
    {
      id: "entries-100",
      label: "Sempre presente",
      description: "Fez 100 lançamentos de venda ou mais (histórico).",
      icon: "📈",
      achieved: entryDates.length >= 100,
    },
    {
      id: "redemption-paid",
      label: "Resgate na conta",
      description: "Teve um resgate marcado como pago.",
      icon: "🏧",
      achieved: paidRedemptionsCount > 0,
    },
    ...REDEMPTION_COUNT_MILESTONES.map((m) => ({
      id: m.id,
      label: m.label,
      description: m.description,
      icon: m.icon,
      achieved: paidRedemptionsCount >= m.count,
    })),
    {
      id: "redemption-1000-paid",
      label: "R$1.000 resgatados",
      description: "Já resgatou R$1.000 ou mais em comissão paga (histórico).",
      icon: "🧾",
      achieved: paidRedemptionsTotal >= 1000,
    },
    ...TENURE_MILESTONES.map((m) => ({
      id: m.id,
      label: m.label,
      description: m.description,
      icon: m.icon,
      achieved: tenureDays >= m.days,
    })),
    {
      id: "profile-photo",
      label: "Perfil completo",
      description: "Cadastrou uma foto de perfil.",
      icon: "🖼️",
      achieved: !!user.photoUrl,
    },
  ];

  return badges;
}
