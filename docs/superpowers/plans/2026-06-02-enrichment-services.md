# Enrichment Services — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monorepo Node/TS com 4 serviços de lookup puro (ms-ncm, ms-empresa, ms-cep, ms-barcode) para autocompletar formulários do ERP sem persistir dados.

**Architecture:** Monorepo npm workspaces — pacote `shared` com tipos compartilhados e 4 serviços Express independentes. Cada serviço tem cache em memória com TTL próprio, rota `/health` e rotas de lookup. Deploy em Render free tier com keep-alive via GitHub Actions.

**Tech Stack:** Node.js 20, TypeScript 5, Express 4, tsx (runtime dev+prod), Vitest, node-cron (ms-ncm apenas).

**Spec:** `../../../erp/docs/superpowers/specs/2026-06-02-enrichment-services-design.md`

---

## Mapa de arquivos

```
enrichment-services/
├── .github/workflows/keepalive.yml
├── packages/shared/
│   ├── src/types.ts          — interfaces de resposta compartilhadas
│   ├── package.json
│   └── tsconfig.json
├── services/
│   ├── ms-ncm/src/
│   │   ├── index.ts          — Express app + startup (fetch Siscomex, cron)
│   │   ├── router.ts         — GET /health, /ncm/busca, /ncm/:codigo
│   │   ├── ncm-store.ts      — Map em memória + sincronização
│   │   └── index.test.ts     — testes unitários do store + rotas
│   ├── ms-empresa/src/
│   │   ├── index.ts          — Express app
│   │   ├── router.ts         — GET /health, /empresa/:cnpj
│   │   ├── cache.ts          — Map<cnpj, {data, cachedAt}> TTL 24h
│   │   └── index.test.ts
│   ├── ms-cep/src/
│   │   ├── index.ts
│   │   ├── router.ts         — GET /health, /cep/:cep
│   │   ├── cache.ts          — Map<cep, {data, cachedAt}> TTL 7d
│   │   └── index.test.ts
│   └── ms-barcode/src/
│       ├── index.ts
│       ├── router.ts         — GET /health, /barcode/:ean
│       ├── cache.ts          — Map<ean, {data, cachedAt}> TTL 7d
│       └── index.test.ts
├── .gitignore
├── package.json              — root workspace
└── tsconfig.json             — base config
```

---

## Task 1: Root do monorepo

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Criar `.gitignore`**

```
node_modules/
dist/
*.js.map
.env
.env.local
```

- [ ] **Step 2: Criar `package.json` raiz**

```json
{
  "name": "enrichment-services",
  "private": true,
  "workspaces": ["packages/*", "services/*"],
  "scripts": {
    "dev:ncm":     "npm run dev --workspace=services/ms-ncm",
    "dev:empresa": "npm run dev --workspace=services/ms-empresa",
    "dev:cep":     "npm run dev --workspace=services/ms-cep",
    "dev:barcode": "npm run dev --workspace=services/ms-barcode",
    "test":        "vitest run --reporter=verbose",
    "test:watch":  "vitest"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^2"
  }
}
```

- [ ] **Step 3: Criar `tsconfig.json` base**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  }
}
```

- [ ] **Step 4: Instalar dependências raiz**

Run: `npm install`
Expected: `node_modules/` criado na raiz.

- [ ] **Step 5: Commit**

```bash
git add .gitignore package.json tsconfig.json
git commit -m "chore: monorepo root setup"
```

---

## Task 2: Pacote shared

**Files:**
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`

- [ ] **Step 1: `packages/shared/package.json`**

```json
{
  "name": "@enrichment/shared",
  "version": "1.0.0",
  "main": "./src/types.ts",
  "types": "./src/types.ts"
}
```

- [ ] **Step 2: `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "rootDir": "src" }
}
```

- [ ] **Step 3: `packages/shared/src/types.ts`**

