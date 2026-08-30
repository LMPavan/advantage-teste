import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Goal } from "../types";
import { AchievementBadge, ProgressBar } from "../components/ProgressBar";

const PERIOD_LABEL: Record<string, string> = { DAILY: "Diária", WEEKLY: "Semanal", MONTHLY: "Mensal" };

function EntryForm({ goal, onSaved }: { goal: Goal; onSaved: () => void }) {
  const isMix = goal.item.calculationType === "MIX_RATIO";
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState("");
  const [comumLiters, setComumLiters] = useState("");
  const [aditivadaLiters, setAditivadaLiters] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/entries`, {
        goalId: goal.id,
        date,
        value: isMix ? undefined : Number(value),
        comumLiters: isMix ? Number(comumLiters) : undefined,
        aditivadaLiters: isMix ? Number(aditivadaLiters) : undefined,
      });
      setValue("");
      setComumLiters("");
      setAditivadaLiters("");
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao lançar.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="btn secondary small" onClick={() => setOpen(true)}>
        Lançar venda de hoje
      </button>
    );
  }

  return (
    <div className="inline-form" style={{ marginTop: "0.6rem" }}>
      <div className="field">
        <label>Data</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {isMix ? (
        <>
          <div className="field">
            <label>Litros gasolina comum</label>
            <input className="input" type="number" step="0.01" value={comumLiters} onChange={(e) => setComumLiters(e.target.value)} />
          </div>
          <div className="field">
            <label>Litros gasolina aditivada</label>
            <input className="input" type="number" step="0.01" value={aditivadaLiters} onChange={(e) => setAditivadaLiters(e.target.value)} />
          </div>
        </>
      ) : (
        <div className="field">
          <label>Valor ({goal.item.unit})</label>
          <input className="input" type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
      )}
      <button className="btn small" onClick={submit} disabled={saving}>
        {saving ? "Salvando..." : "Salvar"}
      </button>
      <button className="btn secondary small" onClick={() => setOpen(false)}>
        Cancelar
      </button>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export function AttendantGoals() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api
      .get<Goal[]>("/goals")
      .then(setGoals)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Erro ao carregar metas."));
  }

  useEffect(load, []);

  const totalCommission = goals?.reduce((sum, g) => sum + g.progress.commissionAmount, 0) ?? 0;

  return (
    <div>
      <h1>Minhas metas</h1>
      <p className="subtitle">Acompanhe atingimento e comissão de cada item.</p>

      <div className="section grid cols-3">
        <div className="card stat">
          <span className="value">R$ {totalCommission.toFixed(2)}</span>
          <span className="label">Comissão acumulada no período</span>
        </div>
        <div className="card stat">
          <span className="value">{goals?.length ?? 0}</span>
          <span className="label">Metas ativas</span>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}
      {!goals && !error && <p>Carregando...</p>}

      <div className="grid cols-2 section">
        {goals?.map((goal) => (
          <div className="card" key={goal.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <h2 style={{ marginBottom: "0.1rem" }}>{goal.item.name}</h2>
                <span className="badge neutral">{PERIOD_LABEL[goal.period]}</span>
              </div>
              <AchievementBadge percent={goal.progress.achievementPercent} />
            </div>

            <p className="subtitle" style={{ margin: "0.6rem 0" }}>
              Realizado: <strong>{goal.progress.actualValue}</strong> {goal.item.unit} · Meta:{" "}
              <strong>{goal.progress.targetValue}</strong> {goal.item.unit}
            </p>
            <ProgressBar percent={goal.progress.achievementPercent} />

            <p style={{ marginTop: "0.8rem", fontSize: "0.9rem" }}>
              Comissão gerada: <strong>R$ {goal.progress.commissionAmount.toFixed(2)}</strong>
            </p>

            <EntryForm goal={goal} onSaved={load} />
          </div>
        ))}
        {goals && goals.length === 0 && <p>Nenhuma meta atribuída ainda. Fale com seu gerente.</p>}
      </div>
    </div>
  );
}
