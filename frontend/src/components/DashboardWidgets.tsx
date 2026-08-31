import type { ItemBreakdownRow, RedemptionSummary } from "../types";
import { AchievementBadge, ProgressBar } from "./ProgressBar";

export function KpiCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="card stat">
      <span className="value">{value}</span>
      <span className="label">{label}</span>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  PAID: "Pago",
  REJECTED: "Rejeitado",
};
const STATUS_CLASS: Record<string, string> = {
  PENDING: "warn",
  APPROVED: "ok",
  PAID: "ok",
  REJECTED: "bad",
};

export function RedemptionSummaryCards({ summary }: { summary: RedemptionSummary }) {
  const statuses: (keyof RedemptionSummary)[] = ["PENDING", "APPROVED", "PAID", "REJECTED"];
  return (
    <div className="grid cols-3">
      {statuses.map((status) => (
        <div className="card stat" key={status}>
          <span className={`badge ${STATUS_CLASS[status]}`} style={{ marginBottom: "0.3rem" }}>
            {STATUS_LABEL[status]}
          </span>
          <span className="value">R$ {summary[status].amount.toFixed(2)}</span>
          <span className="label">{summary[status].count} resgate(s)</span>
        </div>
      ))}
    </div>
  );
}

export function ItemBreakdownTable({ rows }: { rows: ItemBreakdownRow[] }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Item</th>
          <th>Metas</th>
          <th>Atingimento médio</th>
          <th>Comissão gerada</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.itemId}>
            <td>
              {row.itemName} <span className="badge neutral">{row.unit}</span>
            </td>
            <td>{row.goalsCount}</td>
            <td style={{ minWidth: 140 }}>
              <ProgressBar percent={row.avgAchievement} />
            </td>
            <td>R$ {row.totalCommission.toFixed(2)}</td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={4}>Nenhuma meta com lançamentos neste período ainda.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export function HighlightCard({
  title,
  name,
  meta,
  achievement,
  empty,
}: {
  title: string;
  name?: string;
  meta?: string;
  achievement?: number;
  empty?: string;
}) {
  return (
    <div className="card">
      <h2 style={{ marginBottom: "0.5rem" }}>{title}</h2>
      {name ? (
        <>
          <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{name}</div>
          <p className="subtitle" style={{ margin: "0.2rem 0 0.5rem" }}>
            {meta}
          </p>
          {achievement !== undefined && <AchievementBadge percent={achievement} />}
        </>
      ) : (
        <p>{empty}</p>
      )}
    </div>
  );
}
