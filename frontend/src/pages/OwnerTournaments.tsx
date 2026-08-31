import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Tournament, TournamentMetric } from "../types";
import { TournamentCard } from "../components/TournamentCard";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function inDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function NewTournamentForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [prizeDescription, setPrizeDescription] = useState("");
  const [metric, setMetric] = useState<TournamentMetric>("AVG_ACHIEVEMENT");
  const [startAt, setStartAt] = useState(todayIso());
  const [endAt, setEndAt] = useState(inDaysIso(7));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.post("/tournaments", { title, prizeDescription, metric, startAt, endAt });
      setTitle("");
      setPrizeDescription("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao criar torneio.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="btn small" onClick={() => setOpen(true)}>
        + Novo torneio
      </button>
    );
  }

  return (
    <div className="grid cols-2" style={{ marginTop: "0.6rem" }}>
      <div className="field" style={{ gridColumn: "1 / -1" }}>
        <label>Título</label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Torneio de setembro"
        />
      </div>
      <div className="field" style={{ gridColumn: "1 / -1" }}>
        <label>Prêmio</label>
        <input
          className="input"
          value={prizeDescription}
          onChange={(e) => setPrizeDescription(e.target.value)}
          placeholder="Ex.: Vale-combustível de R$ 300 pra equipe vencedora"
        />
      </div>
      <div className="field" style={{ gridColumn: "1 / -1" }}>
        <label>Critério de vitória</label>
        <div className="role-picker" style={{ marginBottom: 0 }}>
          <button className={metric === "AVG_ACHIEVEMENT" ? "active" : ""} onClick={() => setMetric("AVG_ACHIEVEMENT")}>
            🎯 Atingimento médio
          </button>
          <button className={metric === "TOTAL_COMMISSION" ? "active" : ""} onClick={() => setMetric("TOTAL_COMMISSION")}>
            💰 Comissão total
          </button>
        </div>
      </div>
      <div className="field">
        <label>Início</label>
        <input className="input" type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
      </div>
      <div className="field">
        <label>Fim</label>
        <input className="input" type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "end" }}>
        <button className="btn small" onClick={submit} disabled={saving || !title || !prizeDescription}>
          {saving ? "Salvando..." : "Criar torneio"}
        </button>
        <button className="btn secondary small" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export function OwnerTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);

  function load() {
    api.get<Tournament[]>("/tournaments").then(setTournaments);
  }
  useEffect(load, []);

  return (
    <div>
      <h1>Torneios entre postos</h1>
      <p className="subtitle">Crie uma competição entre todos os postos da rede num período, com um prêmio pra quem ficar em 1º.</p>

      <div className="card section">
        <NewTournamentForm onCreated={load} />
      </div>

      {tournaments?.map((t) => (
        <TournamentCard key={t.id} tournament={t} />
      ))}
      {tournaments && tournaments.length === 0 && <p>Nenhum torneio criado ainda.</p>}
    </div>
  );
}
