import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";
import type { Message } from "../types";

interface MessagesContextValue {
  unreadCount: number;
  unreadMessages: Message[];
  refresh: () => Promise<void>;
}

const MessagesContext = createContext<MessagesContextValue | undefined>(undefined);

export function MessagesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState<Message[]>([]);

  const refresh = useCallback(async () => {
    if (!user) {
      setUnreadMessages([]);
      return;
    }
    try {
      const messages = await api.get<Message[]>("/messages");
      setUnreadMessages(messages.filter((m) => !m.readAt));
    } catch {
      // silencioso: contador de não lidas não é crítico
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <MessagesContext.Provider value={{ unreadCount: unreadMessages.length, unreadMessages, refresh }}>
      {children}
    </MessagesContext.Provider>
  );
}

export function useMessages() {
  const ctx = useContext(MessagesContext);
  if (!ctx) throw new Error("useMessages deve ser usado dentro de MessagesProvider");
  return ctx;
}
