const DEFAULT_TTL = 30_000

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

const store = new Map<string, CacheEntry<any>>()

function isValid(entry: CacheEntry<any>): boolean {
  return Date.now() - entry.timestamp <= entry.ttl
}

export function getCache<T>(key: string): T | undefined {
  const entry = store.get(key)
  if (!entry) return undefined
  if (!isValid(entry)) {
    store.delete(key)
    return undefined
  }
  return entry.data as T
}

export function setCache<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
  store.set(key, { data, timestamp: Date.now(), ttl })
}

export function invalidateCache(key: string): void {
  store.delete(key)
}

export function invalidateByPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

export function clearCache(): void {
  store.clear()
}

export function cacheKey(collection: string, ...parts: string[]): string {
  return [collection, ...parts].join(':')
}
