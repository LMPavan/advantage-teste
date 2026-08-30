import "dotenv/config";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.routes";
import { stationRouter } from "./routes/station.routes";
import { userRouter } from "./routes/user.routes";
import { itemRouter } from "./routes/item.routes";
import { goalRouter } from "./routes/goal.routes";
import { entryRouter } from "./routes/entry.routes";
import { redemptionRouter } from "./routes/redemption.routes";
import { dashboardRouter } from "./routes/dashboard.routes";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRouter);
app.use("/stations", stationRouter);
app.use("/users", userRouter);
app.use("/items", itemRouter);
app.use("/goals", goalRouter);
app.use("/entries", entryRouter);
app.use("/redemptions", redemptionRouter);
app.use("/dashboard", dashboardRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor." });
});

const port = Number(process.env.PORT) || 3333;
app.listen(port, () => {
  console.log(`Fuel Goals API rodando em http://localhost:${port}`);
});
