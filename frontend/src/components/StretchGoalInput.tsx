import { useState } from "react";
import type { Goal } from "../types";
import { getStretchPercent, setStretchPercent } from "../utils/localGoalPrefs";

/** Meta pessoal "esticada" do frentista, por cima da meta oficial — só local, pra quem quer se desafiar mais. */
export function StretchGoalInput({ goal }: { goal: Goal }) {
  const [stretch, setStretch] = useState<number | null>(() => getStretchPercent(goal.id));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(stretch ?? 120));

  function save() {
    const percent = Math.max(101, Math.round(Number(draft)));
    setStretchPercent(goal.id, percent);
    setStretch(percent);
    setEditing(false);
  }

  function remove() {
    setStretchPercent(goal.id, null);
    setStretch(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.4rem" }}>
        <input
          className="input"
          type="number"
          min={101}
          step={1}
          style={{ width: 90 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <span className="subtitle" style={{ margin: 0 }}>
          % da meta oficial
        </span>
        <button className="btn small" onClick={save}>
          Salvar
        </button>
        <button className="btn secondary small" onClick={() => setEditing(false)}>
          Cancelar
        </button>
      </div>
    );
  }

  if (stretch === null) {
    return (
      <button className="btn secondary small" style={{ marginTop: "0.4rem" }} onClick={() => setEditing(true)}>
        🚀 Definir meta esticada
      </button>
    );
  }

  const stretchTarget = Math.round((goal.progress.targetValue * stretch) / 100 * 100) / 100;
  const stretchPercentOfActual = stretchTarget > 0 ? Math.round((goal.progress.actualValue / stretchTarget) * 1000) / 10 : 0;

  return (
    <div style={{ marginTop: "0.4rem" }}>
      <p className="subtitle" style={{ margin: 0 }}>
        🚀 Sua meta esticada ({stretch}%): {stretchTarget} {goal.item.unit} — {stretchPercentOfActual}% alcançado
      </p>
      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.2rem" }}>
        <button className="btn secondary small" onClick={() => setEditing(true)}>
          Editar
        </button>
        <button className="btn secondary small" onClick={remove}>
          Remover
        </button>
      </div>
    </div>
  );
}
