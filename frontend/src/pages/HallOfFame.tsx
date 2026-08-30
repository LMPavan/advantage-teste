import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { HallOfFame as HallOfFameData } from "../types";
import { Avatar } from "../components/Avatar";
import { Medal, tierForRank, type Tier } from "../components/Leaderboard";

function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1, 1);
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function Podium<T>({
  title,
  rows,
  renderName,
  renderMeta,
  renderPhoto,
}: {
  title: string;
  rows: T[];
  renderName: (row: T) => string;
  renderMeta: (row: T) => string;
  renderPhoto: (row: T) => string | null | undefined;
}) {
  if (rows.length === 0) {
    return (
      <div className="card section">
        <h2>{title}</h2>
        <p>Ainda não há dados suficientes para este mês.</p>
      </div>
    );
  }

  return (
    <div className="card section">
      <h2>{title}</h2>
      <div className="podium">
        {rows.map((row, index) => {
          const tier = tierForRank(index + 1, true) as Tier;
          return (
            <div key={index} className={`podium-card ${tier}`}>
              <Medal tier={tier} />
              <div className="podium-avatar">
                <Avatar name={renderName(row)} photoUrl={renderPhoto(row)} size={64} />
              </div>
              <div className="name">{renderName(row)}</div>
              <div className="meta">{renderMeta(row)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HallOfFame() {
  const [data, setData] = useState<HallOfFameData | null>(null);

  useEffect(() => {
    api.get<HallOfFameData>("/dashboard/hall-of-fame").then(setData);
  }, []);

  return (
    <div>
      <h1>🏆 Mural dos campeões</h1>
      <p className="subtitle">
        Os destaques de {data ? monthLabel(data.month).toLowerCase() : "do mês anterior"} em toda a rede.
      </p>

      {data && (
        <>
          <Podium
            title="Melhores frentistas"
            rows={data.topAttendants}
            renderName={(r) => r.name}
            renderMeta={(r) => `${r.stationName} · ${r.avgAchievement.toFixed(1)}% de atingimento`}
            renderPhoto={(r) => r.photoUrl}
          />
          <Podium
            title="Melhores postos"
            rows={data.topStations}
            renderName={(r) => r.stationName}
            renderMeta={(r) => `${r.managerName ?? "Sem gerente"} · ${r.avgAchievement.toFixed(1)}% de atingimento`}
            renderPhoto={(r) => r.managerPhotoUrl}
          />
        </>
      )}
    </div>
  );
}
