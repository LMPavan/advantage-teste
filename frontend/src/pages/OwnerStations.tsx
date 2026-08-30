import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Station } from "../types";

function NewStationForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.post("/stations", {
        name,
        code,
        address: address || undefined,
        manager:
          managerName && managerEmail && managerPassword
            ? { name: managerName, email: managerEmail, password: managerPassword }
            : undefined,
      });
      setName("");
      setCode("");
      setAddress("");
      setManagerName("");
      setManagerEmail("");
      setManagerPassword("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao criar posto.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="btn small" onClick={() => setOpen(true)}>
        + Novo posto
      </button>
    );
  }

  return (
    <div className="grid cols-2" style={{ marginTop: "0.6rem" }}>
      <div className="field">
        <label>Nome do posto</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Código</label>
        <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      <div className="field">
        <label>Endereço (opcional)</label>
        <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div />
      <div className="field">
        <label>Nome do gerente (opcional)</label>
        <input className="input" value={managerName} onChange={(e) => setManagerName(e.target.value)} />
      </div>
      <div className="field">
        <label>E-mail do gerente</label>
        <input className="input" type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} />
      </div>
      <div className="field">
        <label>Senha inicial do gerente</label>
        <input className="input" type="password" value={managerPassword} onChange={(e) => setManagerPassword(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}>
        <button className="btn small" onClick={submit} disabled={saving || !name || !code}>
          {saving ? "Salvando..." : "Criar posto"}
        </button>
        <button className="btn secondary small" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

function PolicyEditor({ station, onUpdated }: { station: Station; onUpdated: () => void }) {
  const [saving, setSaving] = useState(false);

  async function toggle(field: "allowDaily" | "allowWeekly" | "allowMonthly") {
    setSaving(true);
    try {
      await api.patch(`/stations/${station.id}/redemption-policy`, {
        [field]: !station.redemptionPolicy?.[field],
      });
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: "0.8rem", fontSize: "0.85rem" }}>
      <label style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
        <input type="checkbox" checked={!!station.redemptionPolicy?.allowDaily} disabled={saving} onChange={() => toggle("allowDaily")} />
        Diário
      </label>
      <label style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
        <input type="checkbox" checked={!!station.redemptionPolicy?.allowWeekly} disabled={saving} onChange={() => toggle("allowWeekly")} />
        Semanal
      </label>
      <label style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
        <input type="checkbox" checked={!!station.redemptionPolicy?.allowMonthly} disabled={saving} onChange={() => toggle("allowMonthly")} />
        Mensal
      </label>
    </div>
  );
}

function InviteCodesCell({ station, onUpdated }: { station: Station; onUpdated: () => void }) {
  const [copiedType, setCopiedType] = useState<"MANAGER" | "ATTENDANT" | null>(null);
  const [regenerating, setRegenerating] = useState<"MANAGER" | "ATTENDANT" | null>(null);

  async function copy(type: "MANAGER" | "ATTENDANT", code?: string) {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 1500);
  }

  async function regenerate(type: "MANAGER" | "ATTENDANT") {
    setRegenerating(type);
    try {
      await api.post(`/stations/${station.id}/invite-codes/regenerate`, { type });
      onUpdated();
    } finally {
      setRegenerating(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.8rem" }}>
      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
        <span style={{ color: "var(--text-muted)", minWidth: 60 }}>Gerente:</span>
        <span className="invite-code">{station.managerInviteCode}</span>
        <button className="btn secondary small" onClick={() => copy("MANAGER", station.managerInviteCode)}>
          {copiedType === "MANAGER" ? "✓" : "Copiar"}
        </button>
        <button className="btn secondary small" onClick={() => regenerate("MANAGER")} disabled={regenerating === "MANAGER"}>
          ↻
        </button>
      </div>
      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
        <span style={{ color: "var(--text-muted)", minWidth: 60 }}>Frentista:</span>
        <span className="invite-code">{station.attendantInviteCode}</span>
        <button className="btn secondary small" onClick={() => copy("ATTENDANT", station.attendantInviteCode)}>
          {copiedType === "ATTENDANT" ? "✓" : "Copiar"}
        </button>
        <button className="btn secondary small" onClick={() => regenerate("ATTENDANT")} disabled={regenerating === "ATTENDANT"}>
          ↻
        </button>
      </div>
    </div>
  );
}

export function OwnerStations() {
  const [stations, setStations] = useState<Station[]>([]);

  function load() {
    api.get<Station[]>("/stations").then(setStations);
  }
  useEffect(load, []);

  return (
    <div>
      <h1>Postos</h1>
      <p className="subtitle">Cadastre postos da rede e defina quais periodicidades de resgate ficam liberadas em cada um.</p>

      <div className="card section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ marginBottom: 0 }}>Postos cadastrados</h2>
          <NewStationForm onCreated={load} />
        </div>
        <table className="table" style={{ marginTop: "0.8rem" }}>
          <thead>
            <tr>
              <th>Posto</th>
              <th>Código</th>
              <th>Gerente</th>
              <th>Frentistas</th>
              <th>Códigos de convite</th>
              <th>Resgates liberados</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.code}</td>
                <td>{s.manager?.name ?? "—"}</td>
                <td>{s._count?.attendants ?? 0}</td>
                <td>
                  <InviteCodesCell station={s} onUpdated={load} />
                </td>
                <td>
                  <PolicyEditor station={s} onUpdated={load} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {stations.length === 0 && <p>Nenhum posto cadastrado ainda.</p>}
      </div>
    </div>
  );
}