```ts
// Resposta padrão de erro
export type ErrorResponse = {
  error: "NOT_FOUND" | "INVALID_FORMAT" | "UPSTREAM_UNAVAILABLE";
  message: string;
};

// ms-ncm
export type NcmResult = {
  code: string;
  description: string;
};
export type NcmSearchResponse = { results: NcmResult[] };

// ms-empresa
export type EmpresaResponse = {
  cnpj: string;
  name: string;
  tradeName: string;
  city: string;
  state: string;
  country: string;
  isActive: boolean;
};

// ms-cep
export type CepResponse = {
  cep: string;
  city: string;
  state: string;
  country: string;
};

// ms-barcode
export type BarcodeResponse = {
  ean: string;
  name: string;
  brand: string;
  category: string;
};

// Utilitário genérico de cache
export type CacheEntry<T> = {
  data: T;
  cachedAt: number; // Date.now()
};
```

- [ ] **Step 4: Commit**

```bash
git add packages/
git commit -m "feat(shared): shared types for all services"
```

---

## Task 3: ms-cep (serviço mais simples — começa aqui)

**Files:**
- Create: `services/ms-cep/package.json`
- Create: `services/ms-cep/tsconfig.json`
- Create: `services/ms-cep/src/cache.ts`
- Create: `services/ms-cep/src/router.ts`
- Create: `services/ms-cep/src/index.ts`
- Create: `services/ms-cep/src/index.test.ts`

- [ ] **Step 1: `services/ms-cep/package.json`**

```json
{
  "name": "@enrichment/ms-cep",
  "version": "1.0.0",
  "scripts": {
    "dev":   "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test":  "vitest run"
  },
  "dependencies": {
    "@enrichment/shared": "*",
    "express": "^4.19.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20",
    "tsx": "^4.7.0",
    "typescript": "^5",
    "vitest": "^2"
  }
}
```

- [ ] **Step 2: `services/ms-cep/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "rootDir": "src" }
}
```

- [ ] **Step 3: Escrever o teste que falha primeiro (RED)**

```ts
// services/ms-cep/src/index.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/cache.js", () => ({ getCache: vi.fn(), setCache: vi.fn() }));

import { buildCepResponse } from "./router.js";

describe("buildCepResponse", () => {
  it("normaliza resposta do ViaCEP para o formato esperado", () => {
    const viaCepPayload = {
      cep: "01310-100",
      localidade: "São Paulo",
      uf: "SP",
    };
    const result = buildCepResponse(viaCepPayload);
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
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm run test --workspace=services/ms-cep`
Expected: FAIL — `buildCepResponse is not exported`

- [ ] **Step 5: `services/ms-cep/src/cache.ts`**

```ts
import type { CacheEntry } from "@enrichment/shared";

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const store = new Map<string, CacheEntry<unknown>>();

export function getCache<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(key: string, data: T): void {
  store.set(key, { data, cachedAt: Date.now() });
}
```

- [ ] **Step 6: `services/ms-cep/src/router.ts`**

```ts
import { Router } from "express";
import type { CepResponse } from "@enrichment/shared";
import { getCache, setCache } from "./cache.js";

export const router = Router();

/** Normaliza payload do ViaCEP para CepResponse. Exportado para teste. */
export function buildCepResponse(
  payload: Record<string, unknown>,
): CepResponse | null {
  if (payload.erro) return null;
  return {
    cep: String(payload.cep ?? ""),
    city: String(payload.localidade ?? ""),
    state: String(payload.uf ?? ""),
    country: "Brasil",
  };
}

router.get("/cep/:cep", async (req, res) => {
  const raw = req.params.cep.replace(/\D/g, "");
  if (raw.length !== 8) {
    return res.status(422).json({ error: "INVALID_FORMAT", message: "CEP deve ter 8 dígitos" });
  }

  const cached = getCache<CepResponse>(raw);
  if (cached) return res.json(cached);

  try {
    const upstream = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
    if (!upstream.ok) throw new Error("upstream error");
    const payload = (await upstream.json()) as Record<string, unknown>;
    const result = buildCepResponse(payload);
    if (!result) {
      return res.status(404).json({ error: "NOT_FOUND", message: "CEP não encontrado" });
    }
    setCache(raw, result);
    return res.json(result);
  } catch {
    return res.status(503).json({ error: "UPSTREAM_UNAVAILABLE", message: "ViaCEP indisponível" });
  }
});
```

- [ ] **Step 7: `services/ms-cep/src/index.ts`**

