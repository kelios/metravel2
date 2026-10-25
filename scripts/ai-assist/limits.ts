/**
 * Лимиты `/ai/ask` на IP за календарный день (#2713): дневной лимит вопросов и
 * счётчик вопросов не по теме — третий закрывает ассистент до полуночи.
 *
 * День и полночь считаются по Europe/Minsk (аудитория сайта), а не по UTC и не по
 * устройству: клиентский счётчик (`api/aiAssist/limits.ts`) обходится очисткой
 * хранилища, серверный — нет. Числа общие с клиентом (`api/aiAssist/policy.ts`).
 * Хранилище — redis рядом с кэшем ответов (ключ живёт до полуночи); без
 * `REDIS_URL` и при его ошибке — память процесса: лимит тогда живёт до рестарта,
 * но ассистент не падает.
 */
import type { RedisClient } from './redis.ts'

export const DEFAULT_DAY_TIME_ZONE = 'Europe/Minsk'
const SECONDS_PER_DAY = 86_400
/** Запас TTL ключа после полуночи: счётчик дня не должен исчезнуть раньше, чем сменится ключ дня. */
const KEY_TTL_MARGIN_SEC = 60
const MEMORY_SWEEP_SIZE = 10_000

export interface DayClock {
  readonly timeZone: string
  /** `YYYY-MM-DD` календарного дня в часовом поясе. */
  dayKey(now?: Date): string
  /** Секунд до ближайшей полуночи в часовом поясе (≥ 1). */
  secondsToMidnight(now?: Date): number
}

export function createDayClock(timeZone: string = DEFAULT_DAY_TIME_ZONE): DayClock {
  // Неверная зона бросает RangeError здесь же — на старте сервиса, а не на первом вопросе.
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = (now: Date): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const part of format.formatToParts(now)) out[part.type] = part.value
    return out
  }
  return {
    timeZone,
    dayKey(now = new Date()) {
      const p = parts(now)
      return `${p.year}-${p.month}-${p.day}`
    },
    secondsToMidnight(now = new Date()) {
      const p = parts(now)
      const passed = Number(p.hour) * 3600 + Number(p.minute) * 60 + Number(p.second)
      return Math.max(1, SECONDS_PER_DAY - passed)
    },
  }
}

export interface CounterStore {
  /** +1 к счётчику (несуществующий — с нуля) и TTL ключа; возвращает новое значение. */
  incr(key: string, ttlSeconds: number): Promise<number>
  /** −1, не ниже нуля. */
  decr(key: string): Promise<number>
  get(key: string): Promise<number>
}

type MemoryEntry = { value: number; expiresAt: number }

export class MemoryCounterStore implements CounterStore {
  private readonly map = new Map<string, MemoryEntry>()
  private readonly now: () => number

  constructor(now: () => number = () => Date.now()) {
    this.now = now
  }

  get size(): number {
    return this.map.size
  }

  private live(key: string): MemoryEntry | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= this.now()) {
      this.map.delete(key)
      return undefined
    }
    return entry
  }

  private sweep(): void {
    if (this.map.size < MEMORY_SWEEP_SIZE) return
    const now = this.now()
    for (const [key, entry] of this.map) if (entry.expiresAt <= now) this.map.delete(key)
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    this.sweep()
    const expiresAt = this.now() + Math.max(1, ttlSeconds) * 1000
    const entry = this.live(key)
    const value = (entry?.value ?? 0) + 1
    this.map.set(key, { value, expiresAt })
    return value
  }

  async decr(key: string): Promise<number> {
    const entry = this.live(key)
    if (!entry) return 0
    entry.value = Math.max(0, entry.value - 1)
    return entry.value
  }

  async get(key: string): Promise<number> {
    return this.live(key)?.value ?? 0
  }
}

/**
 * Redis-счётчики с памятью как запасом: ошибка redis логируется, команда уходит в
 * память процесса — лимит остаётся, пусть и до рестарта. Без redis — только память.
 */
