import type { BenchmarkResult } from "../types";

function Row({ label, yours, market, suffix }: { label: string; yours: number; market: number; suffix: string }) {
  const ahead = yours >= market;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
      <span className="label">{label}</span>
      <span>
        <strong>
          {yours.toFixed(1)}
          {suffix}
        </strong>{" "}
        <span className="subtitle" style={{ margin: 0 }}>
          vs. mercado {market.toFixed(1)}
          {suffix}
        </span>{" "}
        <span className={`badge ${ahead ? "ok" : "warn"}`}>{ahead ? "acima" : "abaixo"}</span>
      </span>
    </div>
  );
}

export function BenchmarkCard({ benchmark }: { benchmark: BenchmarkResult }) {
  return (
    <div className="card section">
      <h2>📊 Benchmark anônimo de mercado</h2>
      {benchmark.networksCompared === 0 ? (
        <p className="subtitle" style={{ marginTop: 0 }}>
          Ainda não há outras redes na plataforma para comparar.
        </p>
      ) : (
        <>
          <p className="subtitle" style={{ marginTop: 0 }}>
            Comparado de forma anônima com a média de {benchmark.networksCompared} outra(s) rede(s) na plataforma.
          </p>
          <Row label="Atingimento médio" yours={benchmark.yourAvgAchievement} market={benchmark.marketAvgAchievement} suffix="%" />
          <Row
            label="Comissão média por posto"
            yours={benchmark.yourAvgCommissionPerStation}
            market={benchmark.marketAvgCommissionPerStation}
            suffix=" R$"
          />
        </>
      )}
    </div>
  );
}
