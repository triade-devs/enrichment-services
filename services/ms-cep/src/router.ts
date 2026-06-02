import { Router } from "express";
import type { CepResponse } from "@enrichment/shared";
import { getCache, setCache } from "./cache";

export const router = Router();

export function buildCepResponse(
  payload: Record<string, unknown>,
): CepResponse | null {
  if (payload.erro) return null;
  return {
    cep: String(payload.cep ?? ""),
    city: String(payload.localidade ?? ""),
    state: String(payload.uf ?? ""),
    country: "Brasil",
  };
}

router.get("/cep/:cep", async (req, res) => {
  const raw = req.params.cep.replace(/\D/g, "");
  if (raw.length !== 8) {
    return res.status(422).json({ error: "INVALID_FORMAT", message: "CEP deve ter 8 dígitos" });
  }

  const cached = getCache<CepResponse>(raw);
  if (cached) return res.json(cached);

  try {
    const upstream = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
    if (!upstream.ok) throw new Error("upstream error");
    const payload = (await upstream.json()) as Record<string, unknown>;
    const result = buildCepResponse(payload);
    if (!result) {
      return res.status(404).json({ error: "NOT_FOUND", message: "CEP não encontrado" });
    }
    setCache(raw, result);
    return res.json(result);
  } catch {
    return res.status(503).json({ error: "UPSTREAM_UNAVAILABLE", message: "ViaCEP indisponível" });
  }
});
