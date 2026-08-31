import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Attendant, Station } from "../types";
import { EmployeeGoalManager } from "../components/EmployeeGoalManager";

export function ManagerEmployeeGoals() {
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [station, setStation] = useState<Station | null>(null);

  useEffect(() => {
    api.get<Attendant[]>("/users/team").then(setAttendants);
    api.get<Station[]>("/stations").then((stations) => setStation(stations[0] ?? null));
  }, []);

  return (
    <div>
      <h1>Gestão por funcionário</h1>
      <p className="subtitle">
        Escolha um funcionário para ver como está o atingimento de cada meta dele e, se liberado pelo dono
        da rede, ajustar o valor-alvo.
      </p>

      {attendants.length === 0 && <p>Nenhum frentista cadastrado ainda.</p>}
      {attendants.length > 0 && (
        <EmployeeGoalManager attendants={attendants} canEdit={station?.managerCanManageGoals !== false} />
      )}
    </div>
  );
}
