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
