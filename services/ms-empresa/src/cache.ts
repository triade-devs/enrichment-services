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
