import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AttendantRankingRow, ExecutiveDashboard, Item, ItemAttendantRankingRow, ManagerCommissionRow } from "../types";
import { AchievementBadge } from "../components/ProgressBar";
import { Medal, tierForRank } from "../components/Leaderboard";

const GAMIFICATION_MIN_STATIONS = 3;

function isItemRow(row: AttendantRankingRow | ItemAttendantRankingRow): row is ItemAttendantRankingRow {
  return "itemName" in row;
}

const MANAGER_MODE_LABEL: Record<string, string> = {
  NONE: "Sem comissão",
  TEAM_SUM: "% da equipe",
  CUSTOM: "Personalizada",
};

function ManagerCommissionsTable() {
  const [rows, setRows] = useState<ManagerCommissionRow[] | null>(null);

  useEffect(() => {
    api.get<ManagerCommissionRow[]>("/dashboard/manager-commissions").then(setRows);
  }, []);

  return (
    <div className="card section">
      <h2>Comissão dos gerentes</h2>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Como cada gerente ganha comissão neste período, conforme configurado em Postos.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Posto</th>
            <th>Gerente</th>
            <th>Modo</th>
            <th>Comissão</th>
          </tr>
        </thead>
        <tbody>
          {rows?.map((r) => (
            <tr key={r.stationId}>
              <td>{r.stationName}</td>
              <td>{r.managerName ?? "—"}</td>
              <td>{r.commission ? MANAGER_MODE_LABEL[r.commission.mode] : "—"}</td>
              <td>R$ {(r.commission?.totalCommission ?? 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows && rows.length === 0 && <p>Nenhum posto com gerente cadastrado ainda.</p>}
    </div>
  );
}

export function OwnerExecutive() {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [data, setData] = useState<ExecutiveDashboard | null>(null);

  useEffect(() => {
    api.get<Item[]>("/items").then(setItems);
  }, []);

  useEffect(() => {
    setData(null);
    const query = selectedItemId ? `?itemId=${selectedItemId}` : "";
    api.get<ExecutiveDashboard>(`/dashboard/executive${query}`).then(setData);
  }, [selectedItemId]);

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

      <ManagerCommissionsTable />

      <div className="role-picker section" style={{ flexWrap: "wrap" }}>
        <button className={selectedItemId === null ? "active" : ""} onClick={() => setSelectedItemId(null)}>
          Ranking geral
        </button>
        {items.map((item) => (
          <button key={item.id} className={selectedItemId === item.id ? "active" : ""} onClick={() => setSelectedItemId(item.id)}>
            {item.name}
          </button>
        ))}
      </div>
      {selectedItemId && (
        <p className="subtitle" style={{ marginTop: 0 }}>
          Mostrando postos e frentistas apenas pelo desempenho neste item, no período atual.
        </p>
      )}

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
              <th>{selectedItemId ? "Realizado" : "Metas"}</th>
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
                  <td>{isItemRow(a) ? `${a.actualValue} / ${a.targetValue} ${a.unit}` : a.goalsCount}</td>
                  <td>
                    <AchievementBadge percent={isItemRow(a) ? a.achievementPercent : a.avgAchievement} />
                  </td>
                  <td>R$ {(isItemRow(a) ? a.commissionAmount : a.totalCommission).toFixed(2)}</td>
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
