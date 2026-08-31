import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { CommissionType, GoalDirection, Item, ItemCalculationType, PayoutMode } from "../types";
import { itemIcon } from "../utils/itemIcon";
import { Switch } from "../components/Switch";

const CALC_LABEL: Record<ItemCalculationType, string> = {
  SIMPLE: "Valor direto (litros, unidades ou R$)",
  MIX_RATIO: "Mix: % de penetração da aditivada = aditivada / (comum + aditivada)",
};
const DIRECTION_LABEL: Record<GoalDirection, string> = {
  HIGHER_IS_BETTER: "Maior é melhor (ex.: mix, volume)",
  LOWER_IS_BETTER: "Menor é melhor",
};
const COMMISSION_LABEL: Record<CommissionType, string> = {
  CENTS_PER_LITER: "Centavos por litro",
  CURRENCY_PER_LITER: "R$ por litro",
  CURRENCY_PER_UNIT: "R$ por unidade",
  PERCENTAGE_OF_VALUE: "% sobre o valor vendido",
  FIXED_PER_PERIOD: "Valor fixo ao bater a meta",
};
const PAYOUT_LABEL: Record<PayoutMode, string> = {
  THRESHOLD: "Só paga ao atingir o percentual mínimo",
  PROPORTIONAL: "Paga proporcional ao atingimento",
};

