import express from "express";
import jwt from "jsonwebtoken";
import cron from "node-cron";
import { NcmStore } from "./ncm-store";
import { buildRouter } from "./router";

const store = new NcmStore();
const app = express();
app.use(express.json());

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
if (!JWT_SECRET) {
  console.error("SUPABASE_JWT_SECRET is required");
  process.exit(1);
}

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Token ausente" });
  }
  try {
    jwt.verify(auth.slice(7), JWT_SECRET!);
    next();
  } catch {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Token inválido ou expirado" });
  }
});

app.get("/health", (_req, res) =>
  res.json({
    status: store.count() > 0 ? "ok" : "loading",
    records: store.count(),
    lastSync: store.getLastSync(),
  }),
);

app.use(buildRouter(store));

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, async () => {
  console.log(`ms-ncm running on :${PORT}`);
  try {
    await store.syncFromSiscomex();
  } catch (e) {
    console.error("Falha na sincronização inicial:", e);
  }
});

cron.schedule("0 0 * * *", async () => {
  try {
    await store.syncFromSiscomex();
  } catch (e) {
    console.error("Falha na sincronização diária:", e);
  }
});
