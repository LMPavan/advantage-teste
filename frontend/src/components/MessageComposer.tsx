import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { MessageRecipientsResponse, MessageTargetType } from "../types";

const OWNER_TARGET_LABEL: Record<MessageTargetType, string> = {
  USER: "Pessoa específica",
  STATION_TEAM: "Equipe de um posto",
  NETWORK_MANAGERS: "Todos os gerentes",
  NETWORK_ATTENDANTS: "Todos os frentistas",
  NETWORK_ALL: "Toda a rede",
};

const MANAGER_TARGET_LABEL: Record<Extract<MessageTargetType, "USER" | "STATION_TEAM">, string> = {
  USER: "Um frentista",
  STATION_TEAM: "Toda a minha equipe",
};

export function MessageComposer({ onSent }: { onSent: () => void }) {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const [options, setOptions] = useState<MessageRecipientsResponse | null>(null);
  const [targetType, setTargetType] = useState<MessageTargetType>("USER");
  const [targetId, setTargetId] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && !options) {
      api.get<MessageRecipientsResponse>("/messages/recipients").then(setOptions);
    }
  }, [open, options]);

  async function submit() {
    setSaving(true);
    setError(null);
    setSent(false);
    try {
      await api.post("/messages", {
        targetType,
        targetId: targetType === "USER" || targetType === "STATION_TEAM" ? targetId || undefined : undefined,
        body,
      });
      setBody("");
      setTargetId("");
      setSent(true);
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao enviar mensagem.");
    } finally {
      setSaving(false);
    }
  }

  const targetLabels = isOwner ? OWNER_TARGET_LABEL : MANAGER_TARGET_LABEL;
  const needsUser = targetType === "USER";
  const needsStation = targetType === "STATION_TEAM" && isOwner;

  if (!open) {
    return (
      <button className="btn small" onClick={() => setOpen(true)}>
        ✉️ Nova mensagem
      </button>
    );
  }

  return (
    <div className="card section">
      <h2>Nova mensagem</h2>
      <div className="grid cols-2">
        <div className="field">
          <label>Enviar para</label>
          <select
            className="input"
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value as MessageTargetType);
              setTargetId("");
            }}
          >
            {Object.entries(targetLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {needsUser && (
          <div className="field">
            <label>{isOwner ? "Gerente ou frentista" : "Frentista"}</label>
            <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Selecione...</option>
              {options?.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {isOwner ? `(${u.role === "MANAGER" ? "Gerente" : "Frentista"})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
        {needsStation && (
          <div className="field">
            <label>Posto</label>
            <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">Selecione...</option>
              {options?.stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="field">
        <label>Mensagem</label>
        <textarea
          className="input"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          placeholder="Escreva sua mensagem..."
        />
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          className="btn small"
          onClick={submit}
          disabled={saving || !body.trim() || ((needsUser || needsStation) && !targetId)}
        >
          {saving ? "Enviando..." : "Enviar"}
        </button>
        <button className="btn secondary small" onClick={() => setOpen(false)}>
          Fechar
        </button>
      </div>
      {sent && <p style={{ color: "var(--success)", fontSize: "0.85rem" }}>Mensagem enviada!</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
