import type { PaceAlert } from "../types";

export function AlertsPanel({ alerts }: { alerts: PaceAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <div className="card section" style={{ borderLeft: "4px solid var(--warn, #eab308)" }}>
      <h2>⏱️ Alertas de ritmo</h2>
      <p className="subtitle" style={{ marginTop: 0 }}>
        No ritmo atual, essas metas devem fechar o período abaixo do esperado — ainda dá tempo de reagir.
      </p>
      <div className="grid cols-2">
        {alerts.map((a, i) => (
          <div className="card stat" key={`${a.stationId}-${a.attendantId}-${a.itemName}-${i}`} style={{ alignItems: "flex-start" }}>
            <span style={{ fontWeight: 700 }}>
              {a.attendantName} · {a.itemName}
            </span>
            <span className="label">{a.stationName}</span>
            <span className="subtitle" style={{ margin: "0.3rem 0 0" }}>{a.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
