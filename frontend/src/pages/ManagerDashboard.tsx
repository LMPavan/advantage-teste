import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { ManagerSummary } from "../types";
import { HighlightCard, ItemBreakdownTable, KpiCard, RedemptionSummaryCards } from "../components/DashboardWidgets";

export function ManagerDashboard() {
  const [data, setData] = useState<ManagerSummary | null>(null);

  useEffect(() => {
    api.get<ManagerSummary>("/dashboard/manager-summary").then(setData);
  }, []);

  return (
    <div>
      <h1>Dashboard</h1>
      <p className="subtitle">Panorama do seu posto neste período.</p>

      <div className="grid cols-3 section">
        <KpiCard value={data?.attendantsCount ?? "-"} label="Frentistas" />
        <KpiCard value={data ? `${data.avgAchievement.toFixed(1)}%` : "-"} label="Atingimento médio" />
        <KpiCard value={data ? `R$ ${data.totalCommission.toFixed(2)}` : "-"} label="Comissão gerada no período" />
      </div>

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

      <div className="grid cols-2 section">
        <HighlightCard
          title="🏆 Melhor frentista"
          name={data?.topAttendant?.name}
          meta={data?.topAttendant ? `${data.topAttendant.goalsCount} meta(s) · R$ ${data.topAttendant.totalCommission.toFixed(2)}` : undefined}
          achievement={data?.topAttendant?.avgAchievement}
          empty="Ainda não há frentistas com metas registradas."
        />
        <HighlightCard
          title="⚠️ Precisa de atenção"
          name={data?.attendantNeedingAttention?.name}
          meta={
            data?.attendantNeedingAttention
              ? `${data.attendantNeedingAttention.goalsCount} meta(s) · R$ ${data.attendantNeedingAttention.totalCommission.toFixed(2)}`
              : undefined
          }
          achievement={data?.attendantNeedingAttention?.avgAchievement}
          empty="Cadastre mais frentistas para ver comparativos."
        />
      </div>

      <div className="card section">
        <h2>Comissão por item</h2>
        {data && <ItemBreakdownTable rows={data.itemBreakdown} />}
      </div>

      <div style={{ display: "flex", gap: "0.6rem" }}>
        <Link to="/manager/team" className="btn secondary small">
          Gerenciar equipe e metas →
        </Link>
        <Link to="/manager/ranking" className="btn secondary small">
          🏆 Ver ranking da rede →
        </Link>
      </div>
    </div>
  );
}
