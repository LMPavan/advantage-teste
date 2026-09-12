import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Item, MixSimulatorResult } from "../types";

export function OwnerMixSimulator() {
  const [items, setItems] = useState<Item[]>([]);
  const [itemId, setItemId] = useState("");
  const [newCommissionValue, setNewCommissionValue] = useState("");
  const [marginPerLiter, setMarginPerLiter] = useState("");
  const [saveMargin, setSaveMargin] = useState(true);
  const [result, setResult] = useState<MixSimulatorResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Item[]>("/items?includeInactive=true").then((all) => {
      const mixItems = all.filter((i) => i.calculationType === "MIX_RATIO");
      setItems(mixItems);
      if (mixItems.length > 0) setItemId(mixItems[0].id);
    });
  }, []);

  const item = items.find((i) => i.id === itemId) ?? null;

  useEffect(() => {
    if (!item) return;
    setNewCommissionValue(item.commissionValue);
    setMarginPerLiter(item.extraMarginPerLiter ?? "");
    setResult(null);
  }, [itemId]);

  async function simulate() {
    if (!item) return;
    setSaving(true);
    setError(null);
    try {
      if (saveMargin && marginPerLiter && Number(marginPerLiter) !== Number(item.extraMarginPerLiter ?? 0)) {
        await api.patch(`/items/${item.id}`, { extraMarginPerLiter: Number(marginPerLiter) });
      }
      const res = await api.post<MixSimulatorResult>(`/items/${item.id}/mix-simulator`, {
        newCommissionValue: Number(newCommissionValue),
        marginPerLiter: Number(marginPerLiter),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao simular.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>🧮 Simulador de comissão do mix</h1>
      <p className="subtitle">
        Veja quanto custa mudar a comissão de um item de mix (ex.: Mix Aditivada) e quanto o mix médio da rede
        precisaria crescer pra que o lucro extra da aditivada pague essa mudança.
      </p>

      {items.length === 0 && <p>Nenhum item do tipo mix cadastrado ainda.</p>}

      {items.length > 0 && (
        <div className="card section">
          <div className="grid cols-2">
            <div className="field">
              <label>Item</label>
              <select className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {item && (
            <>
              <div className="grid cols-2">
                <div className="field">
                  <label>Nova comissão (hoje: {item.commissionValue})</label>
                  <input
                    className="input"
                    type="number"
                    step="0.0001"
                    value={newCommissionValue}
                    onChange={(e) => setNewCommissionValue(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Lucro extra da aditivada sobre a comum (R$/litro)</label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={marginPerLiter}
                    onChange={(e) => setMarginPerLiter(e.target.value)}
                    placeholder="Ex.: 0.15"
                  />
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}>
                <input type="checkbox" checked={saveMargin} onChange={(e) => setSaveMargin(e.target.checked)} />
                Salvar essa margem no item, pra não precisar digitar de novo
              </label>

              <button
                className="btn"
                style={{ marginTop: "0.6rem" }}
                onClick={simulate}
                disabled={saving || !newCommissionValue || !marginPerLiter}
              >
                {saving ? "Calculando..." : "Simular"}
              </button>
              {error && <p className="error-text">{error}</p>}
            </>
          )}
        </div>
      )}

      {result && (
        <div className="card section">
          <h2>Resultado</h2>
          <p>
            Mix médio da rede hoje: <strong>{result.currentMixPercent}%</strong> (de {result.totalLiters} L
            vendidos no período)
          </p>
          <p>
            Custo mensal atual desse item: <strong>R$ {result.currentMonthlyCost.toFixed(2)}</strong>
          </p>

          {result.extraCostAtSameMix <= 0 ? (
            <p style={{ marginTop: "0.6rem" }}>
              Essa comissão nova <strong>não custa mais</strong> do que a de hoje (mantendo o mix atual) — pode
              aplicar sem precisar de nenhum crescimento extra.
            </p>
          ) : (
            <>
              <p style={{ marginTop: "0.6rem" }}>
                Mantendo o mix de hoje, mudar pra essa comissão custaria{" "}
                <strong>R$ {result.extraCostAtSameMix.toFixed(2)} a mais por mês</strong>.
              </p>
              {result.breakEvenReached ? (
                <p>
                  Com R$ {result.marginPerLiter.toFixed(2)}/litro de lucro extra na aditivada, o mix médio precisaria
                  subir de <strong>{result.currentMixPercent}%</strong> para{" "}
                  <strong>{result.requiredMixPercent}%</strong> (
                  <strong>+{result.requiredMixGrowthPoints} pontos percentuais</strong>) pra essa margem extra pagar
                  sozinha o aumento de comissão.
                </p>
              ) : (
                <p className="error-text">
                  Mesmo levando o mix a 100%, o lucro extra informado (R$ {result.marginPerLiter.toFixed(2)}/litro)
                  não cobre esse aumento de comissão. Considere uma comissão menor ou confirme se a margem
                  informada está certa.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
