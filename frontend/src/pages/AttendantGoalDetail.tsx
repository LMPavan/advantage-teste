import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { DailyGoalDetail, Goal } from "../types";
import { DailyBarChart } from "../components/DailyBarChart";
import { AchievementBadge, ProgressBar } from "../components/ProgressBar";

type PeriodMode = "WEEK" | "MONTH" | "CUSTOM";

function weekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function AttendantGoalDetail() {
  const { goalId } = useParams<{ goalId: string }>();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [detail, setDetail] = useState<DailyGoalDetail | null>(null);
  const [mode, setMode] = useState<PeriodMode>("MONTH");
  const initialMonth = monthRange();
  const [customStart, setCustomStart] = useState(initialMonth.start);
  const [customEnd, setCustomEnd] = useState(initialMonth.end);

  useEffect(() => {
    if (!goalId) return;
    api.get<Goal>(`/goals/${goalId}`).then(setGoal);
  }, [goalId]);

  function load(start: string, end: string) {
    if (!goalId) return;
    setDetail(null);
    api.get<DailyGoalDetail>(`/goals/${goalId}/daily?start=${start}&end=${end}`).then(setDetail);
  }

  useEffect(() => {
    if (!goalId) return;
    if (mode === "WEEK") {
      const r = weekRange();
      load(r.start, r.end);
    } else if (mode === "MONTH") {
      const r = monthRange();
      load(r.start, r.end);
    } else {
      load(customStart, customEnd);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId, mode]);

  const isMix = detail?.calculationType === "MIX_RATIO";
  const totalValue = detail?.days.reduce((sum, d) => sum + (d.value ?? 0), 0) ?? 0;
  const totalCommission = detail?.days.reduce((sum, d) => sum + d.estimatedCommission, 0) ?? 0;

  return (
    <div>
      <Link to="/attendant" className="btn secondary small" style={{ marginBottom: "1rem", display: "inline-block" }}>
        ← Voltar para minhas metas
      </Link>
      <h1>{goal?.item.name ?? "Detalhe do item"}</h1>
      <p className="subtitle">Veja quanto você fez por dia e o ritmo de comissão gerado.</p>

      {goal && (
        <div className="card section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.6rem" }}>
            <p style={{ margin: 0 }}>
              Realizado no período da meta: <strong>{goal.progress.actualValue}</strong> {goal.item.unit} · Meta:{" "}
              <strong>{goal.progress.targetValue}</strong> {goal.item.unit}
            </p>
            <AchievementBadge percent={goal.progress.achievementPercent} />
          </div>
          <ProgressBar percent={goal.progress.achievementPercent} />
          <p style={{ marginTop: "0.6rem" }}>
            Comissão gerada até agora: <strong>R$ {goal.progress.commissionAmount.toFixed(2)}</strong>
          </p>
        </div>
      )}

      <div className="period-picker">
        <div className="role-picker" style={{ marginBottom: 0 }}>
          <button className={mode === "WEEK" ? "active" : ""} onClick={() => setMode("WEEK")}>
            Semana
          </button>
          <button className={mode === "MONTH" ? "active" : ""} onClick={() => setMode("MONTH")}>
            Mês
          </button>
          <button className={mode === "CUSTOM" ? "active" : ""} onClick={() => setMode("CUSTOM")}>
            Personalizado
          </button>
        </div>
        {mode === "CUSTOM" && (
          <>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>De</label>
              <input className="input" type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Até</label>
              <input className="input" type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
            <button className="btn small" onClick={() => load(customStart, customEnd)}>
              Aplicar
            </button>
          </>
        )}
      </div>

      {detail && (
        <>
          <div className="grid cols-3 section">
            {!isMix && (
              <div className="card stat">
                <span className="value">
                  {Math.round(totalValue * 100) / 100} {detail.unit}
                </span>
                <span className="label">Total lançado no período</span>
              </div>
            )}
            <div className="card stat">
              <span className="value">R$ {totalCommission.toFixed(2)}</span>
              <span className="label">Ritmo de comissão no período (estimado)</span>
            </div>
            <div className="card stat">
              <span className="value">{detail.days.length}</span>
              <span className="label">Dias com lançamento</span>
            </div>
          </div>

          <div className="card section">
            <h2>Comissão estimada por dia</h2>
            <p className="subtitle" style={{ marginTop: 0 }}>
              Estimativa aplicando a taxa do item a cada dia — a comissão final da meta pode variar conforme o
              atingimento do período fechado.
            </p>
            <DailyBarChart data={detail.days.map((d) => ({ date: d.date, value: d.estimatedCommission }))} />
          </div>

          <div className="card">
            <h2>Lançamentos por dia</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  {isMix ? (
                    <>
                      <th>Comum (L)</th>
                      <th>Aditivada (L)</th>
                      <th>Razão do dia</th>
                    </>
                  ) : (
                    <th>Valor ({detail.unit})</th>
                  )}
                  <th>Comissão estimada</th>
                </tr>
              </thead>
              <tbody>
                {detail.days.map((d) => (
                  <tr key={d.date}>
                    <td>{d.date.split("-").reverse().join("/")}</td>
                    {isMix ? (
                      <>
                        <td>{d.comumLiters}</td>
                        <td>{d.aditivadaLiters}</td>
                        <td>{d.ratio ?? "—"}</td>
                      </>
                    ) : (
                      <td>{d.value}</td>
                    )}
                    <td>R$ {d.estimatedCommission.toFixed(2)}</td>
                  </tr>
                ))}
                {detail.days.length === 0 && (
                  <tr>
                    <td colSpan={isMix ? 4 : 2}>Nenhum lançamento neste período.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
