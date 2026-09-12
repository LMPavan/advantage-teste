import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Attendant, Item, Station } from "../types";
import { ChallengeManager } from "../components/ChallengeManager";

export function ManagerChallenges() {
  const [attendants, setAttendants] = useState<Attendant[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [station, setStation] = useState<Station | null>(null);

  useEffect(() => {
    api.get<Attendant[]>("/users/team").then(setAttendants);
    api.get<Item[]>("/items").then(setItems);
    api.get<Station[]>("/stations").then((s) => setStation(s[0] ?? null));
  }, []);

  return (
    <div>
      <h1>Desafios e duelos</h1>
      <p className="subtitle">
        Crie missões curtas com bônus (desafios relâmpago) ou dispute dois frentistas entre si (duelos) —
        fora da meta mensal, pra dar um pico de engajamento no dia a dia.
      </p>
      {attendants.length === 0 && <p>Nenhum frentista cadastrado ainda.</p>}
      {station && attendants.length > 0 && <ChallengeManager stationId={station.id} attendants={attendants} items={items} />}
    </div>
  );
}
