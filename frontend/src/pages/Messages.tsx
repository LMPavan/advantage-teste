import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useMessages } from "../context/MessagesContext";
import type { Message } from "../types";
import { Avatar } from "../components/Avatar";
import { MessageComposer } from "../components/MessageComposer";

export function MessagesPage() {
  const { user } = useAuth();
  const { refresh } = useMessages();
  const canCompose = user?.role === "OWNER" || user?.role === "MANAGER";
  const [messages, setMessages] = useState<Message[] | null>(null);

  function load() {
    api.get<Message[]>("/messages").then(async (data) => {
      setMessages(data);
      if (data.some((m) => !m.readAt)) {
        await api.post("/messages/read-all");
        refresh();
      }
    });
  }

  useEffect(load, []);

  return (
    <div>
      <h1>✉️ Mensagens</h1>
      <p className="subtitle">
        {canCompose ? "Envie avisos para sua equipe e veja o histórico recebido." : "Avisos enviados pelo gerente e pelo dono da rede."}
      </p>

      {canCompose && <MessageComposer onSent={load} />}

      <div className="card">
        {messages?.map((m) => (
          <div className="message-row" key={m.id}>
            <Avatar name={m.sender.name} photoUrl={m.sender.photoUrl} size={40} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.4rem" }}>
                <div>
                  <strong>{m.sender.name}</strong> <span className="badge neutral">{m.audienceLabel}</span>
                </div>
                <span className="meta">{new Date(m.createdAt).toLocaleString("pt-BR")}</span>
              </div>
              <p style={{ margin: "0.3rem 0 0" }}>{m.body}</p>
            </div>
          </div>
        ))}
        {messages && messages.length === 0 && <p>Nenhuma mensagem recebida ainda.</p>}
      </div>
    </div>
  );
}
