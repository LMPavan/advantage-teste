import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Dono da rede",
  MANAGER: "Gerente",
  ATTENDANT: "Frentista",
};

const NAV_BY_ROLE: Record<string, { to: string; label: string }[]> = {
  OWNER: [
    { to: "/owner", label: "Visão executiva" },
    { to: "/owner/stations", label: "Postos" },
    { to: "/owner/items", label: "Itens e comissionamento" },
  ],
  MANAGER: [
    { to: "/manager", label: "Equipe e metas" },
    { to: "/manager/redemptions", label: "Resgates" },
  ],
  ATTENDANT: [
    { to: "/attendant", label: "Minhas metas" },
    { to: "/attendant/redemptions", label: "Resgates" },
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
            <NavLink key={item.to} to={item.to} end className={({ isActive }) => (isActive ? "active" : "")}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="user-box">
          <div>{user.name}</div>
          <div>{ROLE_LABEL[user.role]}</div>
          <button className="btn secondary small" style={{ marginTop: "0.6rem" }} onClick={logout}>
            Sair
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
