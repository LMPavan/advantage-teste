import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { WeeklyDigest } from "../types";

const LAST_SHOWN_KEY = "fuelgoals_weekly_digest_last_shown";

function wasShownFor(weekEnd: string): boolean {
  try {
    return localStorage.getItem(LAST_SHOWN_KEY) === weekEnd;
  } catch {
    return false;
  }
}
function markShown(weekEnd: string) {
  try {
    localStorage.setItem(LAST_SHOWN_KEY, weekEnd);
  } catch {
    // ignora
  }
}

function formatDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

/**
 * Resumo semanal exibido automaticamente pro dono ao entrar, uma vez por semana (sem infra de
 * e-mail configurada no ambiente, essa é a versão "dentro do app" do digest semanal).
 */
export function WeeklyDigestModal() {
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.get<WeeklyDigest>("/dashboard/weekly-digest").then((d) => {
      if (!wasShownFor(d.weekEnd)) setDigest(d);
    });
  }, []);

  if (!digest || dismissed) return null;

  function close() {
    if (digest) markShown(digest.weekEnd);
    setDismissed(true);
  }

  const trendUp = digest.changePercent !== null && digest.changePercent >= 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={close}
    >
      <div className="card" style={{ maxWidth: 520, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>📬 Resumo da semana</h2>
        <p className="subtitle" style={{ marginTop: 0 }}>
          {formatDate(digest.weekStart)} a {formatDate(digest.weekEnd)}
        </p>

        <div className="grid cols-2" style={{ margin: "0.8rem 0" }}>
          <div className="card stat">
            <span className="value">R$ {digest.totalEstimatedCommission.toFixed(2)}</span>
            <span className="label">Comissão estimada na semana</span>
          </div>
          <div className="card stat">
            <span className="value" style={{ color: trendUp ? "var(--success)" : "var(--danger)" }}>
              {digest.changePercent === null ? "—" : `${trendUp ? "+" : ""}${digest.changePercent}%`}
            </span>
            <span className="label">vs. semana anterior</span>
          </div>
        </div>

        {digest.topStation && (
          <p>
            🏆 Posto destaque: <strong>{digest.topStation.stationName}</strong> (R$ {digest.topStation.estimatedCommission.toFixed(2)})
          </p>
        )}
        {digest.topAttendant && (
          <p>
            ⭐ Frentista destaque: <strong>{digest.topAttendant.name}</strong> ({digest.topAttendant.stationName})
          </p>
        )}
        {digest.activeAlertsCount > 0 && (
          <p className="subtitle">
            ⏱️ {digest.activeAlertsCount} meta(s) fora do ritmo esperado agora — veja os alertas no dashboard.
          </p>
        )}

        <button className="btn" style={{ width: "100%", marginTop: "0.6rem" }} onClick={close}>
          Fechar
        </button>
      </div>
    </div>
  );
}
