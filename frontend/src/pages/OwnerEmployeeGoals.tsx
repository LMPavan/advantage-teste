import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Attendant, Station } from "../types";
import { EmployeeGoalManager } from "../components/EmployeeGoalManager";

function stationLabel(s: Station): string {
  const legal = s.razaoSocial ? ` — ${s.razaoSocial}` : "";
  const manager = s.manager ? ` (Gerente: ${s.manager.name})` : " (sem gerente)";
  return `${s.name}${legal}${manager}`;
}

export function OwnerEmployeeGoals() {
  const [stations, setStations] = useState<Station[]>([]);
  const [stationId, setStationId] = useState("");
  const [attendants, setAttendants] = useState<Attendant[]>([]);

  useEffect(() => {
    api.get<Station[]>("/stations").then(setStations);
  }, []);

  useEffect(() => {
    if (!stationId) {
      setAttendants([]);
      return;
    }
    api.get<Attendant[]>(`/users/team?stationId=${stationId}`).then(setAttendants);
  }, [stationId]);

  return (
    <div>
      <h1>Funcionários</h1>
      <p className="subtitle">
        Filtre por posto (gerente e razão social) e depois pelo funcionário, para ver o atingimento de
        cada meta e ajustar o valor-alvo quando necessário.
      </p>

      <div className="field" style={{ maxWidth: 460 }}>
        <label>Posto</label>
        <select className="input" value={stationId} onChange={(e) => setStationId(e.target.value)}>
          <option value="">Selecione um posto...</option>
          {stations.map((s) => (
            <option key={s.id} value={s.id}>
              {stationLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {stationId && attendants.length === 0 && <p>Nenhum frentista cadastrado neste posto ainda.</p>}
      {stationId && attendants.length > 0 && <EmployeeGoalManager attendants={attendants} canEdit={true} />}
    </div>
  );
}
