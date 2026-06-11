# Comparação de rotas — body cru (upstream) × body normalizado (nosso serviço)

> Gerado a partir de testes ao vivo em 2026-06-06. Para cada rota mostramos o que a
> fonte externa devolve (cru) e o que o `enrichment-services` expõe (normalizado),
> destacando campos descartados e oportunidades de melhoria.
>
> Legenda: ✅ usado · 🟡 disponível mas descartado · 🐛 bug · ➕ sugestão de inclusão

---

## 1. NCM — `GET /ncm/busca?q=` e `GET /ncm/:codigo`

**Fonte:** Siscomex (download JSON da nomenclatura, carregado em memória 1×/dia)
`https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json?perfil=PUBLICO`

### Item cru (Siscomex)
```json
{ "Codigo": "0901.21.00", "Descricao": "-- Não descafeinado" }
```
> O download traz `{ "Nomenclaturas": [ {Codigo, Descricao}, ... ] }`. Cada item tem
> apenas esses dois campos (a base oficial completa tem ~15 mil registros).

### Nosso retorno
```json
// /ncm/busca?q=cafe
{ "results": [ { "code": "0901.21.00", "description": "-- Não descafeinado" } ] }

// /ncm/0901.21.00
{ "code": "0901.21.00", "description": "-- Não descafeinado" }
```

| Campo cru | Nosso campo | Status |
|---|---|---|
| `Codigo` | `code` | ✅ |
| `Descricao` | `description` | ✅ |

**Observações / melhorias**
- 🟡 As descrições do Siscomex são hierárquicas (`--`, `-`) e fora de contexto ficam
  ambíguas ("-- Não descafeinado"). Poderíamos montar a descrição completa concatenando
  os níveis pais para autocomplete mais legível.
- ➕ `/ncm/:codigo` retorna `404` para código inexistente, mas **o front não usa essa rota**
  hoje — usar para validar NCM digitado manualmente antes de salvar.

---

## 2. CEP — `GET /cep/:cep`

**Fonte:** ViaCEP — `https://viacep.com.br/ws/{cep}/json/`

### Body cru (ViaCEP)
```json
{
  "cep": "01310-100",
  "logradouro": "Avenida Paulista",
  "complemento": "de 612 a 1510 - lado par",
  "unidade": "",
  "bairro": "Bela Vista",
  "localidade": "São Paulo",
  "uf": "SP",
  "estado": "São Paulo",
  "regiao": "Sudeste",
  "ibge": "3550308",
  "gia": "1004",
  "ddd": "11",
  "siafi": "7107"
}
```

### Nosso retorno
```json
{ "cep": "01310-100", "city": "São Paulo", "state": "SP", "country": "Brasil" }
```

| Campo cru | Nosso campo | Status |
|---|---|---|
| `cep` | `cep` | ✅ |
| `localidade` | `city` | ✅ |
| `uf` | `state` | ✅ |
| — | `country` (`"Brasil"` fixo) | ✅ |
| `logradouro` | — | 🟡 descartado |
| `bairro` | — | 🟡 descartado |
| `ddd` | — | 🟡 descartado |
| `complemento`, `ibge`, `gia`, `siafi`, `regiao`, `estado`, `unidade` | — | descartados |

**Observações / melhorias**
- ➕ `logradouro` e `bairro` seriam úteis para autopreencher endereço completo do fornecedor
  (hoje o form só recebe cidade/UF).
- Erro de CEP inexistente: ViaCEP devolve `{ "erro": true }` → nosso serviço converte em `404`.

---

## 3. Empresa (CNPJ) — `GET /empresa/:cnpj`

**Fonte:** BrasilAPI — `https://brasilapi.com.br/api/cnpj/v1/{cnpj}`

### Body cru (BrasilAPI — campos principais; resposta real tem ~40 campos)
```json
{
  "cnpj": "19131243000197",
  "razao_social": "OPEN KNOWLEDGE BRASIL",
  "nome_fantasia": "REDE PELO CONHECIMENTO LIVRE",
  "situacao_cadastral": 2,
  "descricao_situacao_cadastral": "ATIVA",
  "logradouro": "PAULISTA 37",
  "numero": "37",
  "complemento": "ANDAR 4",
  "bairro": "BELA VISTA",
  "cep": "01311902",
  "municipio": "SAO PAULO",
  "uf": "SP",
  "ddd_telefone_1": "1123851939",
  "email": null,
  "cnae_fiscal": 9430800,
  "cnae_fiscal_descricao": "Atividades de associações de defesa de direitos sociais",
  "capital_social": 0,
  "porte": "DEMAIS",
  "natureza_juridica": "Associação Privada",
  "data_inicio_atividade": "2013-10-03"
}
```

