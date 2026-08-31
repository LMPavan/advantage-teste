import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Attendant, Challenge, ChallengeType, Item } from "../types";
import { ChallengeCard } from "./ChallengeCard";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function inDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function NewChallengeForm({
  stationId,
  attendants,
  items,
  onCreated,
}: {
  stationId: string;
  attendants: Attendant[];
  items: Item[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ChallengeType>("SOLO");
  const [title, setTitle] = useState("");
  const [itemId, setItemId] = useState("");
  const [attendantId, setAttendantId] = useState("");
  const [opponentId, setOpponentId] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [bonusAmount, setBonusAmount] = useState("");
  const [startAt, setStartAt] = useState(todayIso());
  const [endAt, setEndAt] = useState(inDaysIso(1));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.post("/challenges", {
        stationId,
        itemId,
        type,
        title,
        attendantId,
        opponentId: type === "DUEL" ? opponentId : undefined,
        targetValue: type === "SOLO" ? Number(targetValue) : undefined,
        bonusAmount: Number(bonusAmount),
        startAt,
        endAt,
      });
      setTitle("");
      setTargetValue("");
      setBonusAmount("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao criar desafio.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className="btn small" onClick={() => setOpen(true)}>
        + Novo desafio
      </button>
    );
  }

  return (
    <div className="grid cols-2" style={{ marginTop: "0.6rem" }}>
      <div className="field" style={{ gridColumn: "1 / -1" }}>
        <label>Tipo</label>
        <div className="role-picker" style={{ marginBottom: 0 }}>
          <button className={type === "SOLO" ? "active" : ""} onClick={() => setType("SOLO")}>
            ⚡ Desafio relâmpago
          </button>
          <button className={type === "DUEL" ? "active" : ""} onClick={() => setType("DUEL")}>
            ⚔️ Duelo
          </button>
        </div>
      </div>
      <div className="field" style={{ gridColumn: "1 / -1" }}>
        <label>Título</label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={type === "SOLO" ? "Ex.: 50L de aditivada até hoje às 18h" : "Ex.: Fábio vs Ana — semana do mix"}
        />
      </div>
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
        <label>{type === "DUEL" ? "Desafiante" : "Frentista"}</label>
        <select className="input" value={attendantId} onChange={(e) => setAttendantId(e.target.value)}>
          <option value="">Selecione...</option>
          {attendants.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      {type === "DUEL" ? (
        <div className="field">
          <label>Adversário</label>
          <select className="input" value={opponentId} onChange={(e) => setOpponentId(e.target.value)}>
            <option value="">Selecione...</option>
            {attendants
              .filter((a) => a.id !== attendantId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </div>
      ) : (
        <div className="field">
          <label>Valor-alvo</label>
          <input className="input" type="number" step="0.01" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
        </div>
      )}
      <div className="field">
        <label>Bônus (R$)</label>
        <input className="input" type="number" step="0.01" value={bonusAmount} onChange={(e) => setBonusAmount(e.target.value)} />
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
        <button
          className="btn small"
          onClick={submit}
          disabled={saving || !title || !itemId || !attendantId || !bonusAmount || (type === "SOLO" ? !targetValue : !opponentId)}
        >
          {saving ? "Salvando..." : "Criar desafio"}
        </button>
        <button className="btn secondary small" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export function ChallengeManager({ stationId, attendants, items }: { stationId: string; attendants: Attendant[]; items: Item[] }) {
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);

  function load() {
    api.get<Challenge[]>(`/challenges?stationId=${stationId}`).then(setChallenges);
  }
  useEffect(load, [stationId]);

  return (
    <div>
      <div className="card section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ marginBottom: 0 }}>Desafios e duelos</h2>
        </div>
        <NewChallengeForm stationId={stationId} attendants={attendants} items={items} onCreated={load} />
      </div>

      <div className="grid cols-2">
        {challenges?.map((c) => (
          <ChallengeCard key={c.id} challenge={c} />
        ))}
        {challenges && challenges.length === 0 && <p>Nenhum desafio cadastrado ainda.</p>}
      </div>
    </div>
  );
}
