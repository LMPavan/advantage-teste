import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { AttendantRankingRow, ItemAttendantRankingRow, StationDetail } from "../types";
import { Avatar } from "../components/Avatar";
import { AchievementBadge } from "../components/ProgressBar";

function isItemRow(row: AttendantRankingRow | ItemAttendantRankingRow): row is ItemAttendantRankingRow {
  return "itemName" in row;
}

function EmployeeRow({ row }: { row: AttendantRankingRow | ItemAttendantRankingRow }) {
  return (
    <div className="rank-row" style={{ marginBottom: "0.5rem" }}>
      <div className="rank-identity">
        <Avatar name={row.name} photoUrl={row.photoUrl} size={36} />
        <div>
          <div className="name">{row.name}</div>
          <div className="meta">
            {isItemRow(row) ? `Realizado: ${row.actualValue} de ${row.targetValue} ${row.unit}` : `${row.goalsCount} meta(s) no período`}
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
    </div>
  );
}

export function OwnerStationDetail() {
  const { stationId } = useParams<{ stationId: string }>();
  const [searchParams] = useSearchParams();
  const itemId = searchParams.get("itemId");
  const [detail, setDetail] = useState<StationDetail | null>(null);

  useEffect(() => {
    if (!stationId) return;
    setDetail(null);
    const query = itemId ? `?stationId=${stationId}&itemId=${itemId}` : `?stationId=${stationId}`;
    api.get<StationDetail>(`/dashboard/station-detail${query}`).then(setDetail);
  }, [stationId, itemId]);

  return (
    <div>
      <Link
        to={itemId ? "/owner/items-overview" : "/owner/ranking"}
        className="btn secondary small"
        style={{ marginBottom: "1rem", display: "inline-block" }}
      >
        ← Voltar
      </Link>

      {!detail && <p>Carregando...</p>}

      {detail && (
        <>
          <div className="card section">
            <h1 style={{ marginBottom: "0.2rem" }}>{detail.station.name}</h1>
            {detail.station.razaoSocial && <p className="subtitle" style={{ margin: 0 }}>{detail.station.razaoSocial}</p>}
            <div className="grid cols-3" style={{ marginTop: "0.8rem" }}>
              <div>
                <div className="meta">Código</div>
                <div>{detail.station.code}</div>
              </div>
              <div>
                <div className="meta">Endereço</div>
                <div>{detail.station.address ?? "—"}</div>
              </div>
              <div>
                <div className="meta">Gerente</div>
                <div>{detail.station.manager?.name ?? "—"}</div>
              </div>
            </div>
          </div>

          <div className="grid cols-2 section">
            <div className="card">
              <h2>🥇 Top 3</h2>
              {detail.top3.length === 0 && <p>Nenhum frentista com meta no período.</p>}
              {detail.top3.map((row) => (
                <EmployeeRow key={row.attendantId} row={row} />
              ))}
            </div>
            <div className="card">
              <h2>⚠️ Bottom 3</h2>
              {detail.bottom3.length === 0 && <p>Nenhum frentista com meta no período.</p>}
              {detail.bottom3.map((row) => (
                <EmployeeRow key={row.attendantId} row={row} />
              ))}
            </div>
          </div>

          <div className="card section">
            <h2>Equipe completa ({detail.station.attendantsCount} frentista(s))</h2>
            {detail.attendants.length === 0 && <p>Nenhum frentista com meta neste período.</p>}
            {detail.attendants.map((row) => (
              <EmployeeRow key={row.attendantId} row={row} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
