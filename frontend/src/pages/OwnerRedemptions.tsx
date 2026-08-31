import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Redemption } from "../types";
import { RedemptionsTable } from "../components/RedemptionsTable";

export function OwnerRedemptions() {
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  function load() {
    api.get<Redemption[]>("/redemptions").then(setRedemptions);
  }
  useEffect(load, []);

  return (
    <div>
      <h1>Resgates da rede</h1>
      <p className="subtitle">Aprove, rejeite ou marque como pago os resgates solicitados em qualquer posto da rede.</p>
      <div className="card">
        <RedemptionsTable redemptions={redemptions} showStation onChanged={load} />
      </div>
    </div>
  );
}
