import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import type { AttendantRankingRow, Item, ItemAttendantRankingRow } from "../types";
import { TeamLeaderboard } from "../components/TeamLeaderboard";

export function AttendantRanking() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [combinedRows, setCombinedRows] = useState<AttendantRankingRow[] | null>(null);
  const [itemRows, setItemRows] = useState<ItemAttendantRankingRow[] | null>(null);

  useEffect(() => {
    api.get<Item[]>("/items").then(setItems);
  }, []);

  useEffect(() => {
    if (selectedItemId) {
      setItemRows(null);
      api.get<ItemAttendantRankingRow[]>(`/dashboard/station-ranking?itemId=${selectedItemId}`).then(setItemRows);
    } else {
      setCombinedRows(null);
      api.get<AttendantRankingRow[]>("/dashboard/station-ranking").then(setCombinedRows);
    }
  }, [selectedItemId]);

  const rows = selectedItemId ? itemRows : combinedRows;

  return (
    <div>
      <h1>Ranking do posto</h1>
      <p className="subtitle">
        Veja como você está em relação aos demais frentistas do seu posto. O 1º lugar ganha moldura dourada, o
        2º prata e o 3º bronze.
      </p>

      <div className="role-picker" style={{ flexWrap: "wrap" }}>
        <button className={selectedItemId === null ? "active" : ""} onClick={() => setSelectedItemId(null)}>
          Todos os itens
        </button>
        {items.map((item) => (
          <button key={item.id} className={selectedItemId === item.id ? "active" : ""} onClick={() => setSelectedItemId(item.id)}>
            {item.name}
          </button>
        ))}
      </div>

      {selectedItemId && (
        <p className="subtitle" style={{ marginTop: 0 }}>
          Mostrando apenas frentistas com meta deste item no período atual.
        </p>
      )}

      {rows ? (
        <TeamLeaderboard rows={rows} ownId={user?.id} />
      ) : (
        <p>Carregando...</p>
      )}
    </div>
  );
}
