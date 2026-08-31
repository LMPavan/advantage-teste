export interface BarChartPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

function formatDayLabel(date: string) {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

export function DailyBarChart({ data, valuePrefix = "R$ " }: { data: BarChartPoint[]; valuePrefix?: string }) {
  if (data.length === 0) {
    return <p>Sem lançamentos no período selecionado.</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="bar-chart-wrap">
      <div className="bar-chart">
        {data.map((d) => (
          <div className="bar-chart-col" key={d.date} title={`${formatDayLabel(d.date)}: ${valuePrefix}${d.value.toFixed(2)}`}>
            <div className="bar-chart-bar" style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }} />
            <div className="bar-chart-label">{formatDayLabel(d.date)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
