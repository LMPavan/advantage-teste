import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useMessages } from "../context/MessagesContext";
import { Avatar } from "./Avatar";
import { FuelPumpLogo } from "./FuelPumpLogo";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Dono da rede",
  MANAGER: "Gerente",
  ATTENDANT: "Frentista",
};

const NAV_BY_ROLE: Record<string, { to: string; label: string; end?: boolean; badge?: boolean }[]> = {
  OWNER: [
    { to: "/owner", label: "Dashboard", end: true },
    { to: "/owner/messages", label: "✉️ Mensagens", badge: true },
    { to: "/owner/ranking", label: "Ranking executivo" },
    { to: "/owner/items-overview", label: "Atingimento por item" },
    { to: "/owner/employees", label: "Funcionários" },
    { to: "/owner/stations", label: "Postos" },
    { to: "/owner/items", label: "Itens e comissionamento" },
    { to: "/owner/redemptions", label: "Resgates" },
    { to: "/owner/hall-of-fame", label: "🏆 Mural" },
  ],
  MANAGER: [
    { to: "/manager", label: "Dashboard", end: true },
    { to: "/manager/messages", label: "✉️ Mensagens", badge: true },
    { to: "/manager/my-goals", label: "Minhas metas" },
    { to: "/manager/team", label: "Equipe e metas" },
    { to: "/manager/employees", label: "Gestão por funcionário" },
    { to: "/manager/redemptions", label: "Resgates" },
    { to: "/manager/ranking", label: "🏆 Ranking da rede" },
    { to: "/manager/hall-of-fame", label: "🏆 Mural" },
  ],
  ATTENDANT: [
    { to: "/attendant", label: "Minhas metas", end: true },
    { to: "/attendant/messages", label: "✉️ Mensagens", badge: true },
    { to: "/attendant/redemptions", label: "Resgates" },
    { to: "/attendant/ranking", label: "🏆 Ranking do posto" },
    { to: "/attendant/badges", label: "🎖️ Conquistas" },
    { to: "/attendant/hall-of-fame", label: "🏆 Mural" },
  ],
};

export function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { unreadCount } = useMessages();

  if (!user) return null;
  const items = NAV_BY_ROLE[user.role] ?? [];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <FuelPumpLogo size={30} />
          <span>Metas Posto</span>
        </div>
        <nav>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end ?? false}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {item.label}
              {item.badge && unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="user-box">
          <div className="user-box-inner">
            <Avatar name={user.name} photoUrl={user.photoUrl} size={32} />
            <div className="user-box-text">
              <div className="u-name">{user.name}</div>
              <div>{ROLE_LABEL[user.role]}</div>
            </div>
          </div>
          <button className="btn secondary small" onClick={logout}>
            Sair
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
