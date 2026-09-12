import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { ExecutiveDashboard, Item } from "../types";
import { AchievementBadge, ProgressBar } from "../components/ProgressBar";
import { itemIcon } from "../utils/itemIcon";

export function OwnerItemsOverview() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [data, setData] = useState<ExecutiveDashboard | null>(null);

  useEffect(() => {
    api.get<Item[]>("/items").then((list) => {
      setItems(list);
      if (list.length > 0) setSelectedItemId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedItemId) return;
    setData(null);
    api.get<ExecutiveDashboard>(`/dashboard/executive?itemId=${selectedItemId}`).then(setData);
  }, [selectedItemId]);

  const selectedItem = items.find((i) => i.id === selectedItemId);

  return (
    <div>
      <h1>Atingimento por item</h1>
      <p className="subtitle">
        Realizado versus alvo de cada posto, item a item. Clique num posto para ver a equipe, o top 3 e o
        bottom 3 daquele item.
      </p>

      <div className="role-picker section" style={{ flexWrap: "wrap" }}>
        {items.map((item) => (
          <button key={item.id} className={selectedItemId === item.id ? "active" : ""} onClick={() => setSelectedItemId(item.id)}>
            {itemIcon(item)} {item.name}
          </button>
        ))}
      </div>

      {!data && <p>Carregando...</p>}

      <div className="grid cols-2">
        {data?.stationRankings.map((s) => (
          <div
            key={s.stationId}
            className="card"
            style={{ cursor: "pointer" }}
            onClick={() => navigate(`/owner/stations/${s.stationId}?itemId=${selectedItemId}`)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div>
                <h2 style={{ marginBottom: "0.1rem" }}>{s.stationName}</h2>
                {s.stationRazaoSocial && (
                  <p className="subtitle" style={{ margin: 0 }}>
                    {s.stationRazaoSocial}
                  </p>
                )}
                <p className="subtitle" style={{ margin: "0.2rem 0 0" }}>
                  Gerente: {s.managerName ?? "—"}
                </p>
              </div>
              <AchievementBadge percent={s.avgAchievement} />
            </div>
            <p style={{ margin: "0.6rem 0" }}>
              Realizado: <strong>{s.actualTotal ?? 0}</strong> {s.unit ?? selectedItem?.unit} · Alvo:{" "}
              <strong>{s.targetTotal ?? 0}</strong> {s.unit ?? selectedItem?.unit}
            </p>
            <ProgressBar percent={s.avgAchievement} />
            <p className="subtitle" style={{ marginTop: "0.5rem", marginBottom: 0 }}>
              {s.attendantsCount} frentista(s) · R$ {s.totalCommission.toFixed(2)} em comissão · ver detalhes →
            </p>
          </div>
        ))}
        {data && data.stationRankings.length === 0 && <p>Nenhum posto com meta deste item no período atual.</p>}
      </div>
    </div>
  );
}
