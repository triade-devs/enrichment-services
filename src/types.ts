export type NcmResult       = { code: string; description: string };
export type NcmSearchResponse = { results: NcmResult[] };

export type EmpresaResponse = {
  cnpj: string; name: string; tradeName: string;
  city: string; state: string; country: string; isActive: boolean;
};

export type CepResponse = {
  cep: string; city: string; state: string; country: string;
};

export type BarcodeResponse = {
  ean: string; name: string; brand: string; category: string;
};

export type CacheEntry<T> = { data: T; cachedAt: number };
