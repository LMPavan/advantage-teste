import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { ManagerCommissionMode, Station } from "../types";

function NewStationForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
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
        razaoSocial: razaoSocial || undefined,
        code,
        address: address || undefined,
        manager:
          managerName && managerEmail && managerPassword
            ? { name: managerName, email: managerEmail, password: managerPassword }
            : undefined,
      });
      setName("");
      setRazaoSocial("");
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
        <label>Razão social (opcional)</label>
        <input className="input" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Ex.: Posto Central Combustíveis Ltda." />
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

function StationInfoEditor({ station, onUpdated }: { station: Station; onUpdated: () => void }) {
  const [razaoSocial, setRazaoSocial] = useState(station.razaoSocial ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/stations/${station.id}/info`, { razaoSocial });
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label>Razão social</label>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input className="input" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Nome jurídico do posto" />
        <button className="btn secondary small" onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
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

const PERMISSION_FIELDS: { key: keyof Station & string; label: string; hint: string }[] = [
  { key: "managerCanManageGoals", label: "Cadastrar/editar metas e valores", hint: "Criar metas e definir os valores-alvo de cada item." },
  { key: "managerCanManageTeam", label: "Cadastrar frentistas", hint: "Criar novos frentistas para o posto." },
  { key: "managerCanManageRedemptionPolicy", label: "Definir periodicidade de resgate", hint: "Liberar resgate diário/semanal/mensal." },
  { key: "managerCanRegenerateInviteCode", label: "Regenerar código de frentista", hint: "Gerar um novo código de convite para frentistas." },
];

function ManagerPermissionsEditor({ station, onUpdated }: { station: Station; onUpdated: () => void }) {
  const [saving, setSaving] = useState<string | null>(null);

  async function toggle(field: string) {
    setSaving(field);
    try {
      await api.patch(`/stations/${station.id}/permissions`, { [field]: !station[field as keyof Station] });
      onUpdated();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid cols-2">
      {PERMISSION_FIELDS.map((f) => (
        <label key={f.key} style={{ display: "flex", gap: "0.5rem", alignItems: "start", fontSize: "0.85rem" }}>
          <input
            type="checkbox"
            checked={!!station[f.key]}
            disabled={saving === f.key}
            onChange={() => toggle(f.key)}
            style={{ marginTop: "0.2rem" }}
          />
          <span>
            <div>{f.label}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{f.hint}</div>
          </span>
        </label>
      ))}
    </div>
  );
}

const MANAGER_COMMISSION_LABEL: Record<ManagerCommissionMode, string> = {
  NONE: "Sem comissão",
  TEAM_SUM: "Percentual sobre a soma da comissão da equipe",
  CUSTOM: "Personalizada (metas próprias do gerente)",
};

function ManagerCommissionEditor({ station, onUpdated }: { station: Station; onUpdated: () => void }) {
  const [mode, setMode] = useState<ManagerCommissionMode>(station.managerCommissionMode);
  const [percent, setPercent] = useState(station.managerCommissionPercent);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/stations/${station.id}/manager-commission`, {
        managerCommissionMode: mode,
        managerCommissionPercent: Number(percent),
      });
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid cols-2">
      <div className="field">
        <label>Como o gerente ganha comissão</label>
        <select className="input" value={mode} onChange={(e) => setMode(e.target.value as ManagerCommissionMode)}>
          {Object.entries(MANAGER_COMMISSION_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {mode === "TEAM_SUM" && (
        <div className="field">
          <label>Percentual sobre a comissão da equipe (%)</label>
          <input className="input" type="number" step="1" value={percent} onChange={(e) => setPercent(e.target.value)} />
        </div>
      )}
      {mode === "CUSTOM" && (
        <p className="subtitle" style={{ margin: 0, gridColumn: "1 / -1" }}>
          Cadastre uma meta pessoal para o gerente em "Equipe e metas" (tela do gerente), escolhendo o
          próprio gerente como responsável — a comissão é calculada como a de um frentista.
        </p>
      )}
      <div style={{ gridColumn: mode === "TEAM_SUM" ? "1 / -1" : undefined }}>
        <button className="btn small" onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}

function StationRow({ station, onUpdated }: { station: Station; onUpdated: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr>
        <td>
          {station.name}
          {station.razaoSocial && (
            <div className="meta" style={{ fontSize: "0.78rem" }}>
              {station.razaoSocial}
            </div>
          )}
        </td>
        <td>{station.code}</td>
        <td>{station.manager?.name ?? "—"}</td>
        <td>{station._count?.attendants ?? 0}</td>
        <td>
          <button className="btn secondary small" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Ocultar detalhes ▴" : "Gerenciar ▾"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5}>
            <div className="grid cols-2" style={{ padding: "0.8rem 0" }}>
              <div className="card">
                <h2 style={{ marginBottom: "0.5rem" }}>Dados cadastrais</h2>
                <StationInfoEditor station={station} onUpdated={onUpdated} />
              </div>
              <div className="card">
                <h2 style={{ marginBottom: "0.5rem" }}>Códigos de convite</h2>
                <InviteCodesCell station={station} onUpdated={onUpdated} />
              </div>
              <div className="card">
                <h2 style={{ marginBottom: "0.5rem" }}>Resgates liberados</h2>
                <PolicyEditor station={station} onUpdated={onUpdated} />
              </div>
              <div className="card" style={{ gridColumn: "1 / -1" }}>
                <h2 style={{ marginBottom: "0.2rem" }}>Permissões do gerente</h2>
                <p className="subtitle" style={{ marginTop: 0 }}>
                  O que o gerente deste posto pode cadastrar e editar. O dono sempre pode tudo, independente destas opções.
                </p>
                <ManagerPermissionsEditor station={station} onUpdated={onUpdated} />
              </div>
              <div className="card" style={{ gridColumn: "1 / -1" }}>
                <h2 style={{ marginBottom: "0.2rem" }}>Comissão do gerente</h2>
                <p className="subtitle" style={{ marginTop: 0 }}>
                  O gerente também pode ganhar comissão: como percentual sobre o total gerado pela
                  equipe, ou de forma personalizada, com metas próprias.
                </p>
                <ManagerCommissionEditor station={station} onUpdated={onUpdated} />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
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
      <p className="subtitle">
        Cadastre postos da rede e gerencie códigos de convite, resgates e permissões de cada gerente.
      </p>

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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => (
              <StationRow key={s.id} station={s} onUpdated={load} />
            ))}
          </tbody>
        </table>
        {stations.length === 0 && <p>Nenhum posto cadastrado ainda.</p>}
      </div>
    </div>
  );
}
