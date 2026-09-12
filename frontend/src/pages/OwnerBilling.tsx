import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Billing } from "../types";

export function OwnerBilling() {
  const [billing, setBilling] = useState<Billing | null>(null);

  useEffect(() => {
    api.get<Billing>("/billing").then(setBilling);
  }, []);

  return (
    <div>
      <h1>Assinatura</h1>
      <p className="subtitle">
        A mensalidade da plataforma tem uma base fixa, que já cobre alguns postos, e soma um valor menor
        por posto adicional — sem saltos bruscos ao crescer a rede.
      </p>

      {!billing && <p>Carregando...</p>}

      {billing && (
        <>
          <div className="grid cols-3 section">
            <div className="card stat">
              <span className="value">{billing.stationsCount}</span>
              <span className="label">Postos na rede</span>
            </div>
            <div className="card stat">
              <span className="value">{billing.planName}</span>
              <span className="label">Plano atual</span>
            </div>
            <div className="card stat">
              <span className="value">R$ {billing.totalMonthly.toFixed(2)}</span>
              <span className="label">Mensalidade total</span>
            </div>
          </div>

          <div className="card section">
            <h2>Como a mensalidade é calculada</h2>
            <table className="table">
              <tbody>
                <tr>
                  <td>Base do plano (cobre até {billing.includedStations} posto(s))</td>
                  <td style={{ textAlign: "right" }}>R$ {billing.baseFee.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>
                    Postos extras ({billing.extraStations} × R$ {billing.pricePerExtraStation.toFixed(2)})
                  </td>
                  <td style={{ textAlign: "right" }}>R$ {billing.extraCost.toFixed(2)}</td>
                </tr>
                <tr>
                  <td>
                    <strong>Total mensal</strong>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <strong>R$ {billing.totalMonthly.toFixed(2)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="subtitle" style={{ marginTop: "1rem", marginBottom: 0 }}>
              Ao cadastrar um novo posto, a mensalidade recalcula automaticamente a partir do mês seguinte.
              Nenhuma cobrança é processada aqui — este valor é informativo, pra você acompanhar o custo
              da assinatura conforme a rede cresce.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
