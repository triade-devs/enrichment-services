import "dotenv/config";
import express from "express";
import { jwtVerify, createRemoteJWKSet } from "jose";
import cron from "node-cron";

import { ncmRouter, ncmStore } from "./routes/ncm/router";
import { empresaRouter }       from "./routes/empresa/router";
import { cepRouter }           from "./routes/cep/router";
import { barcodeRouter }       from "./routes/barcode/router";

const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) {
  console.error("SUPABASE_URL is required");
  process.exit(1);
}

// Chaves de assinatura do Supabase (ES256, assimétricas). Buscadas e cacheadas a partir do JWKS.
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

const app = express();
app.use(express.json());

// Health — sem auth (keep-alive)
app.get("/health", (_req, res) =>
  res.json({
    status: ncmStore.count() > 0 ? "ok" : "loading",
    ncmRecords: ncmStore.count(),
    lastNcmSync: ncmStore.getLastSync(),
  }),
);

// Auth middleware — todas as rotas abaixo exigem JWT válido
app.use(async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Token ausente" });
  }
  try {
    await jwtVerify(auth.slice(7), JWKS, { algorithms: ["ES256"] });
    next();
  } catch {
    return res.status(401).json({ error: "UNAUTHORIZED", message: "Token inválido ou expirado" });
  }
});

app.use(ncmRouter);
app.use(empresaRouter);
app.use(cepRouter);
app.use(barcodeRouter);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, async () => {
  console.log(`enrichment-services running on :${PORT}`);
  try {
    await ncmStore.syncFromSiscomex();
  } catch (e) {
    console.error("Falha na sincronização inicial do NCM:", e);
  }
});

// Sincroniza NCM diariamente à meia-noite
cron.schedule("0 0 * * *", async () => {
  try {
    await ncmStore.syncFromSiscomex();
  } catch (e) {
    console.error("Falha na sincronização diária do NCM:", e);
  }
});
