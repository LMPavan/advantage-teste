import type { Badge } from "../types";

export function BadgeTile({ badge }: { badge: Badge }) {
  return (
    <div className={`badge-tile ${badge.achieved ? "achieved" : "locked"}`} title={badge.description}>
      <div className="badge-tile-icon">{badge.icon}</div>
      <div className="badge-tile-label">{badge.label}</div>
    </div>
  );
}

export function BadgeGrid({ badges }: { badges: Badge[] }) {
  return (
    <div className="badge-grid">
      {badges.map((b) => (
        <BadgeTile key={b.id} badge={b} />
      ))}
    </div>
  );
}

/** Tira compacta com apenas as medalhas já conquistadas, para exibir em outras telas. */
export function BadgeShelf({ badges }: { badges: Badge[] }) {
  const achieved = badges.filter((b) => b.achieved);
  if (achieved.length === 0) return null;
  return (
    <div className="badge-shelf">
      {achieved.map((b) => (
        <span key={b.id} className="badge-shelf-item" title={`${b.label} — ${b.description}`}>
          {b.icon}
        </span>
      ))}
    </div>
  );
}
