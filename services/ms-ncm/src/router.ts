import { Router } from "express";
import type { NcmStore } from "./ncm-store";

export function buildRouter(store: NcmStore) {
  const router = Router();

  router.get("/ncm/busca", (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) {
      return res.status(422).json({
        error: "INVALID_FORMAT",
        message: "q deve ter ao menos 2 caracteres",
      });
    }
    return res.json({ results: store.search(q) });
  });

  router.get("/ncm/:codigo", (req, res) => {
    const result = store.getByCode(req.params.codigo);
    if (!result) {
      return res.status(404).json({ error: "NOT_FOUND", message: "NCM não encontrado" });
    }
    return res.json(result);
  });

  return router;
}
