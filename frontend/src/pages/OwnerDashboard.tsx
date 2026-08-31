import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { BenchmarkResult, MonthlyHistoryPoint, OwnerSummary, PaceAlert, Tournament } from "../types";
import { HighlightCard, ItemBreakdownTable, KpiCard, RedemptionSummaryCards } from "../components/DashboardWidgets";
import { UnreadMessagesPopup } from "../components/UnreadMessagesPopup";
import { AlertsPanel } from "../components/AlertsPanel";
import { MonthlyHistoryChart } from "../components/MonthlyHistoryChart";
import { BenchmarkCard } from "../components/BenchmarkCard";
import { CsvExportButton } from "../components/CsvExportButton";
import { TournamentCard } from "../components/TournamentCard";
import { WeeklyDigestModal } from "../components/WeeklyDigestModal";

export function OwnerDashboard() {
  const [data, setData] = useState<OwnerSummary | null>(null);
  const [alerts, setAlerts] = useState<PaceAlert[]>([]);
  const [history, setHistory] = useState<MonthlyHistoryPoint[] | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    api.get<OwnerSummary>("/dashboard/owner-summary").then(setData);
    api.get<PaceAlert[]>("/dashboard/alerts").then(setAlerts);
    api.get<MonthlyHistoryPoint[]>("/dashboard/history?months=6").then(setHistory);
    api.get<BenchmarkResult>("/dashboard/benchmark").then(setBenchmark);
    api.get<Tournament[]>("/tournaments").then(setTournaments);
  }, []);

  return (
    <div>
      <UnreadMessagesPopup />
      <WeeklyDigestModal />
      <h1>Dashboard</h1>
      <p className="subtitle">Panorama geral da rede neste período.</p>

      <div className="grid cols-3 section">
        <KpiCard value={data?.stationsCount ?? "-"} label="Postos" />
        <KpiCard value={data?.managersCount ?? "-"} label="Gerentes" />
        <KpiCard value={data?.attendantsCount ?? "-"} label="Frentistas" />
        <KpiCard value={data ? `${data.avgAchievement.toFixed(1)}%` : "-"} label="Atingimento médio da rede" />
        <KpiCard value={data ? `R$ ${data.totalCommission.toFixed(2)}` : "-"} label="Comissão gerada no período" />
      </div>

      <div className="section">
        <h2>Fila de resgates</h2>
        {data && <RedemptionSummaryCards summary={data.redemptionSummary} />}
        <div style={{ marginTop: "0.8rem" }}>
          <Link to="/owner/redemptions" className="btn secondary small">
            Gerenciar resgates →
          </Link>
        </div>
      </div>

      <div className="grid cols-2 section">
        <HighlightCard
          title="🏆 Melhor posto"
          name={data?.bestStation?.stationName}
          meta={data?.bestStation ? `${data.bestStation.managerName ?? "Sem gerente"}` : undefined}
          achievement={data?.bestStation?.avgAchievement}
          empty="Ainda não há postos com metas registradas."
        />
        <HighlightCard
          title="⚠️ Precisa de atenção"
          name={data?.worstStation?.stationName}
          meta={data?.worstStation ? `${data.worstStation.managerName ?? "Sem gerente"}` : undefined}
          achievement={data?.worstStation?.avgAchievement}
          empty="Cadastre mais de um posto para ver comparativos."
        />
      </div>

      {tournaments.filter((t) => t.status === "ACTIVE").map((t) => (
        <TournamentCard key={t.id} tournament={t} />
      ))}

      <AlertsPanel alerts={alerts} />

      <div className="card section">
        <h2>Comissão por item</h2>
        {data && <ItemBreakdownTable rows={data.itemBreakdown} />}
      </div>

      <div className="card section">
        <h2>📈 Histórico dos últimos meses</h2>
        {history && <MonthlyHistoryChart data={history} />}
      </div>

      {benchmark && <BenchmarkCard benchmark={benchmark} />}

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <Link to="/owner/ranking" className="btn secondary small">
          Ver ranking executivo →
        </Link>
        <Link to="/owner/hall-of-fame" className="btn secondary small">
          🏆 Ver mural →
        </Link>
        <Link to="/owner/tournaments" className="btn secondary small">
          🏆 Gerenciar torneios →
        </Link>
        <CsvExportButton />
      </div>
    </div>
  );
}