export function createCounterStore(redis: RedisClient | null, log: (line: string) => void = () => {}): CounterStore {
  const memory = new MemoryCounterStore()
  if (!redis) return memory
  const fallback = (operation: string, error: unknown) => {
    log(`redis ${operation}: ${error instanceof Error ? error.message : String(error)} — счётчик в памяти`)
  }
  return {
    async incr(key, ttlSeconds) {
      try {
        const value = await redis.incr(key)
        await redis.expire(key, ttlSeconds)
        return value
      } catch (error) {
        fallback('incr', error)
        return memory.incr(key, ttlSeconds)
      }
    },
    async decr(key) {
      try {
        const value = await redis.decr(key)
        if (value < 0) {
          // DECR несуществующего ключа создаёт его без TTL: нулевой ключ дня не должен жить вечно.
          await redis.incr(key)
          await redis.expire(key, KEY_TTL_MARGIN_SEC)
          return 0
        }
        return value
      } catch (error) {
        fallback('decr', error)
        return memory.decr(key)
      }
    },
    async get(key) {
      try {
        const value = Number((await redis.get(key)) ?? 0)
        return Number.isFinite(value) && value > 0 ? value : 0
      } catch (error) {
        fallback('get', error)
        return memory.get(key)
      }
    },
  }
}

export interface OffTopicState {
  /** Вопросов не по теме сегодня с этого IP. */
  strikes: number
  /** Ассистент закрыт для IP до полуночи. */
  blocked: boolean
}

export interface QuotaState {
  used: number
  remaining: number
  /** Вопрос сверх лимита: отказ, вопрос не обрабатывается. */
  exceeded: boolean
}

export interface AskLimitsOptions {
  store: CounterStore
  clock: DayClock
  dailyLimit: number
  strikesToBlock: number
  /** Префикс ключей; версия в нём меняется вместе с семантикой счётчика. */
  prefix?: string
}

export class AskLimits {
  private readonly store: CounterStore
  private readonly clock: DayClock
  readonly dailyLimit: number
  readonly strikesToBlock: number
  private readonly prefix: string

  constructor(options: AskLimitsOptions) {
    this.store = options.store
    this.clock = options.clock
    this.dailyLimit = options.dailyLimit
    this.strikesToBlock = options.strikesToBlock
    this.prefix = options.prefix ?? 'ai-ask:v1'
  }

  private key(kind: 'quota' | 'offtopic', ip: string, now: Date): string {
    return `${this.prefix}:${kind}:${this.clock.dayKey(now)}:${ip}`
  }

  private ttl(now: Date): number {
    return this.clock.secondsToMidnight(now) + KEY_TTL_MARGIN_SEC
  }

  /** Секунд до полуночи — значение `Retry-After` для блока и дневного лимита. */
  retryAfterSeconds(now: Date = new Date()): number {
    return this.clock.secondsToMidnight(now)
  }

  private toOffTopicState(strikes: number): OffTopicState {
    return { strikes, blocked: strikes >= this.strikesToBlock }
  }

  async offTopicState(ip: string, now: Date = new Date()): Promise<OffTopicState> {
    return this.toOffTopicState(await this.store.get(this.key('offtopic', ip, now)))
  }

  /** Засчитывает вопрос не по теме; возвращает состояние после него. */
  async registerOffTopicStrike(ip: string, now: Date = new Date()): Promise<OffTopicState> {
    return this.toOffTopicState(await this.store.incr(this.key('offtopic', ip, now), this.ttl(now)))
  }

  private toQuotaState(used: number): QuotaState {
    return { used, remaining: Math.max(0, this.dailyLimit - used), exceeded: used > this.dailyLimit }
  }

  async quotaState(ip: string, now: Date = new Date()): Promise<QuotaState> {
    return this.toQuotaState(await this.store.get(this.key('quota', ip, now)))
  }

  /** Списывает вопрос; `exceeded` — списание вышло за лимит, вопрос отклоняется. */
  async consumeQuestion(ip: string, now: Date = new Date()): Promise<QuotaState> {
    return this.toQuotaState(await this.store.incr(this.key('quota', ip, now), this.ttl(now)))
  }

  /** Возвращает списанный вопрос: модель не ответила или посетитель остановил ответ. */
  async refundQuestion(ip: string, now: Date = new Date()): Promise<void> {
    await this.store.decr(this.key('quota', ip, now))
  }
}
