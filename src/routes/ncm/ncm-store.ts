import type { NcmResult } from "../../types";

const SISCOMEX_URL =
  "https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json?perfil=PUBLICO";

type SiscomexItem = { Codigo: string; Descricao: string };
type SiscomexResponse = { Nomenclaturas: SiscomexItem[] };

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
      .filter((i) => i.code.startsWith(q) || i.description.toLowerCase().includes(term))
      .slice(0, 10);
  }

  getByCode(code: string): NcmResult | null {
    return this.items.find((i) => i.code === code) ?? null;
  }

  count(): number { return this.items.length; }
  getLastSync(): Date | null { return this.lastSync; }

  async syncFromSiscomex(): Promise<void> {
    const res = await fetch(SISCOMEX_URL);
    if (!res.ok) throw new Error(`Siscomex respondeu ${res.status}`);
    const raw = (await res.json()) as SiscomexResponse;
    this.load(raw.Nomenclaturas.map((i) => ({ code: i.Codigo, description: i.Descricao })));
    console.log(`ms-ncm: ${this.items.length} NCMs sincronizados`);
  }
}