```ts
import express from "express";
import { router } from "./router.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use(router);

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`ms-cep running on :${PORT}`));
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npm install && npm run test --workspace=services/ms-cep`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add services/ms-cep/
git commit -m "feat(ms-cep): CEP lookup service with in-memory cache"
```

---

## Task 4: ms-empresa

**Files:**
- Create: `services/ms-empresa/package.json`
- Create: `services/ms-empresa/tsconfig.json`
- Create: `services/ms-empresa/src/cache.ts`
- Create: `services/ms-empresa/src/router.ts`
- Create: `services/ms-empresa/src/index.ts`
- Create: `services/ms-empresa/src/index.test.ts`

- [ ] **Step 1: `services/ms-empresa/package.json`**

```json
{
  "name": "@enrichment/ms-empresa",
  "version": "1.0.0",
  "scripts": {
    "dev":   "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test":  "vitest run"
  },
  "dependencies": {
    "@enrichment/shared": "*",
    "express": "^4.19.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20",
    "tsx": "^4.7.0",
    "typescript": "^5",
    "vitest": "^2"
  }
}
```

- [ ] **Step 2: `services/ms-empresa/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "rootDir": "src" }
}
```

- [ ] **Step 3: Escrever o teste que falha (RED)**

```ts
// services/ms-empresa/src/index.test.ts
import { describe, it, expect } from "vitest";
import { buildEmpresaResponse, isValidCnpj } from "./router.js";

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
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm run test --workspace=services/ms-empresa`
Expected: FAIL — `buildEmpresaResponse is not exported`

- [ ] **Step 5: `services/ms-empresa/src/cache.ts`**

```ts
import type { CacheEntry } from "@enrichment/shared";

const TTL_MS = 24 * 60 * 60 * 1000; // 24 horas
const store = new Map<string, CacheEntry<unknown>>();

export function getCache<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache<T>(key: string, data: T): void {
  store.set(key, { data, cachedAt: Date.now() });
}
```

- [ ] **Step 6: `services/ms-empresa/src/router.ts`**

```ts
import { Router } from "express";
import type { EmpresaResponse } from "@enrichment/shared";
import { getCache, setCache } from "./cache.js";

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
```

- [ ] **Step 7: `services/ms-empresa/src/index.ts`**

```ts
import express from "express";
import { router } from "./router.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use(router);

const PORT = process.env.PORT ?? 3002;
app.listen(PORT, () => console.log(`ms-empresa running on :${PORT}`));
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npm install && npm run test --workspace=services/ms-empresa`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add services/ms-empresa/
git commit -m "feat(ms-empresa): CNPJ lookup via BrasilAPI with in-memory cache"
```

---

## Task 5: ms-barcode

**Files:**
- Create: `services/ms-barcode/package.json`
- Create: `services/ms-barcode/tsconfig.json`
- Create: `services/ms-barcode/src/cache.ts`
- Create: `services/ms-barcode/src/router.ts`
- Create: `services/ms-barcode/src/index.ts`
- Create: `services/ms-barcode/src/index.test.ts`

- [ ] **Step 1: `services/ms-barcode/package.json`**

```json
{
  "name": "@enrichment/ms-barcode",
  "version": "1.0.0",
  "scripts": {
    "dev":   "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test":  "vitest run"
  },
  "dependencies": {
    "@enrichment/shared": "*",
    "express": "^4.19.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20",
    "tsx": "^4.7.0",
    "typescript": "^5",
    "vitest": "^2"
  }
}
```

- [ ] **Step 2: `services/ms-barcode/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "rootDir": "src" }
}
```

- [ ] **Step 3: Escrever o teste que falha (RED)**

```ts
// services/ms-barcode/src/index.test.ts
import { describe, it, expect } from "vitest";
import { isValidEan, buildBarcodeResponse } from "./router.js";

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
        code: "7891234567890",
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
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm run test --workspace=services/ms-barcode`
Expected: FAIL — `isValidEan is not exported`

- [ ] **Step 5: `services/ms-barcode/src/cache.ts`** (mesmo padrão ms-cep, TTL 7 dias)

```ts
import type { CacheEntry } from "@enrichment/shared";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const store = new Map<string, CacheEntry<unknown>>();

export function getCache<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) { store.delete(key); return null; }
  return entry.data;
}

export function setCache<T>(key: string, data: T): void {
  store.set(key, { data, cachedAt: Date.now() });
}
```

