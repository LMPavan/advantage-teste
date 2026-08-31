import { useState } from "react";
import { api, ApiError } from "../api/client";
import type { Goal } from "../types";

/** Lançamento de venda usado pelo gerente: pela equipe (Equipe e metas) ou por uma meta pessoal (Minhas metas). */
export function ManagerEntryForm({ goal, onSaved }: { goal: Goal; onSaved: () => void }) {
  const isMix = goal.item.calculationType === "MIX_RATIO";
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState("");
  const [comumLiters, setComumLiters] = useState("");
  const [aditivadaLiters, setAditivadaLiters] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.post("/entries", {
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
    <div className="inline-form" style={{ marginTop: "0.4rem" }}>
      <div className="field">
        <label>Data</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {isMix ? (
        <>
          <div className="field">
            <label>Comum (L)</label>
            <input className="input" type="number" step="0.01" value={comumLiters} onChange={(e) => setComumLiters(e.target.value)} />
          </div>
          <div className="field">
            <label>Aditivada (L)</label>
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
