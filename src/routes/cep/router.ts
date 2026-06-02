import { Router } from "express";
import type { CepResponse } from "../../types";
import { makeCache } from "../../cache";

const cache = makeCache<CepResponse>(7 * 24 * 60 * 60 * 1000);
export const cepRouter = Router();

export function buildCepResponse(p: Record<string, unknown>): CepResponse | null {
  if (p.erro) return null;
  return {
    cep: String(p.cep ?? ""),
    city: String(p.localidade ?? ""),
    state: String(p.uf ?? ""),
    country: "Brasil",
  };
}

cepRouter.get("/cep/:cep", async (req, res) => {
  const raw = req.params.cep.replace(/\D/g, "");
  if (raw.length !== 8) {
    return res.status(422).json({ error: "INVALID_FORMAT", message: "CEP deve ter 8 dígitos" });
  }
  const cached = cache.get(raw);
  if (cached) return res.json(cached);
  try {
    const upstream = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
    if (!upstream.ok) throw new Error("upstream error");
    const result = buildCepResponse((await upstream.json()) as Record<string, unknown>);
    if (!result) return res.status(404).json({ error: "NOT_FOUND", message: "CEP não encontrado" });
    cache.set(raw, result);
    return res.json(result);
  } catch {
    return res.status(503).json({ error: "UPSTREAM_UNAVAILABLE", message: "ViaCEP indisponível" });
  }
});
