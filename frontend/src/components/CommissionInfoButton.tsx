import { useState } from "react";
import type { Item } from "../types";
import { describeCommissionCondition, describeCommissionRate } from "../utils/commissionRule";

/** Botão "ℹ️" que explica em linguagem simples como a comissão deste item é calculada e paga. */
export function CommissionInfoButton({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn secondary small"
        title="Como funciona a comissão deste item"
        onClick={() => setOpen(true)}
        style={{ padding: "0.2rem 0.5rem" }}
      >
        ℹ️
      </button>
      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>💰 Comissão de {item.name}</h2>
            <p style={{ margin: "0.4rem 0" }}>
              <strong>{describeCommissionRate(item)}.</strong>
            </p>
            <p className="subtitle" style={{ margin: 0 }}>
              {describeCommissionCondition(item)}
            </p>
            <button className="btn small" onClick={() => setOpen(false)} style={{ width: "100%", marginTop: "1rem" }}>
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
