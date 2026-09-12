import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { StationRevenueSummary } from "../types";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function RevenueForm({ stationId }: { stationId: string }) {
  const [month] = useState(currentMonth());
  const [summary, setSummary] = useState<StationRevenueSummary | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<StationRevenueSummary>(`/stations/${stationId}/revenue?month=${month}`)
      .then((s) => {
        setSummary(s);
        setValue(s.totalRevenue !== null ? String(s.totalRevenue) : "");
      })
      .catch(() => {});
  }

  useEffect(load, [stationId, month]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/stations/${stationId}/revenue`, { month, totalRevenue: Number(value) });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao salvar faturamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card section">
      <h2>💵 Faturamento do posto</h2>
      <p className="subtitle" style={{ marginTop: 0 }}>
        Informe o faturamento do mês para ver a comissão gerada como % do faturamento.
      </p>
      <div className="inline-form">
        <div className="field">
          <label>Faturamento em {month} (R$)</label>
          <input className="input" type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <button className="btn small" onClick={submit} disabled={saving || !value}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {summary?.commissionPercentOfRevenue !== null && summary?.commissionPercentOfRevenue !== undefined && (
        <p style={{ marginTop: "0.6rem" }}>
          Comissão gerada: <strong>R$ {summary.totalCommission.toFixed(2)}</strong> ={" "}
          <strong>{summary.commissionPercentOfRevenue}%</strong> do faturamento informado.
        </p>
      )}
    </div>
  );
}
