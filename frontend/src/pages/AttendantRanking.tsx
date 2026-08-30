import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { AttendantRankingRow } from "../types";
import { Avatar } from "../components/Avatar";
import { LeaderboardRow, tierForRank } from "../components/Leaderboard";

export function AttendantRanking() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AttendantRankingRow[] | null>(null);

  useEffect(() => {
    api.get<AttendantRankingRow[]>("/dashboard/station-ranking").then(setRows);
  }, []);

  return (
    <div>
      <h1>Ranking do posto</h1>
      <p className="subtitle">
        Veja como você está em relação aos demais frentistas do seu posto neste período. O 1º lugar ganha
        moldura dourada, o 2º prata e o 3º bronze.
      </p>

      {rows?.map((row, index) => {
        const rank = index + 1;
        const tier = tierForRank(rank, true);
        return (
          <LeaderboardRow key={row.attendantId} rank={rank} tier={tier} highlight={row.attendantId === user?.id}>
            <div className="rank-identity">
              <Avatar name={row.name} photoUrl={row.photoUrl} size={40} />
              <div>
                <div className="name">
                  {row.name} {row.attendantId === user?.id && <span className="badge neutral">Você</span>}
                </div>
                <div className="meta">{row.goalsCount} metas no período</div>
              </div>
            </div>
            <div className="rank-stats">
              <div className="rank-stat">
                <div className="value">{row.avgAchievement.toFixed(1)}%</div>
                <div className="label">Atingimento</div>
              </div>
              <div className="rank-stat">
                <div className="value">R$ {row.totalCommission.toFixed(2)}</div>
                <div className="label">Comissão</div>
              </div>
            </div>
          </LeaderboardRow>
        );
      })}

      {rows && rows.length === 0 && <p>Ainda não há frentistas com metas no seu posto.</p>}
    </div>
  );
}
