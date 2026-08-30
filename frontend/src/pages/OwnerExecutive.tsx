import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ExecutiveDashboard } from "../types";
import { AchievementBadge } from "../components/ProgressBar";
import { Medal, tierForRank } from "../components/Leaderboard";

const GAMIFICATION_MIN_STATIONS = 3;

export function OwnerExecutive() {
  const [data, setData] = useState<ExecutiveDashboard | null>(null);

  useEffect(() => {
    api.get<ExecutiveDashboard>("/dashboard/executive").then(setData);
  }, []);

  const stationsGamified = (data?.stationRankings.length ?? 0) > GAMIFICATION_MIN_STATIONS;

  return (
    <div>
      <h1>Visão executiva</h1>
      <p className="subtitle">Panorama da rede: melhores postos, gerentes e frentistas.</p>

      <div className="grid cols-3 section">
        <div className="card stat">
          <span className="value">{data?.stationsCount ?? "-"}</span>
          <span className="label">Postos na rede</span>
        </div>
        <div className="card stat">
          <span className="value">R$ {data?.totalCommission.toFixed(2) ?? "0.00"}</span>
          <span className="label">Comissão total gerada</span>
        </div>
      </div>

      <div className="card section">
        <h2>Ranking de postos</h2>
        {!stationsGamified && (
          <p className="subtitle" style={{ marginBottom: "0.6rem" }}>
            Cadastre mais de 3 postos para liberar as medalhas de ouro, prata e bronze.
          </p>
        )}
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Posto</th>
              <th>Gerente</th>
              <th>Frentistas</th>
              <th>Atingimento médio</th>
              <th>Comissão gerada</th>
            </tr>
          </thead>
          <tbody>
            {data?.stationRankings.map((s, index) => {
              const tier = tierForRank(index + 1, stationsGamified);
              return (
                <tr key={s.stationId}>
                  <td>
                    <Medal tier={tier} /> {!tier && index + 1}
                  </td>
                  <td>{s.stationName}</td>
                  <td>{s.managerName ?? "—"}</td>
                  <td>{s.attendantsCount}</td>
                  <td>
                    <AchievementBadge percent={s.avgAchievement} />
                  </td>
                  <td>R$ {s.totalCommission.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data && data.stationRankings.length === 0 && <p>Nenhum posto cadastrado ainda.</p>}
      </div>

      <div className="card section">
        <h2>Ranking de frentistas</h2>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Frentista</th>
              <th>Posto</th>
              <th>Metas</th>
              <th>Atingimento médio</th>
              <th>Comissão gerada</th>
            </tr>
          </thead>
          <tbody>
            {data?.attendantRankings.map((a, index) => {
              const tier = tierForRank(index + 1, true);
              return (
                <tr key={a.attendantId}>
                  <td>
                    <Medal tier={tier} /> {!tier && index + 1}
                  </td>
                  <td>{a.name}</td>
                  <td>{a.stationName}</td>
                  <td>{a.goalsCount}</td>
                  <td>
                    <AchievementBadge percent={a.avgAchievement} />
                  </td>
                  <td>R$ {a.totalCommission.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data && data.attendantRankings.length === 0 && <p>Nenhum frentista com metas ainda.</p>}
      </div>
    </div>
  );
}
