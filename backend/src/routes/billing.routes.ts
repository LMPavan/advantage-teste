import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { round2 } from "../services/commission.service";

export const billingRouter = Router();
billingRouter.use(requireAuth);

// Mensalidade da rede na plataforma: base + faixa por posto extra além dos incluídos no plano.
// Definida pela plataforma (não editável pelo dono) — aqui só é calculada a partir da contagem atual
// de postos da rede. Sem integração de cobrança real (nenhum gateway de pagamento configurado neste
// ambiente); serve para o dono acompanhar quanto a assinatura custa hoje.
billingRouter.get("/", requireRole("OWNER"), async (req, res) => {
  const networkId = req.auth!.networkId!;

  const [subscription, stationsCount] = await Promise.all([
    prisma.subscription.findUnique({ where: { networkId } }),
    prisma.station.count({ where: { networkId } }),
  ]);

  if (!subscription) {
    return res.status(404).json({ error: "Nenhum plano de assinatura configurado para esta rede." });
  }

  const includedStations = subscription.includedStations;
  const pricePerExtraStation = Number(subscription.pricePerExtraStation);
  const baseFee = Number(subscription.baseFee);

  const extraStations = Math.max(0, stationsCount - includedStations);
  const extraCost = round2(extraStations * pricePerExtraStation);
  const totalMonthly = round2(baseFee + extraCost);

  return res.json({
    planName: subscription.planName,
    stationsCount,
    includedStations,
    baseFee,
    extraStations,
    pricePerExtraStation,
    extraCost,
    totalMonthly,
  });
});
