import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "./Avatar";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Dono da rede",
  MANAGER: "Gerente",
  ATTENDANT: "Frentista",
};

const NAV_BY_ROLE: Record<string, { to: string; label: string; end?: boolean }[]> = {
  OWNER: [
    { to: "/owner", label: "Dashboard", end: true },
    { to: "/owner/ranking", label: "Ranking executivo" },
    { to: "/owner/stations", label: "Postos" },
    { to: "/owner/items", label: "Itens e comissionamento" },
    { to: "/owner/redemptions", label: "Resgates" },
    { to: "/owner/hall-of-fame", label: "🏆 Mural" },
  ],
  MANAGER: [
    { to: "/manager", label: "Dashboard", end: true },
    { to: "/manager/team", label: "Equipe e metas" },
    { to: "/manager/redemptions", label: "Resgates" },
    { to: "/manager/ranking", label: "🏆 Ranking da rede" },
    { to: "/manager/hall-of-fame", label: "🏆 Mural" },
  ],
  ATTENDANT: [
    { to: "/attendant", label: "Minhas metas", end: true },
    { to: "/attendant/redemptions", label: "Resgates" },
    { to: "/attendant/ranking", label: "🏆 Ranking do posto" },
    { to: "/attendant/badges", label: "🎖️ Conquistas" },
    { to: "/attendant/hall-of-fame", label: "🏆 Mural" },
  ],
};

export function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  if (!user) return null;
  const items = NAV_BY_ROLE[user.role] ?? [];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">⛽ Metas Posto</div>
        <nav>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end ?? false}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="user-box">
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.4rem" }}>
            <Avatar name={user.name} photoUrl={user.photoUrl} size={32} />
            <div>
              <div style={{ color: "var(--text)" }}>{user.name}</div>
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
