import type { MonthlyHistoryPoint } from "../types";

function formatMonthLabel(month: string) {
  const [year, monthNum] = month.split("-");
  return `${monthNum}/${year.slice(2)}`;
}

export function MonthlyHistoryChart({ data }: { data: MonthlyHistoryPoint[] }) {
  if (data.length === 0) {
    return <p>Sem histórico suficiente ainda.</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.totalCommission));

  return (
    <div className="bar-chart-wrap">
      <div className="bar-chart">
        {data.map((d) => (
          <div
            className="bar-chart-col"
            key={d.month}
            title={`${formatMonthLabel(d.month)}: R$ ${d.totalCommission.toFixed(2)} · ${d.avgAchievement.toFixed(1)}% de atingimento médio`}
          >
            <div className="bar-chart-bar" style={{ height: `${Math.max(2, (d.totalCommission / max) * 100)}%` }} />
            <div className="bar-chart-label">{formatMonthLabel(d.month)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
