export function ProgressBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(percent, 130));
  const cls = percent >= 100 ? "ok" : percent >= 70 ? "warn" : "";
  return (
    <div className="progress-track">
      <div className={`progress-fill ${cls}`} style={{ width: `${Math.min(clamped, 100)}%` }} />
    </div>
  );
}

export function AchievementBadge({ percent }: { percent: number }) {
  const cls = percent >= 100 ? "ok" : percent >= 70 ? "warn" : "bad";
  return <span className={`badge ${cls}`}>{percent.toFixed(1)}%</span>;
}
