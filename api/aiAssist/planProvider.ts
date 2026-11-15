/**
 * Клиент плана по дням (#3298): экран ассистента шлёт вопрос с намерением «план» в `POST /ai/plan` службы
 * metravel-assist и получает дни с материалами сайта. Контракт — `scripts/ai-assist/plan.ts`.
 *
 * У плана нет своих состояний ошибки на экране. Любой отказ — сеть, таймаут, `404 no_material` (место не
 * названо или материалов нет), `422 invalid_plan`, `429`, `503`, ответ не по форме — возвращает `null`:
 * экран задаёт тот же вопрос обычному `/ai/ask`, и посетитель видит обычный ответ ассистента. Исключение
 * одно — отмена посетителем (`aborted`): повторять вопрос за него не нужно.
 *
 * Поле `note` ответа экран не читает: фразу о нехватке материалов и подписи дней он строит сам через i18n, а
 * непроверенный текст модели служба посетителю не отдаёт.
 *
 * Личность посетителя запрос не несёт: план собирается из материалов сайта, личный контекст (#3354) в него
 * не входит.
 */

import type { AiSourceType } from './types'

export const PLAN_TIMEOUT_MS = 60_000
/** Больше дней и материалов экран не рисует, что бы ни прислала служба. */
const MAX_DAYS = 7
const MAX_ITEMS_PER_DAY = 8

export type AiTripPlanItem = {
  type: AiSourceType
  source_id: string
  title: string
  /** Абсолютный адрес материала на сайте. */
  url: string
  /** Путь для навигации внутри приложения. */
  path: string
  /** Сколько часов занять материалом — из фактов карточки либо оценка. */
  hours: number
  lat: number | null
  lng: number | null
  cover: string | null
  city: string | null
  country: string | null
}

export type AiTripPlanDay = { items: AiTripPlanItem[] }

export type AiTripPlan = {
  days: AiTripPlanDay[]
  /** Сколько дней просил посетитель: дней в плане меньше — материалов не хватило. */
  daysRequested: number
  /** Кто собрал план: модель с проверкой кодом либо код. */
  assembled: 'model' | 'code'
}

export type PlanRequest = { question: string; locale: string; signal?: AbortSignal }
export type PlanOutcome = { plan: AiTripPlan | null; aborted: boolean }

export interface PlanClient {
  plan(request: PlanRequest): Promise<PlanOutcome>
}

const text = (value: unknown, max: number): string => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const coordinate = (value: unknown, limit: number): number | null => (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit ? value : null)

const pathOf = (url: string, path: unknown): string => {
  const given = text(path, 400)
  if (given.startsWith('/') && !given.startsWith('//')) return given
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}

const toItem = (raw: unknown): AiTripPlanItem | null => {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const type = row.type === 'travel' || row.type === 'quest' ? row.type : null
  const id = typeof row.source_id === 'number' || typeof row.source_id === 'string' ? String(row.source_id).trim() : ''
  const title = text(row.title, 200)
  const url = text(row.url, 400)
  const hours = typeof row.hours === 'number' && Number.isFinite(row.hours) && row.hours > 0 && row.hours <= 24 ? row.hours : null
  if (!type || !/^[1-9]\d*$/.test(id) || !title || !/^https?:\/\//i.test(url) || hours === null) return null
  const path = pathOf(url, row.path)
  if (!path) return null
  return {
    type,
    source_id: id,
    title,
    url,
    path,
    hours,
    lat: coordinate(row.lat, 90),
    lng: coordinate(row.lng, 180),
    cover: text(row.cover, 600) || null,
    city: text(row.city, 120) || null,
    country: text(row.country, 160) || null,
  }
}

/** Ответ службы → план; `null` — тело не по форме либо в плане не осталось ни одного материала. */
export const parseTripPlan = (body: unknown): AiTripPlan | null => {
  if (!body || typeof body !== 'object') return null
  const payload = body as Record<string, unknown>
  if (!Array.isArray(payload.days)) return null
  const seen = new Set<string>()
  const days = payload.days
    .slice(0, MAX_DAYS)
    .map((day): AiTripPlanDay => {
      const rows = day && typeof day === 'object' && Array.isArray((day as { items?: unknown }).items) ? ((day as { items: unknown[] }).items) : []
      const items = rows.flatMap((row) => toItem(row) ?? []).filter((item) => {
        const key = `${item.type}:${item.source_id}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      return { items: items.slice(0, MAX_ITEMS_PER_DAY) }
    })
    .filter((day) => day.items.length > 0)
  if (!days.length) return null
  const requested = typeof payload.days_requested === 'number' && Number.isInteger(payload.days_requested) && payload.days_requested >= 1 ? payload.days_requested : days.length
  return {
    days,
    daysRequested: Math.max(requested, days.length),
    assembled: payload.assembled === 'model' ? 'model' : 'code',
  }
}

export type HttpPlanClientOptions = { fetchImpl?: typeof fetch; timeoutMs?: number }

export class HttpPlanClient implements PlanClient {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  /** `baseUrl` — origin службы без слэша; пустая строка — same-origin (web за Metro/nginx). */
  constructor(baseUrl: string, options: HttpPlanClientOptions = {}) {
    this.baseUrl = String(baseUrl ?? '').trim().replace(/\/+$/, '')
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init))
    this.timeoutMs = options.timeoutMs ?? PLAN_TIMEOUT_MS
  }

  async plan({ question, locale, signal }: PlanRequest): Promise<PlanOutcome> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    const forwardAbort = () => controller.abort()
    if (signal) {
      if (signal.aborted) controller.abort()
      else signal.addEventListener('abort', forwardAbort, { once: true })
    }
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/ai/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ q: question, locale }),
        signal: controller.signal,
      })
      if (!response.ok) return { plan: null, aborted: false }
      return { plan: parseTripPlan(await response.json()), aborted: false }
    } catch {
      // Отмена посетителем — не повод задавать вопрос заново; всё остальное — обычный путь ассистента.
      return { plan: null, aborted: signal?.aborted === true }
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', forwardAbort)
    }
  }
}

export const createPlanClient = (baseUrl: string, options?: HttpPlanClientOptions): PlanClient => new HttpPlanClient(baseUrl, options)
