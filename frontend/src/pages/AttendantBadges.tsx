import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Badge } from "../types";
import { BadgeGrid } from "../components/BadgeGrid";

export function AttendantBadges() {
  const [badges, setBadges] = useState<Badge[] | null>(null);

  useEffect(() => {
    api.get<Badge[]>("/badges").then(setBadges);
  }, []);

  const achievedCount = badges?.filter((b) => b.achieved).length ?? 0;

  return (
    <div>
      <h1>🎖️ Conquistas</h1>
      <p className="subtitle">
        {badges ? `${achievedCount} de ${badges.length} medalhas conquistadas.` : "Suas medalhas por desempenho e consistência."}
      </p>

      {badges && <BadgeGrid badges={badges} />}
    </div>
  );
}
