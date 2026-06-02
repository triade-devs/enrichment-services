import { describe, it, expect, beforeEach } from "vitest";
import { NcmStore } from "./ncm-store";

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
    const results = store.search("8517");
    expect(results).toHaveLength(2);
    expect(results[0]!.code).toBe("8517.12.31");
  });

  it("busca por substring na descrição", () => {
    const results = store.search("celular");
    expect(results).toHaveLength(1);
    expect(results[0]!.code).toBe("8517.12.31");
  });

  it("retorna no máximo 10 resultados", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      code: `${String(i).padStart(4, "0")}.00.00`,
      description: `produto ${i}`,
    }));
    store.load(many);
    expect(store.search("produto")).toHaveLength(10);
  });

  it("retorna null para código inexistente", () => {
    expect(store.getByCode("9999.99.99")).toBeNull();
  });

  it("retorna o item para código exato", () => {
    const result = store.getByCode("8517.12.31");
    expect(result?.description).toBe("Telefones para redes celulares");
  });

  it("reporta zero registros antes de carregar", () => {
    const empty = new NcmStore();
    expect(empty.count()).toBe(0);
  });
});