### Nosso retorno
```json
{
  "cnpj": "19131243000197",
  "name": "OPEN KNOWLEDGE BRASIL",
  "tradeName": "REDE PELO CONHECIMENTO LIVRE",
  "city": "SAO PAULO",
  "state": "SP",
  "country": "Brasil",
  "isActive": false
}
```

| Campo cru | Nosso campo | Status |
|---|---|---|
| `cnpj` | `cnpj` | ✅ |
| `razao_social` | `name` | ✅ |
| `nome_fantasia` | `tradeName` | ✅ |
| `municipio` | `city` | ✅ |
| `uf` | `state` | ✅ |
| — | `country` (`"Brasil"` fixo) | ✅ |
| `situacao_cadastral` (número `2`) | `isActive` | 🐛 **comparado com a string `"ATIVA"` → sempre `false`** |
| `descricao_situacao_cadastral` (`"ATIVA"`) | — | 🐛 **campo certo para `isActive`, mas não usado** |
| `cep` | — | 🟡 não exposto (form tem campo CEP vazio) |
| `logradouro` / `numero` / `complemento` / `bairro` | — | 🟡 não exposto |
| `ddd_telefone_1` | — | 🟡 não exposto (form tem campo telefone) |
| `email` | — | 🟡 não exposto (form tem campo e-mail) |
| `cnae_fiscal_descricao`, `porte`, `natureza_juridica`, ... | — | descartados |

**Observações / melhorias**
- 🐛 **Bug de validação:** `isActive` usa `situacao_cadastral` (número), deveria usar
  `descricao_situacao_cadastral === "ATIVA"` (ou `Number(situacao_cadastral) === 2`).
- ➕ **Maior lacuna de autopreenchimento:** `cep`, `logradouro`, `bairro`,
  `ddd_telefone_1` e `email` existem no upstream, têm coluna na tabela `suppliers` e
  campo no form — mas não são repassados. Expor no `EmpresaResponse`.

---

## 4. Barcode (EAN) — `GET /barcode/:ean`

**Fonte:** Open Food Facts — `https://world.openfoodfacts.org/api/v0/product/{ean}.json`

### Body cru (Open Food Facts — `status` + amostra de `product`; o objeto real tem centenas de campos)
```json
{
  "status": 1,
  "status_verbose": "product found",
  "code": "7891000100103",
  "product": {
    "product_name": "Leite Condensado Integral moça",
    "brands": "Nestlé, Moça",
    "categories": "Leites condensados",
    "quantity": "395 g",
    "image_url": "https://images.openfoodfacts.org/images/products/789/100/010/0103/front_pt.34.400.jpg",
    "nutriscore_grade": "e",
    "countries": "Brasil"
  }
}
```

### Nosso retorno
```json
{
  "ean": "7891000100103",
  "name": "Leite Condensado Integral moça",
  "brand": "Nestlé, Moça",
  "category": "Leites condensados"
}
```

| Campo cru | Nosso campo | Status |
|---|---|---|
| `code` | `ean` | ✅ |
| `product.product_name` | `name` | ✅ |
| `product.brands` | `brand` | ✅ |
| `product.categories` | `category` | 🟡 retornado, mas **descartado no front** (product-form usa só name+brand) |
| `product.quantity` | — | 🟡 descartado (útil p/ unidade/volume) |
| `product.image_url` | — | 🟡 descartado (útil p/ foto do produto) |
| `status` / `status_verbose` | — (usado internamente p/ 404) | ✅ |

**Observações / melhorias**
- 🟡 `category` é buscada mas ignorada no front — decidir entre ligar a uma classificação
  ou parar de pedir.
- ➕ `quantity` e `image_url` agregariam valor ao cadastro de produto.
- ⚠️ Open Food Facts é colaborativo: campos vêm vazios com frequência. O fallback manual
  (não-bloqueante) já cobre isso.

---

## Resumo das ações sugeridas

| # | Tipo | Rota | Ação |
|---|---|---|---|
| 1 | 🐛 bug | empresa | `isActive` via `descricao_situacao_cadastral` |
| 2 | ➕ autopreench. | empresa | expor `cep`, `street`, `neighborhood`, `phone`, `email` |
| 3 | ➕ autopreench. | cep | expor `logradouro` e `bairro` |
| 4 | 🟡 limpeza | barcode | usar ou remover `category`; avaliar `quantity`/`image_url` |
| 5 | ➕ validação | ncm | usar `/ncm/:codigo` p/ validar código digitado |
