/**
 * Кэш ответов /ai/search: LRU в памяти (по умолчанию 500 ключей) и, если задан REDIS_URL,
 * второй уровень в redis с TTL. Redis — ускоритель, не зависимость: его ошибки логируются и
 * не влияют на ответ.
 */
import type { RedisClient } from './redis.ts'

export class LruCache<V> {
  private readonly map = new Map<string, V>()
  private readonly capacity: number
  hits = 0
  misses = 0

  constructor(capacity: number) {
    this.capacity = capacity
  }

  get size(): number {
    return this.map.size
  }

  get(key: string): V | undefined {
    const value = this.map.get(key)
    if (value === undefined) {
      this.misses += 1
      return undefined
    }
    this.hits += 1
    // Map хранит порядок вставки: перестановка в конец делает ключ самым свежим.
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: string, value: V): void {
    if (this.capacity <= 0) return
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    while (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      this.map.delete(oldest)
    }
  }

  clear(): void {
    this.map.clear()
  }
}

export interface ResponseCacheOptions {
  capacity: number
  ttlSeconds: number
  redis?: RedisClient | null
  log?: (line: string) => void
}

export class ResponseCache {
  readonly memory: LruCache<string>
  private readonly redis: RedisClient | null
  private readonly ttl: number
  private readonly log: (line: string) => void

  constructor(options: ResponseCacheOptions) {
    this.memory = new LruCache<string>(options.capacity)
    this.redis = options.redis ?? null
    this.ttl = options.ttlSeconds
    this.log = options.log ?? (() => {})
  }

  /** Сериализованный JSON ответа или null. */
  async get(key: string): Promise<string | null> {
    const local = this.memory.get(key)
    if (local !== undefined) return local
    if (!this.redis) return null
    try {
      const remote = await this.redis.get(key)
      if (remote !== null) this.memory.set(key, remote)
      return remote
    } catch (error) {
      this.log(`redis get: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }

  async set(key: string, value: string): Promise<void> {
    this.memory.set(key, value)
    if (!this.redis) return
    try {
      await this.redis.setEx(key, value, this.ttl)
    } catch (error) {
      this.log(`redis set: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  stats(): { size: number; hits: number; misses: number; redis: boolean } {
    return { size: this.memory.size, hits: this.memory.hits, misses: this.memory.misses, redis: this.redis !== null }
  }
}
