import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/Login";
import { Shell } from "./components/Shell";
import { AttendantGoals } from "./pages/AttendantGoals";
import { AttendantRedemptions } from "./pages/AttendantRedemptions";
import { ManagerTeam } from "./pages/ManagerTeam";
import { ManagerRedemptions } from "./pages/ManagerRedemptions";
import { OwnerExecutive } from "./pages/OwnerExecutive";
import { OwnerStations } from "./pages/OwnerStations";
import { OwnerItems } from "./pages/OwnerItems";
import type { Role } from "./types";

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const target: Record<Role, string> = { OWNER: "/owner", MANAGER: "/manager", ATTENDANT: "/attendant" };
  return <Navigate to={target[user.role]} replace />;
}

function Protected({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-page">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  const { loading, user } = useAuth();
  if (loading) return <div className="auth-page">Carregando...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<HomeRedirect />} />

      <Route
        path="/attendant"
        element={
          <Protected roles={["ATTENDANT"]}>
            <AttendantGoals />
          </Protected>
        }
      />
      <Route
        path="/attendant/redemptions"
        element={
          <Protected roles={["ATTENDANT"]}>
            <AttendantRedemptions />
          </Protected>
        }
      />

      <Route
        path="/manager"
        element={
          <Protected roles={["MANAGER"]}>
            <ManagerTeam />
          </Protected>
        }
      />
      <Route
        path="/manager/redemptions"
        element={
          <Protected roles={["MANAGER"]}>
            <ManagerRedemptions />
          </Protected>
        }
      />

      <Route
        path="/owner"
        element={
          <Protected roles={["OWNER"]}>
            <OwnerExecutive />
          </Protected>
        }
      />
      <Route
        path="/owner/stations"
        element={
          <Protected roles={["OWNER"]}>
            <OwnerStations />
          </Protected>
        }
      />
      <Route
        path="/owner/items"
        element={
          <Protected roles={["OWNER"]}>
            <OwnerItems />
          </Protected>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
