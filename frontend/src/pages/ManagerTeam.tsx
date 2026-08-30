import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Attendant, Goal, Item, Period, Station, TeamDashboard } from "../types";
import { AchievementBadge, ProgressBar } from "../components/ProgressBar";

function InviteCodeCard({ station, onUpdated }: { station: Station; onUpdated: () => void }) {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  async function copy() {
    if (!station.attendantInviteCode) return;
    await navigator.clipboard.writeText(station.attendantInviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function regenerate() {
    setRegenerating(true);
    try {
      await api.post(`/stations/${station.id}/invite-codes/regenerate`, { type: "ATTENDANT" });
      onUpdated();
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="card section">
      <h2>Código de convite para frentistas</h2>
      <p className="subtitle" style={{ marginBottom: "0.6rem" }}>
        Compartilhe este código com novos funcionários para que eles se cadastrem sozinhos já vinculados ao seu posto.
      </p>
      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
        <span className="invite-code">{station.attendantInviteCode}</span>
        <button className="btn secondary small" onClick={copy}>
          {copied ? "Copiado!" : "Copiar"}
        </button>
        {station.managerCanRegenerateInviteCode && (
          <button className="btn secondary small" onClick={regenerate} disabled={regenerating}>
            {regenerating ? "Gerando..." : "Gerar novo código"}
          </button>
        )}
      </div>
    </div>
  );
}

const PERIOD_LABEL: Record<Period, string> = { DAILY: "Diária", WEEKLY: "Semanal", MONTHLY: "Mensal" };

function monthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function NewAttendantForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.post("/users/attendants", { name, email, password });
      setName("");
      setEmail("");
      setPassword("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao criar frentista.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="btn small" onClick={() => setOpen(true)}>
        + Novo frentista
      </button>
    );
  }

  return (
    <div className="inline-form">
      <div className="field">
        <label>Nome</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>E-mail</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label>Senha inicial</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <button className="btn small" onClick={submit} disabled={saving}>
        {saving ? "Salvando..." : "Criar"}
      </button>
      <button className="btn secondary small" onClick={() => setOpen(false)}>
        Cancelar
      </button>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

function NewGoalForm({ items, attendants, onCreated }: { items: Item[]; attendants: Attendant[]; onCreated: () => void }) {
  const range = monthRange();
  const [itemId, setItemId] = useState("");
  const [attendantId, setAttendantId] = useState("");
  const [period, setPeriod] = useState<Period>("MONTHLY");
  const [targetValue, setTargetValue] = useState("");
  const [startDate, setStartDate] = useState(range.start);
  const [endDate, setEndDate] = useState(range.end);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.post("/goals", {
        itemId,
        attendantId: attendantId || undefined,
        period,
        targetValue: Number(targetValue),
        startDate,
        endDate,
      });
      setTargetValue("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao criar meta.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="btn small" onClick={() => setOpen(true)}>
        + Nova meta
      </button>
    );
  }

  return (
    <div className="inline-form">
      <div className="field">
        <label>Item</label>
        <select className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
          <option value="">Selecione...</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Frentista</label>
        <select className="input" value={attendantId} onChange={(e) => setAttendantId(e.target.value)}>
          <option value="">Meta coletiva do posto</option>
          {attendants.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Periodicidade</label>
        <select className="input" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          {(["DAILY", "WEEKLY", "MONTHLY"] as Period[]).map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABEL[p]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Valor da meta</label>
        <input className="input" type="number" step="0.01" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
      </div>
      <div className="field">
        <label>Início</label>
        <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <div className="field">
        <label>Fim</label>
        <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>
      <button className="btn small" onClick={submit} disabled={saving || !itemId || !targetValue}>
        {saving ? "Salvando..." : "Criar meta"}
      </button>
      <button className="btn secondary small" onClick={() => setOpen(false)}>
        Cancelar
      </button>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export function ManagerTeam() {
  const [team, setTeam] = useState<TeamDashboard | null>(null);
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [station, setStation] = useState<Station | null>(null);

  function load() {
    api.get<TeamDashboard>("/dashboard/team").then(setTeam);
    api.get<Attendant[]>("/users/team").then(setAttendants);
    api.get<Item[]>("/items").then(setItems);
    api.get<Goal[]>("/goals").then(setGoals);
    api.get<Station[]>("/stations").then((stations) => setStation(stations[0] ?? null));
  }

  useEffect(load, []);

  return (
    <div>
      <h1>Equipe e metas</h1>
      <p className="subtitle">Gerencie o time do seu posto e defina as metas de cada item.</p>

      {station && <InviteCodeCard station={station} onUpdated={load} />}

      <div className="card section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ marginBottom: 0 }}>Desempenho do time</h2>
          {station?.managerCanManageTeam !== false && <NewAttendantForm onCreated={load} />}
        </div>
        <table className="table" style={{ marginTop: "0.8rem" }}>
          <thead>
            <tr>
              <th>Frentista</th>
              <th>Metas</th>
              <th>Atingimento médio</th>
              <th>Comissão gerada</th>
            </tr>
          </thead>
          <tbody>
            {team?.attendants.map((a) => (
              <tr key={a.attendantId}>
                <td>{a.name}</td>
                <td>{a.goalsCount}</td>
                <td>
                  <AchievementBadge percent={a.avgAchievement} />
                </td>
                <td>R$ {a.totalCommission.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {team && team.attendants.length === 0 && <p>Nenhum frentista cadastrado ainda.</p>}
      </div>

      <div className="card section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ marginBottom: 0 }}>Metas do posto</h2>
          {station?.managerCanManageGoals !== false ? (
            <NewGoalForm items={items} attendants={attendants} onCreated={load} />
          ) : (
            <span className="subtitle" style={{ margin: 0 }}>
              O dono da rede não liberou o cadastro de metas para você.
            </span>
          )}
        </div>
        <table className="table" style={{ marginTop: "0.8rem" }}>
          <thead>
            <tr>
              <th>Item</th>
              <th>Frentista</th>
              <th>Período</th>
              <th>Atingimento</th>
              <th>Comissão</th>
            </tr>
          </thead>
          <tbody>
            {goals.map((g) => (
              <tr key={g.id}>
                <td>{g.item.name}</td>
                <td>{g.attendant?.name ?? "Time todo"}</td>
                <td>{PERIOD_LABEL[g.period]}</td>
                <td style={{ minWidth: 160 }}>
                  <ProgressBar percent={g.progress.achievementPercent} />
                </td>
                <td>R$ {g.progress.commissionAmount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
