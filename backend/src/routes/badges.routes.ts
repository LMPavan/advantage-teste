import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeAttendantBadges } from "../services/badges.service";
import { computeAttendantXp } from "../services/xp.service";

export const badgesRouter = Router();
badgesRouter.use(requireAuth);

// Conquistas do próprio frentista (histórico completo, não só o período atual).
badgesRouter.get("/", requireRole("ATTENDANT"), async (req, res) => {
  const { userId, stationId } = req.auth!;
  if (!stationId) return res.json([]);
  const badges = await computeAttendantBadges(userId, stationId);
  return res.json(badges);
});

// Nível/XP acumulado do próprio frentista (progressão de longo prazo, não zera todo mês).
badgesRouter.get("/xp", requireRole("ATTENDANT"), async (req, res) => {
  const { userId, stationId } = req.auth!;
  if (!stationId) return res.status(400).json({ error: "Sem posto vinculado." });
  const xp = await computeAttendantXp(userId, stationId);
  return res.json(xp);
});
