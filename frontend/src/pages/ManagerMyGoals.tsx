import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { Goal, Station } from "../types";
import { AchievementBadge, ProgressBar } from "../components/ProgressBar";
import { CommissionInfoButton } from "../components/CommissionInfoButton";
import { ManagerEntryForm } from "../components/ManagerEntryForm";
import { itemIcon } from "../utils/itemIcon";

const PERIOD_LABEL: Record<string, string> = { DAILY: "Diária", WEEKLY: "Semanal", MONTHLY: "Mensal" };

export function ManagerMyGoals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [station, setStation] = useState<Station | null>(null);

  function load() {
    if (!user) return;
    api.get<Goal[]>(`/goals?attendantId=${user.id}`).then(setGoals);
  }

  useEffect(() => {
    load();
    api.get<Station[]>("/stations").then((stations) => setStation(stations[0] ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const totalCommission = goals?.reduce((sum, g) => sum + g.progress.commissionAmount, 0) ?? 0;

  return (
    <div>
      <h1>Minhas metas</h1>
      <p className="subtitle">Suas metas pessoais como gerente — comissão calculada como a de um frentista.</p>

      {station && station.managerCommissionMode !== "CUSTOM" && (
        <div className="card section">
          <p style={{ margin: 0 }}>
            {station.managerCommissionMode === "TEAM_SUM"
              ? "Sua comissão hoje é um percentual sobre o total gerado pela equipe — acompanhe no Dashboard. O dono da rede ainda não configurou metas pessoais para você."
              : "O dono da rede ainda não configurou comissão para o gerente deste posto."}
          </p>
        </div>
      )}

      {station?.managerCommissionMode === "CUSTOM" && (
        <>
          <div className="grid cols-3 section">
            <div className="card stat">
              <span className="value">R$ {totalCommission.toFixed(2)}</span>
              <span className="label">Comissão acumulada no período</span>
            </div>
          </div>

          {!goals && <p>Carregando...</p>}

          <div className="grid cols-2 section">
            {goals?.map((goal) => (
              <div className="card" key={goal.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.6rem" }}>
                  <div style={{ display: "flex", alignItems: "start", gap: "0.7rem", minWidth: 0 }}>
                    <span className="item-icon">{itemIcon(goal.item)}</span>
                    <div>
                      <h2 style={{ marginBottom: "0.1rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        {goal.item.name} <CommissionInfoButton item={goal.item} />
                      </h2>
                      <span className="badge neutral">{PERIOD_LABEL[goal.period]}</span>
                    </div>
                  </div>
                  <AchievementBadge percent={goal.progress.achievementPercent} />
                </div>

                <div className="grid cols-2" style={{ margin: "0.6rem 0", gap: "0.5rem" }}>
                  <div className="card stat" style={{ padding: "0.5rem 0.7rem" }}>
                    <span className="value" style={{ fontSize: "1.1rem" }}>
                      {goal.today.actualValue} {goal.item.unit}
                    </span>
                    <span className="label">Hoje · R$ {goal.today.estimatedCommission.toFixed(2)} de ritmo</span>
                  </div>
                  <div className="card stat" style={{ padding: "0.5rem 0.7rem" }}>
                    <span className="value" style={{ fontSize: "1.1rem" }}>
                      {goal.progress.actualValue} / {goal.progress.targetValue} {goal.item.unit}
                    </span>
                    <span className="label">Acumulado do mês</span>
                  </div>
                </div>
                <ProgressBar percent={goal.progress.achievementPercent} />

                <p style={{ marginTop: "0.4rem", fontSize: "0.9rem" }}>
                  Comissão gerada no mês: <strong>R$ {goal.progress.commissionAmount.toFixed(2)}</strong>
                </p>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <ManagerEntryForm goal={goal} onSaved={load} />
                  <Link to={`/manager/my-goals/${goal.id}`} className="btn secondary small">
                    Ver detalhes diários →
                  </Link>
                </div>
              </div>
            ))}
            {goals && goals.length === 0 && (
              <p>Nenhuma meta pessoal cadastrada ainda. Peça ao dono da rede para cadastrar uma.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
