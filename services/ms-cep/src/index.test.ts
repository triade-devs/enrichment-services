import { describe, it, expect } from "vitest";
import { buildCepResponse } from "./router";

describe("buildCepResponse", () => {
  it("normaliza resposta do ViaCEP para o formato esperado", () => {
    const result = buildCepResponse({
      cep: "01310-100",
      localidade: "São Paulo",
      uf: "SP",
    });
    expect(result).toEqual({
      cep: "01310-100",
      city: "São Paulo",
      state: "SP",
      country: "Brasil",
    });
  });

  it("retorna null se o ViaCEP indicar CEP inválido (campo erro)", () => {
    expect(buildCepResponse({ erro: true })).toBeNull();
  });
});
