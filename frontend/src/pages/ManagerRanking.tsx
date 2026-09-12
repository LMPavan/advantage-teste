import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { StationRankingRow } from "../types";
import { Avatar } from "../components/Avatar";
import { LeaderboardRow, tierForRank } from "../components/Leaderboard";

const GAMIFICATION_MIN_STATIONS = 3;

export function ManagerRanking() {
  const { user } = useAuth();
  const [rows, setRows] = useState<StationRankingRow[] | null>(null);

  useEffect(() => {
    api.get<StationRankingRow[]>("/dashboard/network-ranking").then(setRows);
  }, []);

  const gamified = (rows?.length ?? 0) > GAMIFICATION_MIN_STATIONS;

  return (
    <div>
      <h1>Ranking da rede</h1>
      <p className="subtitle">
        Compare o desempenho do seu posto com os demais postos da rede.
        {gamified
          ? " O 1º lugar ganha moldura dourada, o 2º prata e o 3º bronze."
          : " A rede precisa de mais de 3 postos cadastrados para liberar as medalhas."}
      </p>

      {rows?.map((row, index) => {
        const rank = index + 1;
        const tier = tierForRank(rank, gamified);
        return (
          <LeaderboardRow key={row.stationId} rank={rank} tier={tier} highlight={row.stationId === user?.stationId}>
            <div className="rank-identity">
              <Avatar name={row.managerName ?? row.stationName} photoUrl={row.managerPhotoUrl} size={40} />
              <div>
                <div className="name">
                  {row.stationName} {row.stationId === user?.stationId && <span className="badge neutral">Seu posto</span>}
                </div>
                <div className="meta">
                  {row.managerName ?? "Sem gerente"} · {row.attendantsCount} frentista(s)
                </div>
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

      {rows && rows.length === 0 && <p>Nenhum posto com metas cadastradas ainda.</p>}
    </div>
  );
}
