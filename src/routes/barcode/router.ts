import { Router } from "express";
import type { BarcodeResponse } from "../../types";
import { makeCache } from "../../cache";

const cache = makeCache<BarcodeResponse>(7 * 24 * 60 * 60 * 1000);
export const barcodeRouter = Router();

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
    quantity: String(p.quantity ?? ""),
  };
}

barcodeRouter.get("/barcode/:ean", async (req, res) => {
  const ean = req.params.ean.replace(/\D/g, "");
  if (!isValidEan(ean)) {
    return res.status(422).json({ error: "INVALID_FORMAT", message: "Use EAN-8 ou EAN-13" });
  }
  const cached = cache.get(ean);
  if (cached) return res.json(cached);
  try {
    const res2 = await fetch(`https://world.openfoodfacts.org/api/v0/product/${ean}.json`);
    if (!res2.ok) return res.status(404).json({ error: "NOT_FOUND", message: "EAN não encontrado" });
    const payload = (await res2.json()) as { status: number; product: Record<string, unknown> };
    const result = buildBarcodeResponse(ean, payload);
    if (!result) return res.status(404).json({ error: "NOT_FOUND", message: "EAN não encontrado" });
    cache.set(ean, result);
    return res.json(result);
  } catch {
    return res.status(503).json({ error: "UPSTREAM_UNAVAILABLE", message: "Open Food Facts indisponível" });
  }
});
