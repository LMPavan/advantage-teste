import type { AttendantRankingRow, ItemAttendantRankingRow } from "../types";
import { Avatar } from "./Avatar";
import { LeaderboardRow, tierForRank } from "./Leaderboard";
import { AchievementBadge } from "./ProgressBar";

function isItemRow(row: AttendantRankingRow | ItemAttendantRankingRow): row is ItemAttendantRankingRow {
  return "itemName" in row;
}

export function TeamLeaderboard({
  rows,
  ownId,
  gamified = true,
  emptyMessage = "Ninguém com dados neste período ainda.",
}: {
  rows: (AttendantRankingRow | ItemAttendantRankingRow)[];
  ownId?: string;
  gamified?: boolean;
  emptyMessage?: string;
}) {
  if (rows.length === 0) return <p>{emptyMessage}</p>;

  return (
    <div>
      {rows.map((row, index) => {
        const rank = index + 1;
        const tier = tierForRank(rank, gamified);
        return (
          <LeaderboardRow key={row.attendantId} rank={rank} tier={tier} highlight={row.attendantId === ownId}>
            <div className="rank-identity">
              <Avatar name={row.name} photoUrl={row.photoUrl} size={40} />
              <div>
                <div className="name">
                  {row.name} {row.attendantId === ownId && <span className="badge neutral">Você</span>}
                </div>
                <div className="meta">
                  {isItemRow(row)
                    ? `Realizado: ${row.actualValue} de ${row.targetValue} ${row.unit}`
                    : `${row.goalsCount} meta(s) no período`}
                </div>
              </div>
            </div>
            <div className="rank-stats">
              <div className="rank-stat">
                <AchievementBadge percent={isItemRow(row) ? row.achievementPercent : row.avgAchievement} />
                <div className="label">Atingimento</div>
              </div>
              <div className="rank-stat">
                <div className="value">R$ {(isItemRow(row) ? row.commissionAmount : row.totalCommission).toFixed(2)}</div>
                <div className="label">Comissão</div>
              </div>
            </div>
          </LeaderboardRow>
        );
      })}
    </div>
  );
}
