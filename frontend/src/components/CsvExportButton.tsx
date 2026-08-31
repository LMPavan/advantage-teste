import { useState } from "react";
import { getToken } from "../api/client";

export function CsvExportButton() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch("/api/dashboard/export-csv", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "comissoes.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Não foi possível exportar o CSV.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: "0.2rem" }}>
      <button className="btn secondary small" onClick={download} disabled={downloading}>
        {downloading ? "Exportando..." : "⬇️ Exportar comissões (CSV)"}
      </button>
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