- [ ] **Step 6: `services/ms-barcode/src/router.ts`**

```ts
import { Router } from "express";
import type { BarcodeResponse } from "@enrichment/shared";
import { getCache, setCache } from "./cache.js";

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
```

- [ ] **Step 7: `services/ms-barcode/src/index.ts`**

```ts
import express from "express";
import { router } from "./router.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use(router);

const PORT = process.env.PORT ?? 3003;
app.listen(PORT, () => console.log(`ms-barcode running on :${PORT}`));
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npm install && npm run test --workspace=services/ms-barcode`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add services/ms-barcode/
git commit -m "feat(ms-barcode): EAN lookup via Open Food Facts with in-memory cache"
```

---

## Task 6: ms-ncm (mais complexo — carrega dados em memória + cron)

**Files:**
- Create: `services/ms-ncm/package.json`
- Create: `services/ms-ncm/tsconfig.json`
- Create: `services/ms-ncm/src/ncm-store.ts`
- Create: `services/ms-ncm/src/router.ts`
- Create: `services/ms-ncm/src/index.ts`
- Create: `services/ms-ncm/src/index.test.ts`

- [ ] **Step 1: `services/ms-ncm/package.json`**

```json
{
  "name": "@enrichment/ms-ncm",
  "version": "1.0.0",
  "scripts": {
    "dev":   "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test":  "vitest run"
  },
  "dependencies": {
    "@enrichment/shared": "*",
    "express": "^4.19.2",
    "node-cron": "^3.0.3"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20",
    "@types/node-cron": "^3.0.11",
    "tsx": "^4.7.0",
    "typescript": "^5",
    "vitest": "^2"
  }
}
```

- [ ] **Step 2: `services/ms-ncm/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": { "rootDir": "src" }
}
```

- [ ] **Step 3: Escrever o teste que falha (RED)**

```ts
// services/ms-ncm/src/index.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { NcmStore } from "./ncm-store.js";

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
      code: `0${String(i).padStart(3, "0")}.00.00`,
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
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm run test --workspace=services/ms-ncm`
Expected: FAIL — `NcmStore is not exported`

- [ ] **Step 5: `services/ms-ncm/src/ncm-store.ts`**

```ts
import type { NcmResult } from "@enrichment/shared";

const SISCOMEX_URL =
  "https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json";

type SiscomexItem = { Codigo: string; Descricao: string };

export class NcmStore {
  private items: NcmResult[] = [];
  private lastSync: Date | null = null;

  load(items: NcmResult[]): void {
    this.items = items;
    this.lastSync = new Date();
  }

  search(q: string): NcmResult[] {
    const term = q.toLowerCase();
    return this.items
      .filter(
        (item) =>
          item.code.startsWith(q) ||
          item.description.toLowerCase().includes(term),
      )
      .slice(0, 10);
  }

  getByCode(code: string): NcmResult | null {
    return this.items.find((item) => item.code === code) ?? null;
  }

  count(): number {
    return this.items.length;
  }

  getLastSync(): Date | null {
    return this.lastSync;
  }

  async syncFromSiscomex(): Promise<void> {
    const res = await fetch(SISCOMEX_URL);
    if (!res.ok) throw new Error(`Siscomex respondeu ${res.status}`);
    const raw = (await res.json()) as SiscomexItem[];
    const items: NcmResult[] = raw.map((item) => ({
      code: item.Codigo,
      description: item.Descricao,
    }));
    this.load(items);
    console.log(`ms-ncm: ${items.length} NCMs sincronizados`);
  }
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npm run test --workspace=services/ms-ncm`
Expected: PASS

- [ ] **Step 7: `services/ms-ncm/src/router.ts`**

```ts
import { Router } from "express";
import type { NcmStore } from "./ncm-store.js";

export function buildRouter(store: NcmStore) {
  const router = Router();

  router.get("/ncm/busca", (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) {
      return res.status(422).json({ error: "INVALID_FORMAT", message: "q deve ter ao menos 2 caracteres" });
    }
    return res.json({ results: store.search(q) });
  });

