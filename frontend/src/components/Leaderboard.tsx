import type { ReactNode } from "react";

export type Tier = "gold" | "silver" | "bronze" | null;

export function tierForRank(rank: number, gamified: boolean): Tier {
  if (!gamified) return null;
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return null;
}

export function Medal({ tier }: { tier: Tier }) {
  if (!tier) return null;
  const icon = tier === "gold" ? "🥇" : tier === "silver" ? "🥈" : "🥉";
  return (
    <span className={`medal ${tier}`} title={`${tier === "gold" ? "1º" : tier === "silver" ? "2º" : "3º"} lugar`}>
      {icon}
    </span>
  );
}

export function LeaderboardRow({
  rank,
  tier,
  highlight,
  children,
}: {
  rank: number;
  tier: Tier;
  highlight?: boolean;
  children: ReactNode;
}) {
  const cls = ["rank-row", tier, highlight ? "self" : ""].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <div className="rank-number">
        <Medal tier={tier} />
        {!tier && <span className="rank-plain">{rank}º</span>}
      </div>
      {children}
    </div>
  );
}
