import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Redemption } from "../types";
import { RedemptionsTable } from "../components/RedemptionsTable";

export function ManagerRedemptions() {
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  function load() {
    api.get<Redemption[]>("/redemptions").then(setRedemptions);
  }
  useEffect(load, []);

  return (
    <div>
      <h1>Resgates da equipe</h1>
      <p className="subtitle">Aprove, rejeite ou marque como pago os resgates solicitados pelos frentistas.</p>
      <div className="card">
        <RedemptionsTable redemptions={redemptions} onChanged={load} />
      </div>
    </div>
  );
}
