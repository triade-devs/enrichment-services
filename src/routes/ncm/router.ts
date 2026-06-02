import { Router } from "express";
import { NcmStore } from "./ncm-store";

export const ncmStore = new NcmStore();
export const ncmRouter = Router();

ncmRouter.get("/ncm/busca", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) {
    return res.status(422).json({ error: "INVALID_FORMAT", message: "q deve ter ao menos 2 caracteres" });
  }
  return res.json({ results: ncmStore.search(q) });
});

ncmRouter.get("/ncm/:codigo", (req, res) => {
  const result = ncmStore.getByCode(req.params.codigo);
  if (!result) {
    return res.status(404).json({ error: "NOT_FOUND", message: "NCM não encontrado" });
  }
  return res.json(result);
});
