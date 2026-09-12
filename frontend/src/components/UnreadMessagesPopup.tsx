import { useState } from "react";
import { api } from "../api/client";
import { useMessages } from "../context/MessagesContext";
import { Avatar } from "./Avatar";

export function UnreadMessagesPopup() {
  const { unreadMessages, refresh } = useMessages();
  const [dismissed, setDismissed] = useState(false);
  const [closing, setClosing] = useState(false);

  async function dismiss() {
    setClosing(true);
    try {
      await api.post("/messages/read-all");
      await refresh();
    } finally {
      setDismissed(true);
      setClosing(false);
    }
  }

  if (dismissed || unreadMessages.length === 0) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2>
          ✉️ Você tem {unreadMessages.length} {unreadMessages.length > 1 ? "mensagens novas" : "mensagem nova"}
        </h2>
        <div className="modal-messages">
          {unreadMessages.map((m) => (
            <div className="modal-message" key={m.id}>
              <Avatar name={m.sender.name} photoUrl={m.sender.photoUrl} size={36} />
              <div>
                <div style={{ fontWeight: 600 }}>
                  {m.sender.name} <span className="badge neutral">{m.audienceLabel}</span>
                </div>
                <p style={{ margin: "0.2rem 0" }}>{m.body}</p>
                <div className="meta">{new Date(m.createdAt).toLocaleString("pt-BR")}</div>
              </div>
            </div>
          ))}
        </div>
        <button className="btn" onClick={dismiss} disabled={closing} style={{ width: "100%" }}>
          {closing ? "Aguarde..." : "Marcar como lidas e continuar"}
        </button>
      </div>
    </div>
  );
}
