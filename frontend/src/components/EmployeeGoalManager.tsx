import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Attendant, Goal } from "../types";
import { AchievementBadge, ProgressBar } from "./ProgressBar";
import { CommissionInfoButton } from "./CommissionInfoButton";
import { Avatar } from "./Avatar";
import { itemIcon } from "../utils/itemIcon";

const PERIOD_LABEL: Record<string, string> = { DAILY: "Diária", WEEKLY: "Semanal", MONTHLY: "Mensal" };

function TargetEditor({ goal, onSaved }: { goal: Goal; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(goal.targetValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/goals/${goal.id}`, { targetValue: Number(value) });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao ajustar meta.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="btn secondary small" onClick={() => setOpen(true)}>
        Ajustar meta
      </button>
    );
  }

  return (
    <div className="inline-form" style={{ marginTop: "0.4rem" }}>
      <div className="field">
        <label>Novo valor-alvo ({goal.item.unit})</label>
        <input className="input" type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <button className="btn small" onClick={save} disabled={saving}>
        {saving ? "Salvando..." : "Salvar"}
      </button>
      <button className="btn secondary small" onClick={() => setOpen(false)}>
        Cancelar
      </button>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

/**
 * Metas de um funcionário específico, com atingimento e (se canEdit) ajuste do valor-alvo. Usado tanto
 * pelo gerente (equipe do próprio posto) quanto pelo dono (qualquer posto da rede), com a lista de
 * funcionários e a permissão de edição decididas por quem usa o componente.
 */
export function EmployeeGoalManager({ attendants, canEdit }: { attendants: Attendant[]; canEdit: boolean }) {
  const [attendantId, setAttendantId] = useState("");
  const [goals, setGoals] = useState<Goal[] | null>(null);

  function load(id: string) {
    if (!id) {
      setGoals(null);
      return;
    }
    api.get<Goal[]>(`/goals?attendantId=${id}`).then(setGoals);
  }

  useEffect(() => {
    setGoals(null);
    load(attendantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendantId]);

  const selected = attendants.find((a) => a.id === attendantId);

  return (
    <div>
      <div className="field" style={{ maxWidth: 360 }}>
        <label>Funcionário</label>
        <select className="input" value={attendantId} onChange={(e) => setAttendantId(e.target.value)}>
          <option value="">Selecione um funcionário...</option>
          {attendants.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="card section" style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
          <Avatar name={selected.name} photoUrl={selected.photoUrl} size={40} />
          <div>
            <strong>{selected.name}</strong>
            <div className="meta">{selected.email}</div>
          </div>
        </div>
      )}

      {attendantId && !goals && <p>Carregando...</p>}

      {goals && (
        <div className="grid cols-2 section">
          {goals.map((goal) => (
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

              <p className="subtitle" style={{ margin: "0.6rem 0" }}>
                Realizado: <strong>{goal.progress.actualValue}</strong> {goal.item.unit} · Meta:{" "}
                <strong>{goal.progress.targetValue}</strong> {goal.item.unit}
              </p>
              <ProgressBar percent={goal.progress.achievementPercent} />

              <p style={{ marginTop: "0.4rem", fontSize: "0.9rem" }}>
                Comissão gerada no mês: <strong>R$ {goal.progress.commissionAmount.toFixed(2)}</strong>
              </p>

              {canEdit ? (
                <TargetEditor goal={goal} onSaved={() => load(attendantId)} />
              ) : (
                <p className="subtitle" style={{ margin: 0 }}>
                  O dono da rede não liberou o ajuste de metas para gerentes neste posto.
                </p>
              )}
            </div>
          ))}
          {goals.length === 0 && <p>Nenhuma meta ativa para este funcionário no período atual.</p>}
        </div>
      )}
    </div>
  );
}
