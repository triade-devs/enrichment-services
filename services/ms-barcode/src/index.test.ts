import { describe, it, expect } from "vitest";
import { isValidEan, buildBarcodeResponse } from "./router";

describe("isValidEan", () => {
  it("aceita EAN-13", () => expect(isValidEan("7891234567890")).toBe(true));
  it("aceita EAN-8",  () => expect(isValidEan("12345678")).toBe(true));
  it("rejeita outros tamanhos", () => expect(isValidEan("123456")).toBe(false));
});

describe("buildBarcodeResponse", () => {
  it("normaliza payload do Open Food Facts", () => {
    const payload = {
      status: 1,
      product: {
        product_name: "Biscoito Recheado",
        brands: "Marca X",
        categories: "Biscoitos",
      },
    };
    expect(buildBarcodeResponse("7891234567890", payload)).toEqual({
      ean: "7891234567890",
      name: "Biscoito Recheado",
      brand: "Marca X",
      category: "Biscoitos",
    });
  });

  it("retorna null quando status é 0 (produto não encontrado)", () => {
    expect(buildBarcodeResponse("7891234567890", { status: 0, product: {} })).toBeNull();
  });
});