/** Cadastro e edição de item: cria (sem `initial`) ou salva alterações (com `initial`). */
function ItemForm({ initial, onSaved, onCancel }: { initial?: Item; onSaved: () => void; onCancel?: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "L");
  const [calculationType, setCalculationType] = useState<ItemCalculationType>(initial?.calculationType ?? "SIMPLE");
  const [direction, setDirection] = useState<GoalDirection>(initial?.direction ?? "HIGHER_IS_BETTER");
  const [commissionType, setCommissionType] = useState<CommissionType>(initial?.commissionType ?? "CURRENCY_PER_UNIT");
  const [commissionValue, setCommissionValue] = useState(initial?.commissionValue ?? "");
  const [linkedToGoal, setLinkedToGoal] = useState(initial?.linkedToGoal ?? true);
  const [payoutMode, setPayoutMode] = useState<PayoutMode>(initial?.payoutMode ?? "PROPORTIONAL");
  const [threshold, setThreshold] = useState(initial?.achievementThresholdPercent ?? "100");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(!!initial);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name,
        unit,
        calculationType,
        direction,
        commissionType,
        commissionValue: Number(commissionValue),
        linkedToGoal,
        payoutMode,
        achievementThresholdPercent: Number(threshold),
      };
      if (initial) {
        await api.patch(`/items/${initial.id}`, body);
      } else {
        await api.post("/items", body);
        setName("");
        setCommissionValue("");
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao salvar item.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="btn small" onClick={() => setOpen(true)}>
        + Novo item
      </button>
    );
  }

  return (
    <div className="grid cols-2" style={{ marginTop: "0.6rem" }}>
      <div className="field">
        <label>Nome do item</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Palhetas" />
      </div>
      <div className="field">
        <label>Unidade</label>
        <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="L, un, R$..." />
      </div>
      <div className="field">
        <label>Como o valor realizado é calculado</label>
        <select className="input" value={calculationType} onChange={(e) => setCalculationType(e.target.value as ItemCalculationType)}>
          {Object.entries(CALC_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Direção da meta</label>
        <select className="input" value={direction} onChange={(e) => setDirection(e.target.value as GoalDirection)}>
          {Object.entries(DIRECTION_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Tipo de comissionamento</label>
        <select className="input" value={commissionType} onChange={(e) => setCommissionType(e.target.value as CommissionType)}>
          {Object.entries(COMMISSION_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Valor da comissão (centavos, R$ ou %, conforme o tipo)</label>
        <input className="input" type="number" step="0.01" value={commissionValue} onChange={(e) => setCommissionValue(e.target.value)} />
      </div>

      <div className="field" style={{ gridColumn: "1 / -1" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" checked={linkedToGoal} onChange={(e) => setLinkedToGoal(e.target.checked)} />
          Comissão vinculada ao atingimento da meta
        </label>
        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
          {linkedToGoal
            ? "Só paga conforme as regras abaixo (percentual mínimo ou proporcional ao atingimento)."
            : "Paga integralmente por unidade vendida, sempre — independente de bater a meta. Ex.: 3 centavos por litro de aditivada vendido. A meta continua existindo só para acompanhamento."}
        </span>
      </div>

      {linkedToGoal && (
        <>
          <div className="field">
            <label>Forma de pagamento</label>
            <select className="input" value={payoutMode} onChange={(e) => setPayoutMode(e.target.value as PayoutMode)}>
              {Object.entries(PAYOUT_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Percentual mínimo de atingimento (%)</label>
            <input className="input" type="number" step="1" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}>
        <button className="btn small" onClick={submit} disabled={saving || !name || !unit || !commissionValue}>
          {saving ? "Salvando..." : initial ? "Salvar alterações" : "Criar item"}
        </button>
        <button
          className="btn secondary small"
          onClick={() => {
            setOpen(false);
            onCancel?.();
          }}
        >
          Cancelar
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

function ItemRow({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive(active: boolean) {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/items/${item.id}`, { active });
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao atualizar item.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Excluir "${item.name}" definitivamente? Essa ação não pode ser desfeita.`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/items/${item.id}`);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao excluir item.");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={8}>
          <ItemForm initial={item} onSaved={onChanged} onCancel={() => setEditing(false)} />
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ opacity: item.active ? 1 : 0.55 }}>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="item-icon sm">{itemIcon(item)}</span>
          {item.name} <span className="badge neutral">{item.unit}</span>
        </div>
      </td>
      <td>{CALC_LABEL[item.calculationType]}</td>
      <td>
        {COMMISSION_LABEL[item.commissionType]}: {item.commissionValue}
      </td>
      <td>
        {item.linkedToGoal ? (
          <span className="badge neutral">Vinculada à meta</span>
        ) : (
          <span className="badge ok">Paga por unidade</span>
        )}
      </td>
      <td>{item.linkedToGoal ? PAYOUT_LABEL[item.payoutMode] : "—"}</td>
      <td>{item.linkedToGoal ? `${item.achievementThresholdPercent}%` : "—"}</td>
      <td>
        <Switch checked={item.active} onChange={toggleActive} disabled={busy} />
      </td>
      <td>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <button className="btn secondary small" onClick={() => setEditing(true)}>
            Editar
          </button>
          <button className="btn danger small" onClick={remove} disabled={busy}>
            Excluir
          </button>
        </div>
        {error && (
          <p className="error-text" style={{ maxWidth: 220 }}>
            {error}
          </p>
        )}
      </td>
    </tr>
  );
}

export function OwnerItems() {
  const [items, setItems] = useState<Item[]>([]);

  function load() {
    api.get<Item[]>("/items?includeInactive=true").then(setItems);
  }
  useEffect(load, []);

  return (
    <div>
      <h1>Itens e comissionamento</h1>
      <p className="subtitle">
        Cadastre os itens de meta (mix, lubrificantes, palhetas, cheirinho, volume...) e configure como cada um gera comissão.
      </p>

      <div className="card section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ marginBottom: 0 }}>Itens cadastrados</h2>
          <ItemForm onSaved={load} />
        </div>
        <table className="table" style={{ marginTop: "0.8rem" }}>
          <thead>
            <tr>
              <th>Item</th>
              <th>Cálculo</th>
              <th>Comissionamento</th>
              <th>Vínculo com a meta</th>
              <th>Pagamento</th>
              <th>Meta mínima</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <ItemRow key={i.id} item={i} onChanged={load} />
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p>Nenhum item cadastrado ainda.</p>}
      </div>
    </div>
  );
}
