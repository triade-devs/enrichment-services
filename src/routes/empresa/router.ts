import { Router } from "express";
import type { EmpresaResponse } from "../../types";
import { makeCache } from "../../cache";

const cache = makeCache<EmpresaResponse>(24 * 60 * 60 * 1000);
export const empresaRouter = Router();

export function isValidCnpj(cnpj: string): boolean {
  return /^\d{14}$/.test(cnpj);
}

export function buildEmpresaResponse(p: Record<string, unknown>): EmpresaResponse {
  return {
    cnpj: String(p.cnpj ?? ""),
    name: String(p.razao_social ?? ""),
    tradeName: String(p.nome_fantasia ?? ""),
    city: String(p.municipio ?? ""),
    state: String(p.uf ?? ""),
    country: "Brasil",
    isActive: String(p.situacao_cadastral ?? "").toUpperCase() === "ATIVA",
  };
}

empresaRouter.get("/empresa/:cnpj", async (req, res) => {
  const cnpj = req.params.cnpj.replace(/\D/g, "");
  if (!isValidCnpj(cnpj)) {
    return res.status(422).json({ error: "INVALID_FORMAT", message: "CNPJ deve ter 14 dígitos" });
  }
  const cached = cache.get(cnpj);
  if (cached) return res.json(cached);
  try {
    const upstream = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (upstream.status === 404) {
      return res.status(404).json({ error: "NOT_FOUND", message: "CNPJ não encontrado" });
    }
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const result = buildEmpresaResponse((await upstream.json()) as Record<string, unknown>);
    cache.set(cnpj, result);
    return res.json(result);
  } catch {
    return res.status(503).json({ error: "UPSTREAM_UNAVAILABLE", message: "BrasilAPI indisponível" });
  }
});
