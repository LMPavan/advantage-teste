import type { Tournament } from "../types";
import { Medal, tierForRank } from "./Leaderboard";

const METRIC_LABEL: Record<string, string> = {
  AVG_ACHIEVEMENT: "Atingimento médio",
  TOTAL_COMMISSION: "Comissão total",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

export function TournamentCard({ tournament, ownStationId }: { tournament: Tournament; ownStationId?: string }) {
  const winner = tournament.leaderboard.find((r) => r.stationId === tournament.winnerStationId);

  return (
    <div className="card section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.6rem", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: "0.2rem" }}>🏆 {tournament.title}</h2>
          <p className="subtitle" style={{ margin: 0 }}>
            {METRIC_LABEL[tournament.metric]} · {formatDate(tournament.startAt)} a {formatDate(tournament.endAt)}
          </p>
          <p style={{ margin: "0.3rem 0 0" }}>
            🎁 Prêmio: <strong>{tournament.prizeDescription}</strong>
          </p>
        </div>
        <span className={`badge ${tournament.status === "ACTIVE" ? "ok" : "neutral"}`}>
          {tournament.status === "ACTIVE" ? "Em andamento" : "Encerrado"}
        </span>
      </div>

      {tournament.status === "FINISHED" && winner && (
        <p className="subtitle" style={{ margin: "0.5rem 0 0" }}>
          🥇 Vencedor: <strong>{winner.stationName}</strong>
        </p>
      )}

      <div style={{ marginTop: "0.8rem" }}>
        {tournament.leaderboard.map((row) => {
          const tier = tierForRank(row.rank, true);
          const isOwn = row.stationId === ownStationId;
          return (
            <div
              key={row.stationId}
              className={`rank-row ${tier ?? ""} ${isOwn ? "self" : ""}`}
              style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}
            >
              <div className="rank-number">
                <Medal tier={tier} />
                {!tier && <span className="rank-plain">{row.rank}º</span>}
              </div>
              <div style={{ flex: 1 }}>
                <div className="name">
                  {row.stationName} {isOwn && <span className="badge neutral">Seu posto</span>}
                </div>
                <div className="meta">{row.managerName ?? "Sem gerente"}</div>
              </div>
              <div className="rank-stats">
                <div className="rank-stat">
                  <div className="value">
                    {tournament.metric === "TOTAL_COMMISSION" ? `R$ ${row.totalCommission.toFixed(2)}` : `${row.avgAchievement}%`}
                  </div>
                  <div className="label">{METRIC_LABEL[tournament.metric]}</div>
                </div>
              </div>
            </div>
          );
        })}
        {tournament.leaderboard.length === 0 && <p>Nenhum posto com dados neste período ainda.</p>}
      </div>
    </div>
  );
}
