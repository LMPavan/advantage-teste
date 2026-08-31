import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { CommissionType, GoalDirection, Item, ItemCalculationType, PayoutMode } from "../types";

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

function NewItemForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("L");
  const [calculationType, setCalculationType] = useState<ItemCalculationType>("SIMPLE");
  const [direction, setDirection] = useState<GoalDirection>("HIGHER_IS_BETTER");
  const [commissionType, setCommissionType] = useState<CommissionType>("CURRENCY_PER_UNIT");
  const [commissionValue, setCommissionValue] = useState("");
  const [linkedToGoal, setLinkedToGoal] = useState(true);
  const [payoutMode, setPayoutMode] = useState<PayoutMode>("PROPORTIONAL");
  const [threshold, setThreshold] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.post("/items", {
        name,
        unit,
        calculationType,
        direction,
        commissionType,
        commissionValue: Number(commissionValue),
        linkedToGoal,
        payoutMode,
        achievementThresholdPercent: Number(threshold),
      });
      setName("");
      setCommissionValue("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao criar item.");
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
          {saving ? "Salvando..." : "Criar item"}
        </button>
        <button className="btn secondary small" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export function OwnerItems() {
  const [items, setItems] = useState<Item[]>([]);

  function load() {
    api.get<Item[]>("/items").then(setItems);
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
          <NewItemForm onCreated={load} />
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
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td>
                  {i.name} <span className="badge neutral">{i.unit}</span>
                </td>
                <td>{CALC_LABEL[i.calculationType]}</td>
                <td>
                  {COMMISSION_LABEL[i.commissionType]}: {i.commissionValue}
                </td>
                <td>
                  {i.linkedToGoal ? (
                    <span className="badge neutral">Vinculada à meta</span>
                  ) : (
                    <span className="badge ok">Paga por unidade</span>
                  )}
                </td>
                <td>{i.linkedToGoal ? PAYOUT_LABEL[i.payoutMode] : "—"}</td>
                <td>{i.linkedToGoal ? `${i.achievementThresholdPercent}%` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p>Nenhum item cadastrado ainda.</p>}
      </div>
    </div>
  );
}
