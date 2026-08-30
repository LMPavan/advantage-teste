import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Period, Redemption } from "../types";

const PERIOD_LABEL: Record<Period, string> = { DAILY: "Diária", WEEKLY: "Semanal", MONTHLY: "Mensal" };
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING: { label: "Pendente", cls: "warn" },
  APPROVED: { label: "Aprovado", cls: "ok" },
  REJECTED: { label: "Rejeitado", cls: "bad" },
  PAID: { label: "Pago", cls: "ok" },
};

export function ManagerRedemptions() {
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    api.get<Redemption[]>("/redemptions").then(setRedemptions);
  }
  useEffect(load, []);

  async function decide(id: string, status: "APPROVED" | "REJECTED" | "PAID") {
    setBusyId(id);
    setError(null);
    try {
      await api.patch(`/redemptions/${id}/decision`, { status });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar resgate.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1>Resgates da equipe</h1>
      <p className="subtitle">Aprove, rejeite ou marque como pago os resgates solicitados pelos frentistas.</p>
      {error && <p className="error-text">{error}</p>}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Frentista</th>
              <th>Período</th>
              <th>Intervalo</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {redemptions.map((r) => (
              <tr key={r.id}>
                <td>{r.attendant?.name}</td>
                <td>{PERIOD_LABEL[r.period]}</td>
                <td>
                  {r.periodStart.slice(0, 10)} — {r.periodEnd.slice(0, 10)}
                </td>
                <td>R$ {Number(r.commissionAmount).toFixed(2)}</td>
                <td>
                  <span className={`badge ${STATUS_LABEL[r.status].cls}`}>{STATUS_LABEL[r.status].label}</span>
                </td>
                <td style={{ display: "flex", gap: "0.4rem" }}>
                  {r.status === "PENDING" && (
                    <>
                      <button className="btn small" disabled={busyId === r.id} onClick={() => decide(r.id, "APPROVED")}>
                        Aprovar
                      </button>
                      <button className="btn danger small" disabled={busyId === r.id} onClick={() => decide(r.id, "REJECTED")}>
                        Rejeitar
                      </button>
                    </>
                  )}
                  {r.status === "APPROVED" && (
                    <button className="btn small" disabled={busyId === r.id} onClick={() => decide(r.id, "PAID")}>
                      Marcar como pago
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {redemptions.length === 0 && <p>Nenhum resgate solicitado ainda.</p>}
      </div>
    </div>
  );
}
