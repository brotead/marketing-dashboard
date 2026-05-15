// Module-level singleton — survives React re-renders and client-side navigation.
// Never imported on the server (all callers are 'use client').

const HOUR  = 60 * 60 * 1000
const MIN15 = 15 * 60 * 1000
const MIN5  =  5 * 60 * 1000
const MIN1  =      60 * 1000

export const TTL = { HOUR, MIN15, MIN5, MIN1 }

interface Entry<T> {
  data:    T | undefined
  ts:      number
  promise: Promise<T> | null
}

class AppCache {
  private store = new Map<string, Entry<unknown>>()

  private get<T>(key: string): Entry<T> | undefined {
    return this.store.get(key) as Entry<T> | undefined
  }

  /** True if we have data for this key (even stale). */
  has(key: string): boolean {
    const e = this.store.get(key)
    return !!e && e.data !== undefined
  }

  /** Synchronous read — returns data or null without triggering a fetch. */
  peek<T>(key: string): T | null {
    return (this.get<T>(key)?.data ?? null) as T | null
  }

  /**
   * Async read with stale-while-revalidate:
   * - Fresh hit  → returns immediately (no network).
   * - Stale hit  → returns stale immediately, kicks off background refresh.
   * - In-flight  → deduplicates (returns same promise).
   * - Miss       → fetches and awaits.
   */
  async fetch<T>(key: string, fetcher: () => Promise<T>, ttl = MIN5): Promise<T> {
    const e   = this.get<T>(key)
    const now = Date.now()

    // 1. Fresh — return immediately
    if (e && !e.promise && e.data !== undefined && now - e.ts < ttl) {
      return e.data
    }

    // 2. In-flight — deduplicate
    if (e?.promise) {
      // If we already have stale data, return it while the in-flight promise runs
      if (e.data !== undefined) return e.data
      return e.promise
    }

    // 3. Build promise
    const promise: Promise<T> = fetcher().then(data => {
      this.store.set(key, { data, ts: Date.now(), promise: null })
      return data
    }).catch(err => {
      // Clear promise so next call retries
      const cur = this.store.get(key)
      if (cur) this.store.set(key, { ...cur, promise: null })
      throw err
    })

    // 4. Stale — return stale data now, refresh in background
    if (e?.data !== undefined) {
      this.store.set(key, { ...e, promise })
      return e.data
    }

    // 5. Miss — await the promise
    this.store.set(key, { data: undefined, ts: 0, promise })
    return promise
  }

  /** Fire-and-forget prefetch. Skips if data is fresh or request is in-flight. */
  prefetch<T>(key: string, fetcher: () => Promise<T>, ttl = MIN5): void {
    const e   = this.store.get(key)
    const now = Date.now()
    if (e?.promise) return
    if (e?.data !== undefined && now - (e.ts) < ttl) return
    this.fetch(key, fetcher, ttl).catch(() => {})
  }

  /** Mark a key as stale so the next fetch will refresh it. */
  invalidate(key: string): void {
    const e = this.store.get(key)
    if (e) this.store.set(key, { ...e, ts: 0, promise: null })
  }

  /** Mark all keys stale. */
  invalidateAll(): void {
    for (const [k, e] of this.store) {
      this.store.set(k, { ...e, ts: 0, promise: null })
    }
  }

  /** Remove a key entirely — next fetch will be a guaranteed miss (no stale return). */
  invalidateHard(key: string): void {
    this.store.delete(key)
  }

  /** Remove all keys whose name starts with prefix. */
  invalidateHardByPrefix(prefix: string): void {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k)
    }
  }

  /** Remove all keys. */
  invalidateAllHard(): void {
    this.store.clear()
  }
}

export const appCache = new AppCache()
