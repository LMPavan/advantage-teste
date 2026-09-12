import type { Challenge, ChallengeStatus } from "../types";
import { Avatar } from "./Avatar";

function timeLeft(endAt: string): string {
  const diff = new Date(endAt).getTime() - Date.now();
  if (diff <= 0) return "Encerrado";
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h restantes`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${mins}min restantes`;
}

const STATUS_LABEL: Record<ChallengeStatus, string> = {
  ACTIVE: "Em andamento",
  WON: "Vencido! 🎉",
  LOST: "Perdido",
  EXPIRED: "Expirado",
};
const STATUS_CLASS: Record<ChallengeStatus, string> = {
  ACTIVE: "neutral",
  WON: "ok",
  LOST: "bad",
  EXPIRED: "neutral",
};

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const isDuel = challenge.type === "DUEL";

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "0.6rem" }}>
        <div>
          <h2 style={{ marginBottom: "0.1rem" }}>
            {isDuel ? "⚔️" : "⚡"} {challenge.title}
          </h2>
          <span className="badge neutral">{challenge.item.name}</span>
        </div>
        <span className={`badge ${STATUS_CLASS[challenge.status]}`}>{STATUS_LABEL[challenge.status]}</span>
      </div>

      {isDuel ? (
        <div style={{ margin: "0.7rem 0", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Avatar name={challenge.attendant.name} photoUrl={challenge.attendant.photoUrl} size={26} />
            <span>{challenge.attendant.name}</span>
            <strong style={{ marginLeft: "auto" }}>
              {challenge.myValue} {challenge.item.unit}
            </strong>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Avatar name={challenge.opponent?.name ?? "?"} photoUrl={challenge.opponent?.photoUrl} size={26} />
            <span>{challenge.opponent?.name ?? "—"}</span>
            <strong style={{ marginLeft: "auto" }}>
              {challenge.opponentValue ?? 0} {challenge.item.unit}
            </strong>
          </div>
        </div>
      ) : (
        <p style={{ margin: "0.7rem 0" }}>
          Realizado: <strong>{challenge.myValue}</strong> de <strong>{challenge.targetValue}</strong> {challenge.item.unit}
        </p>
      )}

      <p className="subtitle" style={{ margin: 0 }}>
        {timeLeft(challenge.endAt)} · Bônus: <strong>R$ {challenge.bonusAmount.toFixed(2)}</strong>
      </p>
    </div>
  );
}
