import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/Login";
import { Shell } from "./components/Shell";
import { AttendantGoals } from "./pages/AttendantGoals";
import { AttendantGoalDetail } from "./pages/AttendantGoalDetail";
import { AttendantRedemptions } from "./pages/AttendantRedemptions";
import { AttendantRanking } from "./pages/AttendantRanking";
import { AttendantBadges } from "./pages/AttendantBadges";
import { ManagerDashboard } from "./pages/ManagerDashboard";
import { ManagerTeam } from "./pages/ManagerTeam";
import { ManagerRedemptions } from "./pages/ManagerRedemptions";
import { ManagerRanking } from "./pages/ManagerRanking";
import { ManagerMyGoals } from "./pages/ManagerMyGoals";
import { ManagerEmployeeGoals } from "./pages/ManagerEmployeeGoals";
import { OwnerDashboard } from "./pages/OwnerDashboard";
import { OwnerExecutive } from "./pages/OwnerExecutive";
import { OwnerStations } from "./pages/OwnerStations";
import { OwnerItems } from "./pages/OwnerItems";
import { OwnerRedemptions } from "./pages/OwnerRedemptions";
import { OwnerEmployeeGoals } from "./pages/OwnerEmployeeGoals";
import { OwnerItemsOverview } from "./pages/OwnerItemsOverview";
import { OwnerStationDetail } from "./pages/OwnerStationDetail";
import { HallOfFame } from "./pages/HallOfFame";
import { MessagesPage } from "./pages/Messages";
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
        path="/attendant/goals/:goalId"
        element={
          <Protected roles={["ATTENDANT"]}>
            <AttendantGoalDetail />
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
        path="/attendant/ranking"
        element={
          <Protected roles={["ATTENDANT"]}>
            <AttendantRanking />
          </Protected>
        }
      />
      <Route
        path="/attendant/badges"
        element={
          <Protected roles={["ATTENDANT"]}>
            <AttendantBadges />
          </Protected>
        }
      />
      <Route
        path="/attendant/hall-of-fame"
        element={
          <Protected roles={["ATTENDANT"]}>
            <HallOfFame />
          </Protected>
        }
      />
      <Route
        path="/attendant/messages"
        element={
          <Protected roles={["ATTENDANT"]}>
            <MessagesPage />
          </Protected>
        }
      />

      <Route
        path="/manager"
        element={
          <Protected roles={["MANAGER"]}>
            <ManagerDashboard />
          </Protected>
        }
      />
      <Route
        path="/manager/team"
        element={
          <Protected roles={["MANAGER"]}>
            <ManagerTeam />
          </Protected>
        }
      />
      <Route
        path="/manager/my-goals"
        element={
          <Protected roles={["MANAGER"]}>
            <ManagerMyGoals />
          </Protected>
        }
      />
      <Route
        path="/manager/my-goals/:goalId"
        element={
          <Protected roles={["MANAGER"]}>
            <AttendantGoalDetail />
          </Protected>
        }
      />
      <Route
        path="/manager/employees"
        element={
          <Protected roles={["MANAGER"]}>
            <ManagerEmployeeGoals />
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
        path="/manager/ranking"
        element={
          <Protected roles={["MANAGER"]}>
            <ManagerRanking />
          </Protected>
        }
      />
      <Route
        path="/manager/hall-of-fame"
        element={
          <Protected roles={["MANAGER"]}>
            <HallOfFame />
          </Protected>
        }
      />
      <Route
        path="/manager/messages"
        element={
          <Protected roles={["MANAGER"]}>
            <MessagesPage />
          </Protected>
        }
      />

      <Route
        path="/owner"
        element={
          <Protected roles={["OWNER"]}>
            <OwnerDashboard />
          </Protected>
        }
      />
      <Route
        path="/owner/ranking"
        element={
          <Protected roles={["OWNER"]}>
            <OwnerExecutive />
          </Protected>
        }
      />
      <Route
        path="/owner/items-overview"
        element={
          <Protected roles={["OWNER"]}>
            <OwnerItemsOverview />
          </Protected>
        }
      />
      <Route
        path="/owner/stations/:stationId"
        element={
          <Protected roles={["OWNER"]}>
            <OwnerStationDetail />
          </Protected>
        }
      />
      <Route
        path="/owner/employees"
        element={
          <Protected roles={["OWNER"]}>
            <OwnerEmployeeGoals />
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
      <Route
        path="/owner/redemptions"
        element={
          <Protected roles={["OWNER"]}>
            <OwnerRedemptions />
          </Protected>
        }
      />
      <Route
        path="/owner/hall-of-fame"
        element={
          <Protected roles={["OWNER"]}>
            <HallOfFame />
          </Protected>
        }
      />
      <Route
        path="/owner/messages"
        element={
          <Protected roles={["OWNER"]}>
            <MessagesPage />
          </Protected>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