  router.get("/ncm/:codigo", (req, res) => {
    const result = store.getByCode(req.params.codigo);
    if (!result) {
      return res.status(404).json({ error: "NOT_FOUND", message: "NCM não encontrado" });
    }
    return res.json(result);
  });

  return router;
}
```

- [ ] **Step 8: `services/ms-ncm/src/index.ts`**

```ts
import express from "express";
import cron from "node-cron";
import { NcmStore } from "./ncm-store.js";
import { buildRouter } from "./router.js";

const store = new NcmStore();
const app = express();
app.use(express.json());

app.get("/health", (_req, res) =>
  res.json({
    status: store.count() > 0 ? "ok" : "loading",
    records: store.count(),
    lastSync: store.getLastSync(),
  }),
);

app.use(buildRouter(store));

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, async () => {
  console.log(`ms-ncm running on :${PORT}`);
  try {
    await store.syncFromSiscomex();
  } catch (e) {
    console.error("Falha na sincronização inicial:", e);
  }
});

// Sincroniza diariamente à meia-noite
cron.schedule("0 0 * * *", async () => {
  try {
    await store.syncFromSiscomex();
  } catch (e) {
    console.error("Falha na sincronização diária:", e);
  }
});
```

- [ ] **Step 9: Instalar + testar**

Run: `npm install && npm run test --workspace=services/ms-ncm`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add services/ms-ncm/
git commit -m "feat(ms-ncm): NCM lookup with in-memory store and daily Siscomex sync"
```

---

## Task 7: GitHub Actions keep-alive

**Files:**
- Create: `.github/workflows/keepalive.yml`

- [ ] **Step 1: Criar o workflow**

```yaml
# .github/workflows/keepalive.yml
name: Keep services alive

on:
  schedule:
    - cron: "*/13 * * * *"   # a cada 13 minutos
  workflow_dispatch:           # permite disparar manualmente

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping ms-ncm
        run: curl -sf ${{ secrets.MS_NCM_URL }}/health || echo "ms-ncm não respondeu"

      - name: Ping ms-empresa
        run: curl -sf ${{ secrets.MS_EMPRESA_URL }}/health || echo "ms-empresa não respondeu"

      - name: Ping ms-cep
        run: curl -sf ${{ secrets.MS_CEP_URL }}/health || echo "ms-cep não respondeu"

      - name: Ping ms-barcode
        run: curl -sf ${{ secrets.MS_BARCODE_URL }}/health || echo "ms-barcode não respondeu"
```

> Após fazer deploy no Render, adicionar os secrets no GitHub:
> Settings → Secrets and variables → Actions:
> `MS_NCM_URL`, `MS_EMPRESA_URL`, `MS_CEP_URL`, `MS_BARCODE_URL`

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "ci: GitHub Actions keep-alive pinging all services every 13min"
```

---

## Task 8: Verificação final + push

- [ ] **Step 1: Rodar todos os testes**

Run: `npm install && npm test`
Expected: todos os testes passam.

- [ ] **Step 2: Verificar que cada serviço sobe localmente**

```bash
# Terminal 1
npm run dev:ncm
# Expected: ms-ncm running on :3000 + sync log

# Terminal 2
npm run dev:cep
# Expected: ms-cep running on :3001

# Terminal 3
curl http://localhost:3001/cep/01310100
# Expected: {"cep":"01310-100","city":"São Paulo","state":"SP","country":"Brasil"}
```

- [ ] **Step 3: Push**

```bash
git push origin main
```

---

## Notas de deploy no Render

Para cada serviço, criar um novo **Web Service** no Render apontando para este repositório:

| Serviço | Root Directory | Build Command | Start Command | Port |
|---------|---------------|---------------|---------------|------|
| ms-ncm | `services/ms-ncm` | `npm install` | `npm start` | 3000 |
| ms-empresa | `services/ms-empresa` | `npm install` | `npm start` | 3002 |
| ms-cep | `services/ms-cep` | `npm install` | `npm start` | 3001 |
| ms-barcode | `services/ms-barcode` | `npm install` | `npm start` | 3003 |

Após o deploy, adicionar as URLs geradas pelo Render como secrets no GitHub para o keep-alive workflow.
