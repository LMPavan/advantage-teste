import type { XpSummary } from "../types";

const LEVEL_COLOR: Record<string, string> = {
  Bronze: "#c2703d",
  Prata: "#9aa4bf",
  Ouro: "#eab308",
  Platina: "#38bdf8",
  Diamante: "#a78bfa",
};

/** Progressão de longo prazo do frentista (não zera todo mês, diferente do ranking/medalhas mensais). */
export function XpBar({ xp }: { xp: XpSummary }) {
  const color = LEVEL_COLOR[xp.level] ?? "var(--primary)";

  return (
    <div className="card section">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "2.4rem",
              height: "2.4rem",
              borderRadius: "50%",
              background: color,
              color: "white",
              fontWeight: 800,
              fontSize: "1.1rem",
            }}
          >
            {xp.levelIndex + 1}
          </span>
          <div>
            <strong>Nível {xp.level}</strong>
            <div className="meta">{xp.xp} XP acumulado</div>
          </div>
        </div>
        {xp.nextLevel && (
          <span className="subtitle" style={{ margin: 0 }}>
            Faltam {Math.max(0, (xp.nextLevelAt ?? 0) - xp.xp)} XP para {xp.nextLevel}
          </span>
        )}
      </div>
      <div className="progress-track" style={{ marginTop: "0.6rem" }}>
        <div className="progress-fill" style={{ width: `${xp.progressToNextPercent}%`, background: color }} />
      </div>
    </div>
  );
}
