import { Router } from "express";
import type { BarcodeResponse } from "@enrichment/shared";
import { getCache, setCache } from "./cache";

export const router = Router();

export function isValidEan(ean: string): boolean {
  return ean.length === 8 || ean.length === 13;
}

export function buildBarcodeResponse(
  ean: string,
  payload: { status: number; product: Record<string, unknown> },
): BarcodeResponse | null {
  if (payload.status !== 1) return null;
  const p = payload.product;
  return {
    ean,
    name: String(p.product_name ?? ""),
    brand: String(p.brands ?? ""),
    category: String(p.categories ?? ""),
  };
}

async function fetchOpenFoodFacts(ean: string): Promise<BarcodeResponse | null> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v0/product/${ean}.json`,
  );
  if (!res.ok) return null;
  const payload = (await res.json()) as { status: number; product: Record<string, unknown> };
  return buildBarcodeResponse(ean, payload);
}

router.get("/barcode/:ean", async (req, res) => {
  const ean = req.params.ean.replace(/\D/g, "");
  if (!isValidEan(ean)) {
    return res.status(422).json({ error: "INVALID_FORMAT", message: "Use EAN-8 ou EAN-13" });
  }

  const cached = getCache<BarcodeResponse>(ean);
  if (cached) return res.json(cached);

  try {
    const result = await fetchOpenFoodFacts(ean);
    if (!result) {
      return res.status(404).json({ error: "NOT_FOUND", message: "EAN não encontrado" });
    }
    setCache(ean, result);
    return res.json(result);
  } catch {
    return res.status(503).json({ error: "UPSTREAM_UNAVAILABLE", message: "Open Food Facts indisponível" });
  }
});
