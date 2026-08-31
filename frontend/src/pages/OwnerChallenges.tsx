import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Attendant, Item, Station } from "../types";
import { ChallengeManager } from "../components/ChallengeManager";

function stationLabel(s: Station): string {
  const legal = s.razaoSocial ? ` — ${s.razaoSocial}` : "";
  const manager = s.manager ? ` (Gerente: ${s.manager.name})` : " (sem gerente)";
  return `${s.name}${legal}${manager}`;
}

export function OwnerChallenges() {
  const [stations, setStations] = useState<Station[]>([]);
  const [stationId, setStationId] = useState("");
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    api.get<Station[]>("/stations").then(setStations);
    api.get<Item[]>("/items").then(setItems);
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
      <h1>Desafios e duelos</h1>
      <p className="subtitle">Escolha um posto pra criar desafios relâmpago ou duelos entre os frentistas dele.</p>

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
      {stationId && attendants.length > 0 && <ChallengeManager stationId={stationId} attendants={attendants} items={items} />}
    </div>
  );
}
