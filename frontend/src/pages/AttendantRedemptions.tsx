import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Period, Redemption, Station } from "../types";

const PERIOD_LABEL: Record<Period, string> = { DAILY: "Diária", WEEKLY: "Semanal", MONTHLY: "Mensal" };
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pendente", cls: "warn" },
  APPROVED: { label: "Aprovado", cls: "ok" },
  REJECTED: { label: "Rejeitado", cls: "bad" },
  PAID: { label: "Pago", cls: "ok" },
};

function currentRange(period: Period) {
  const now = new Date();
  if (period === "DAILY") {
    const d = now.toISOString().slice(0, 10);
    return { start: d, end: d };
  }
  if (period === "WEEKLY") {
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function AttendantRedemptions() {
  const [redemptions, setRedemptions] = useState<Redemption[] | null>(null);
  const [policy, setPolicy] = useState<Station["redemptionPolicy"] | null>(null);
  const [period, setPeriod] = useState<Period>("MONTHLY");
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  function load() {
    api.get<Redemption[]>("/redemptions").then(setRedemptions);
    api.get<Station[]>("/stations").then((stations) => setPolicy(stations[0]?.redemptionPolicy ?? null));
  }

  useEffect(load, []);

  const allowedPeriods: Period[] = policy
    ? (["DAILY", "WEEKLY", "MONTHLY"] as Period[]).filter(
        (p) =>
          (p === "DAILY" && policy.allowDaily) ||
          (p === "WEEKLY" && policy.allowWeekly) ||
          (p === "MONTHLY" && policy.allowMonthly)
      )
    : [];

  async function requestRedemption() {
    setRequesting(true);
    setError(null);
    try {
      const range = currentRange(period);
      await api.post("/redemptions", { period, periodStart: range.start, periodEnd: range.end });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao solicitar resgate.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div>
      <h1>Resgates</h1>
      <p className="subtitle">Solicite o resgate da comissão acumulada conforme a periodicidade liberada pelo administrador.</p>

      <div className="card section" style={{ maxWidth: 520 }}>
        <h2>Solicitar resgate</h2>
        {allowedPeriods.length === 0 ? (
          <p>Nenhuma periodicidade de resgate foi liberada para o seu posto ainda.</p>
        ) : (
          <div className="inline-form">
            <div className="field">
              <label>Periodicidade</label>
              <select className="input" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
                {allowedPeriods.map((p) => (
                  <option key={p} value={p}>
                    {PERIOD_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn" onClick={requestRedemption} disabled={requesting}>
              {requesting ? "Enviando..." : "Solicitar resgate"}
            </button>
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="card">
        <h2>Histórico</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Período</th>
              <th>Intervalo</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Solicitado em</th>
            </tr>
          </thead>
          <tbody>
            {redemptions?.map((r) => (
              <tr key={r.id}>
                <td>{PERIOD_LABEL[r.period]}</td>
                <td>
                  {r.periodStart.slice(0, 10)} — {r.periodEnd.slice(0, 10)}
                </td>
                <td>R$ {Number(r.commissionAmount).toFixed(2)}</td>
                <td>
                  <span className={`badge ${STATUS_LABEL[r.status].cls}`}>{STATUS_LABEL[r.status].label}</span>
                </td>
                <td>{new Date(r.requestedAt).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {redemptions && redemptions.length === 0 && <p>Nenhum resgate solicitado ainda.</p>}
      </div>
    </div>
  );
}
