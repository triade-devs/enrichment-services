import { Router } from "express";
import type { EmpresaResponse } from "@enrichment/shared";
import { getCache, setCache } from "./cache";

export const router = Router();

export function isValidCnpj(cnpj: string): boolean {
  return /^\d{14}$/.test(cnpj);
}

export function buildEmpresaResponse(
  payload: Record<string, unknown>,
): EmpresaResponse {
  return {
    cnpj: String(payload.cnpj ?? ""),
    name: String(payload.razao_social ?? ""),
    tradeName: String(payload.nome_fantasia ?? ""),
    city: String(payload.municipio ?? ""),
    state: String(payload.uf ?? ""),
    country: "Brasil",
    isActive: String(payload.situacao_cadastral ?? "").toUpperCase() === "ATIVA",
  };
}

router.get("/empresa/:cnpj", async (req, res) => {
  const cnpj = req.params.cnpj.replace(/\D/g, "");
  if (!isValidCnpj(cnpj)) {
    return res.status(422).json({ error: "INVALID_FORMAT", message: "CNPJ deve ter 14 dígitos" });
  }

  const cached = getCache<EmpresaResponse>(cnpj);
  if (cached) return res.json(cached);

  try {
    const upstream = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (upstream.status === 404) {
      return res.status(404).json({ error: "NOT_FOUND", message: "CNPJ não encontrado" });
    }
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const payload = (await upstream.json()) as Record<string, unknown>;
    const result = buildEmpresaResponse(payload);
    setCache(cnpj, result);
    return res.json(result);
  } catch {
    return res.status(503).json({ error: "UPSTREAM_UNAVAILABLE", message: "BrasilAPI indisponível" });
  }
});
