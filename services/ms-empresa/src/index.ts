import express from "express";
import jwt from "jsonwebtoken";
import { router } from "./router";

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

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use(router);

const PORT = process.env.PORT ?? 3002;
app.listen(PORT, () => console.log(`ms-empresa running on :${PORT}`));
