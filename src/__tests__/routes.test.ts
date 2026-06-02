import { describe, it, expect, beforeEach } from "vitest";
import { NcmStore } from "../routes/ncm/ncm-store";
import { buildEmpresaResponse, isValidCnpj } from "../routes/empresa/router";
import { buildCepResponse } from "../routes/cep/router";
import { buildBarcodeResponse, isValidEan } from "../routes/barcode/router";

// ─── NCM ──────────────────────────────────────────────────────────────────────

describe("NcmStore", () => {
  let store: NcmStore;
  beforeEach(() => {
    store = new NcmStore();
    store.load([
      { code: "8517.12.31", description: "Telefones para redes celulares" },
      { code: "8517.62.00", description: "Aparelhos de telecomunicação" },
      { code: "0101.21.00", description: "Reprodutores de raça pura" },
    ]);
  });

  it("busca por prefixo de código", () => {
    expect(store.search("8517")).toHaveLength(2);
  });

  it("busca por substring na descrição", () => {
    expect(store.search("celular")[0]!.code).toBe("8517.12.31");
  });

  it("retorna no máximo 10 resultados", () => {
    store.load(Array.from({ length: 20 }, (_, i) => ({ code: `${String(i).padStart(4,"0")}.00.00`, description: `produto ${i}` })));
    expect(store.search("produto")).toHaveLength(10);
  });

  it("retorna null para código inexistente", () => {
    expect(store.getByCode("9999.99.99")).toBeNull();
  });

  it("retorna item para código exato", () => {
    expect(store.getByCode("8517.12.31")?.description).toBe("Telefones para redes celulares");
  });

  it("reporta zero registros antes de carregar", () => {
    expect(new NcmStore().count()).toBe(0);
  });
});

// ─── Empresa ──────────────────────────────────────────────────────────────────

describe("isValidCnpj", () => {
  it("aceita 14 dígitos", () => expect(isValidCnpj("12345678000195")).toBe(true));
  it("rejeita menos de 14", () => expect(isValidCnpj("1234567800019")).toBe(false));
  it("rejeita vazio", () => expect(isValidCnpj("")).toBe(false));
});

describe("buildEmpresaResponse", () => {
  it("normaliza payload da BrasilAPI", () => {
    expect(buildEmpresaResponse({
      cnpj: "12345678000195", razao_social: "EMPRESA LTDA", nome_fantasia: "Empresa",
      municipio: "São Paulo", uf: "SP", situacao_cadastral: "ATIVA",
    })).toEqual({ cnpj: "12345678000195", name: "EMPRESA LTDA", tradeName: "Empresa", city: "São Paulo", state: "SP", country: "Brasil", isActive: true });
  });

  it("marca inativa quando situação não é ATIVA", () => {
    expect(buildEmpresaResponse({ cnpj: "1", razao_social: "", nome_fantasia: "", municipio: "", uf: "", situacao_cadastral: "BAIXADA" }).isActive).toBe(false);
  });
});

// ─── CEP ──────────────────────────────────────────────────────────────────────

describe("buildCepResponse", () => {
  it("normaliza resposta do ViaCEP", () => {
    expect(buildCepResponse({ cep: "01310-100", localidade: "São Paulo", uf: "SP" }))
      .toEqual({ cep: "01310-100", city: "São Paulo", state: "SP", country: "Brasil" });
  });

  it("retorna null para CEP inválido (campo erro)", () => {
    expect(buildCepResponse({ erro: true })).toBeNull();
  });
});

// ─── Barcode ──────────────────────────────────────────────────────────────────

describe("isValidEan", () => {
  it("aceita EAN-13", () => expect(isValidEan("7891234567890")).toBe(true));
  it("aceita EAN-8",  () => expect(isValidEan("12345678")).toBe(true));
  it("rejeita outros", () => expect(isValidEan("123456")).toBe(false));
});

describe("buildBarcodeResponse", () => {
  it("normaliza payload do Open Food Facts", () => {
    expect(buildBarcodeResponse("7891234567890", {
      status: 1,
      product: { product_name: "Biscoito", brands: "Marca X", categories: "Biscoitos" },
    })).toEqual({ ean: "7891234567890", name: "Biscoito", brand: "Marca X", category: "Biscoitos" });
  });

  it("retorna null quando status é 0", () => {
    expect(buildBarcodeResponse("7891234567890", { status: 0, product: {} })).toBeNull();
  });
});
