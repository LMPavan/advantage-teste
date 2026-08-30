import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeAttendantBadges } from "../services/badges.service";

export const badgesRouter = Router();
badgesRouter.use(requireAuth);

// Conquistas do próprio frentista (histórico completo, não só o período atual).
badgesRouter.get("/", requireRole("ATTENDANT"), async (req, res) => {
  const { userId, stationId } = req.auth!;
  if (!stationId) return res.json([]);
  const badges = await computeAttendantBadges(userId, stationId);
  return res.json(badges);
});
