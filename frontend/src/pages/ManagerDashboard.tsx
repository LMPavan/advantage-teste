import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { AttendantRankingRow, ManagerSummary, PaceAlert, Tournament } from "../types";
import { ItemBreakdownTable, KpiCard, RedemptionSummaryCards } from "../components/DashboardWidgets";
import { TeamLeaderboard } from "../components/TeamLeaderboard";
import { UnreadMessagesPopup } from "../components/UnreadMessagesPopup";
import { AlertsPanel } from "../components/AlertsPanel";
import { CsvExportButton } from "../components/CsvExportButton";
import { RevenueForm } from "../components/RevenueForm";
import { TournamentCard } from "../components/TournamentCard";

export function ManagerDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<ManagerSummary | null>(null);
  const [ranking, setRanking] = useState<AttendantRankingRow[] | null>(null);
  const [alerts, setAlerts] = useState<PaceAlert[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    api.get<ManagerSummary>("/dashboard/manager-summary").then(setData);
    api.get<AttendantRankingRow[]>("/dashboard/station-ranking").then(setRanking);
    api.get<PaceAlert[]>("/dashboard/alerts").then(setAlerts);
    api.get<Tournament[]>("/tournaments").then(setTournaments);
  }, []);

  return (
    <div>
      <UnreadMessagesPopup />
      <h1>Dashboard</h1>
      <p className="subtitle">Panorama do seu posto neste período.</p>

      <div className="grid cols-3 section">
        <KpiCard value={data?.attendantsCount ?? "-"} label="Frentistas" />
        <KpiCard value={data ? `${data.avgAchievement.toFixed(1)}%` : "-"} label="Atingimento médio" />
        <KpiCard value={data ? `R$ ${data.totalCommission.toFixed(2)}` : "-"} label="Comissão gerada no período" />
      </div>

      {data?.managerCommission && data.managerCommission.mode !== "NONE" && (
        <div className="card section">
          <h2>💰 Sua comissão de gerente</h2>
          <p className="subtitle" style={{ marginTop: 0 }}>
            {data.managerCommission.mode === "TEAM_SUM"
              ? `${data.managerCommission.percent}% sobre a comissão gerada pela equipe (R$ ${data.managerCommission.teamCommission.toFixed(2)}).`
              : "Calculada pelas suas metas pessoais, definidas pelo dono da rede."}
          </p>
          <span className="value" style={{ fontSize: "1.8rem" }}>
            R$ {data.managerCommission.totalCommission.toFixed(2)}
          </span>
        </div>
      )}

      <div className="section">
        <h2>Fila de resgates</h2>
        {data && <RedemptionSummaryCards summary={data.redemptionSummary} />}
        {data && data.redemptionSummary.PENDING.count > 0 && (
          <div style={{ marginTop: "0.8rem" }}>
            <Link to="/manager/redemptions" className="btn small">
              {data.redemptionSummary.PENDING.count} resgate(s) aguardando aprovação →
            </Link>
          </div>
        )}
      </div>

      <div className="section">
        <h2>Equipe</h2>
        <p className="subtitle" style={{ marginTop: 0 }}>
          Posição de cada frentista no ranking do posto neste período.
        </p>
        {ranking && <TeamLeaderboard rows={ranking} emptyMessage="Nenhum frentista com metas registradas ainda." />}
      </div>

      {tournaments.filter((t) => t.status === "ACTIVE").map((t) => (
        <TournamentCard key={t.id} tournament={t} ownStationId={user?.stationId ?? undefined} />
      ))}

      <AlertsPanel alerts={alerts} />

      <div className="card section">
        <h2>Comissão por item</h2>
        {data && <ItemBreakdownTable rows={data.itemBreakdown} />}
      </div>

      {user?.stationId && <RevenueForm stationId={user.stationId} />}

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <Link to="/manager/team" className="btn secondary small">
          Gerenciar equipe e metas →
        </Link>
        <Link to="/manager/ranking" className="btn secondary small">
          🏆 Ver ranking da rede →
        </Link>
        <CsvExportButton />
      </div>
    </div>
  );
}
