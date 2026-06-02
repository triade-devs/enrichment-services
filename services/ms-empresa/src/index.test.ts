import { describe, it, expect } from "vitest";
import { buildEmpresaResponse, isValidCnpj } from "./router";

describe("isValidCnpj", () => {
  it("aceita CNPJ com 14 dígitos", () => {
    expect(isValidCnpj("12345678000195")).toBe(true);
  });
  it("rejeita CNPJ com menos de 14 dígitos", () => {
    expect(isValidCnpj("1234567800019")).toBe(false);
  });
  it("rejeita string vazia", () => {
    expect(isValidCnpj("")).toBe(false);
  });
});

describe("buildEmpresaResponse", () => {
  it("normaliza payload da BrasilAPI para o formato esperado", () => {
    const payload = {
      cnpj: "12345678000195",
      razao_social: "EMPRESA LTDA",
      nome_fantasia: "Empresa",
      municipio: "São Paulo",
      uf: "SP",
      situacao_cadastral: "ATIVA",
    };
    expect(buildEmpresaResponse(payload)).toEqual({
      cnpj: "12345678000195",
      name: "EMPRESA LTDA",
      tradeName: "Empresa",
      city: "São Paulo",
      state: "SP",
      country: "Brasil",
      isActive: true,
    });
  });

  it("marca como inativa quando situação cadastral não é ATIVA", () => {
    const payload = {
      cnpj: "12345678000195",
      razao_social: "EMPRESA BAIXADA",
      nome_fantasia: "",
      municipio: "Rio de Janeiro",
      uf: "RJ",
      situacao_cadastral: "BAIXADA",
    };
    expect(buildEmpresaResponse(payload).isActive).toBe(false);
  });
});
