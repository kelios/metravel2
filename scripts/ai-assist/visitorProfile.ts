/**
 * Личный контекст посетителя для `/ai/ask` (#3354): сводка его статей, отметок, избранного и поездок.
 *
 * Личность берётся только из ответа API сайта на запрос с токеном самого посетителя — `GET /api/user/me/`.
 * Идентификатор пользователя из тела или параметров запроса к службе не читается нигде: чужой id в запросе
 * ничего не даёт, потому что его некому прочитать.
 *
 * Откуда токен: заголовок `Authorization: Token …` (приложения) либо cookie сессии сайта (web: там токен
 * лежит в HttpOnly-cookie, скрипту страницы он недоступен, а запрос к `/ai/ask` того же origin несёт его сам).
 * Служба токен не разбирает и не хранит: в памяти остаётся только `sha256(токен)` → пользователь и сводка
 * на несколько минут. Токен уходит только на `BACKEND_URL`, только методом GET и без перенаправлений.
 *
 * Любой отказ — нет токена, 401/403, ошибка, таймаут, непонятный ответ — значит «гость»: вопрос отвечается
 * как раньше, без 5xx. Общий бюджет на сбор сводки — `timeoutMs`; запросы после «кто я» идут параллельно.
 * В журнал службы попадает только имя запроса и код ответа: ни токена, ни id, ни содержимого сводки.
 */
import { createHash } from 'node:crypto'
import type http from 'node:http'

import { cleanVisitorText, hasVisitorData, type VisitorContext, type VisitorPlace, type VisitorTrip } from '../../api/aiAssist/visitorContext.ts'

export const DEFAULT_PROFILE_TIMEOUT_MS = 1800
export const DEFAULT_PROFILE_TTL_SECONDS = 240
export const DEFAULT_PROFILE_CACHE_SIZE = 500
export const DEFAULT_AUTH_COOKIE = 'authToken'
/** Сколько своих статей читается для стран и понижения в подборе. */
export const OWN_TRAVELS_PAGE = 50
/** Потолок одного ответа API: поездки несут геометрию маршрута (замер 15.11.2026 — 71 КБ на три поездки). */
export const MAX_PROFILE_RESPONSE_BYTES = 2 * 1024 * 1024
const MAX_PLACES = 30
const MAX_TITLE_CHARS = 200
/** Ключ DRF — 40 шестнадцатеричных знаков; шире — на случай смены формата, но без пробелов и разделителей заголовка. */
const TOKEN_RE = /^[A-Za-z0-9._~+/=-]{16,256}$/

export interface VisitorProfileOptions {
  /** База API сайта (`BACKEND_URL`) — единственный адрес, куда уходит токен. */
  backendUrl: string
  timeoutMs?: number
  ttlSeconds?: number
  capacity?: number
  /** Имя cookie сессии сайта (`AUTH_TOKEN_COOKIE_NAME` бэкенда). */
  cookieName?: string
  fetchImpl?: typeof fetch
  now?: () => number
  log?: (line: string) => void
}

export interface VisitorProfile {
  /** Сводка посетителя этого запроса либо `null` — гость. Не бросает. */
  resolve: (request: Pick<http.IncomingMessage, 'headers'>) => Promise<VisitorContext | null>
  stats: () => { size: number; hits: number; misses: number }
}

const headerValue = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? '') : (value ?? ''))

/** Токен посетителя из запроса: заголовок `Authorization: Token …`, иначе cookie сессии. Нет или не похож на токен — `null`. */
export function readVisitorToken(headers: http.IncomingHttpHeaders, cookieName: string = DEFAULT_AUTH_COOKIE): string | null {
  const authorization = /^Token\s+(\S+)\s*$/i.exec(headerValue(headers.authorization).trim())
  if (authorization) return TOKEN_RE.test(authorization[1]) ? authorization[1] : null
  for (const pair of headerValue(headers.cookie).split(';')) {
    const at = pair.indexOf('=')
    if (at < 0 || pair.slice(0, at).trim() !== cookieName) continue
    let value = pair.slice(at + 1).trim().replace(/^"|"$/g, '')
    try {
      value = decodeURIComponent(value)
    } catch {
      return null
    }
    return TOKEN_RE.test(value) ? value : null
  }
  return null
}

export const tokenHash = (token: string): string => createHash('sha256').update(token).digest('hex')

/**
 * База API без шифрования и вне своей сети — токен посетителя шёл бы к ней открытым текстом. Петля, частные
 * диапазоны и имя без точки (контейнер соседней службы) считаются своей сетью.
 */
export const isPlainPublicBackend = (backendUrl: string): boolean => {
  let url: URL
  try {
    url = new URL(backendUrl)
  } catch {
    return false
  }
  if (url.protocol !== 'http:') return false
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const ownNetwork = host === 'localhost' || host === '::1' || !host.includes('.') || /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)
  return !ownNetwork
}

class ProfileRequestError extends Error {
  constructor(name: string, reason: string) {
    super(`${name}: ${reason}`)
  }
}

type Json = Record<string, unknown>
const asObject = (value: unknown): Json | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null)
const rowsOf = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload
  const object = asObject(payload)
  for (const key of ['results', 'data', 'items']) if (Array.isArray(object?.[key])) return object[key] as unknown[]
  return []
}
const positiveId = (value: unknown): number | null => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}
const dateOf = (value: unknown): string | null => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null)

const placeOf = (travel: unknown, fallbackId?: unknown, date?: unknown): VisitorPlace | null => {
  const row = asObject(travel)
  const id = positiveId(row?.id ?? fallbackId)
  const title = cleanVisitorText(row?.name ?? row?.title, MAX_TITLE_CHARS)
  if (id === null || !title) return null
  const country = cleanVisitorText(row?.countryName, 60)
  return { id, title, ...(country ? { country } : {}), ...(dateOf(date) ? { date: dateOf(date) } : {}) }
}

/** Страны собственных статей по убыванию числа статей; поле `countryName` бывает перечнем через запятую. */
const countriesOf = (rows: readonly unknown[]): string[] => {
  const counts = new Map<string, number>()
  for (const row of rows) {
    for (const name of String(asObject(row)?.countryName ?? '').split(',')) {
      const country = cleanVisitorText(name, 60)
      if (country) counts.set(country, (counts.get(country) ?? 0) + 1)
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([country]) => country)
}

/** Сводка из четырёх ответов API. Чистая функция: форма ответов сверена замером 15.11.2026 (`docs/features/ai-assistant.md`). */
export function buildVisitorContext(payloads: { statuses: unknown; favorites: unknown; trips: unknown; own: unknown }): VisitorContext {
  const context: VisitorContext = { own: { count: 0, countries: [], ids: [] }, visited: [], wishlist: [], planned: [], favorites: [], trips: [] }
  for (const entry of rowsOf(payloads.statuses)) {
    const row = asObject(entry)
    const status = row?.status
    if (status !== 'visited' && status !== 'wishlist' && status !== 'planned') continue
    const place = placeOf(row?.travel, row?.travel_id, status === 'planned' ? row?.planned_date : status === 'visited' ? row?.visited_date : null)
    if (place && context[status].length < MAX_PLACES) context[status].push(place)
  }
  for (const entry of rowsOf(payloads.favorites)) {
    const place = placeOf(entry)
    if (place && context.favorites.length < MAX_PLACES) context.favorites.push(place)
  }
  for (const entry of rowsOf(payloads.trips)) {
    const row = asObject(entry)
    const place = cleanVisitorText(row?.start_point_name, 60)
    const start = dateOf(row?.start_date)
    if (!place || !start || context.trips.length >= MAX_PLACES) continue
    const trip: VisitorTrip = { place, start, ...(dateOf(row?.end_date) ? { end: dateOf(row?.end_date) } : {}) }
    context.trips.push(trip)
  }
  const own = rowsOf(payloads.own)
  const ids = own.map((row) => positiveId(asObject(row)?.id)).filter((id): id is number => id !== null)
  const total = Number(asObject(payloads.own)?.count ?? asObject(payloads.own)?.total)
  context.own = { count: Number.isFinite(total) && total >= ids.length ? total : ids.length, countries: countriesOf(own), ids }
  return context
}

interface Owner {
  userId: number
  expiresAt: number
}
interface Summary {
  context: VisitorContext | null
  expiresAt: number
}

export function createVisitorProfile(options: VisitorProfileOptions): VisitorProfile {
  const backendUrl = options.backendUrl.replace(/\/+$/, '')
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROFILE_TIMEOUT_MS
  const ttlMs = (options.ttlSeconds ?? DEFAULT_PROFILE_TTL_SECONDS) * 1000
  const capacity = Math.max(1, options.capacity ?? DEFAULT_PROFILE_CACHE_SIZE)
  const cookieName = options.cookieName || DEFAULT_AUTH_COOKIE
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init))
  const now = options.now ?? (() => Date.now())
  const log = options.log ?? (() => {})

  // Ключ первой карты — sha256(токен); ключ сводки включает id пользователя из ответа API: сводка
  // достаётся только по паре «этот токен → этот пользователь», чужую по своему токену получить нельзя.
  const owners = new Map<string, Owner>()
  const summaries = new Map<string, Summary>()
  const pending = new Map<string, Promise<VisitorContext | null>>()
  let hits = 0
  let misses = 0

  const summaryKey = (userId: number, hash: string): string => `${userId}:${hash}`

  const forget = (hash: string) => {
    const owner = owners.get(hash)
    if (owner) summaries.delete(summaryKey(owner.userId, hash))
    owners.delete(hash)
  }

  const remember = (hash: string, userId: number, context: VisitorContext | null) => {
    forget(hash)
    const expiresAt = now() + ttlMs
    owners.set(hash, { userId, expiresAt })
    summaries.set(summaryKey(userId, hash), { context, expiresAt })
    // Вытеснение: сначала просроченные, затем самые старые (Map хранит порядок вставки).
    if (owners.size > capacity) for (const [key, owner] of owners) if (owner.expiresAt <= now()) forget(key)
    while (owners.size > capacity) {
      const oldest = owners.keys().next().value
      if (oldest === undefined) break
      forget(oldest)
    }
  }

  const cached = (hash: string): { context: VisitorContext | null } | null => {
    const owner = owners.get(hash)
    if (!owner) return null
    const summary = summaries.get(summaryKey(owner.userId, hash))
    if (!summary || owner.expiresAt <= now() || summary.expiresAt <= now()) {
      forget(hash)
      return null
    }
    return { context: summary.context }
  }

  /** GET к API сайта. Токен — только в заголовке и только у запросов, которым он нужен; перенаправление — отказ. */
  const get = async (name: string, path: string, token: string | null, signal: AbortSignal): Promise<unknown> => {
    let response: Response
    try {
      response = await fetchImpl(`${backendUrl}${path}`, {
        method: 'GET',
        headers: { accept: 'application/json', ...(token ? { authorization: `Token ${token}` } : {}) },
        redirect: 'error',
        signal,
      })
    } catch (error) {
      // Текст сетевой ошибки адреса с токеном не несёт (токен — в заголовке), но в журнал идёт только её вид.
      throw new ProfileRequestError(name, signal.aborted ? 'таймаут' : `сеть (${error instanceof Error ? error.name : 'ошибка'})`)
    }
    if (!response.ok) throw new ProfileRequestError(name, `HTTP ${response.status}`)
    const declared = Number(response.headers?.get?.('content-length'))
    if (Number.isFinite(declared) && declared > MAX_PROFILE_RESPONSE_BYTES) throw new ProfileRequestError(name, 'ответ больше потолка')
    const text = await response.text()
    if (text.length > MAX_PROFILE_RESPONSE_BYTES) throw new ProfileRequestError(name, 'ответ больше потолка')
    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new ProfileRequestError(name, 'ответ не JSON')
    }
  }

  const load = async (token: string, hash: string): Promise<VisitorContext | null> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const userId = positiveId(asObject(await get('me', '/api/user/me/', token, controller.signal))?.id)
      if (userId === null) throw new ProfileRequestError('me', 'в ответе нет id')
      const where = encodeURIComponent(JSON.stringify({ user_id: userId, publish: 1, moderation: 1 }))
      const [statuses, favorites, trips, own] = await Promise.all([
        get('statuses', `/api/user/${userId}/travel-statuses/`, token, controller.signal),
        get('favorites', `/api/user/${userId}/favorite-travels/`, token, controller.signal),
        get('trips', '/api/trips/planned/me/', token, controller.signal),
        // Опубликованные статьи — открытый каталог: токен этому запросу не нужен и не отправляется.
        get('own', `/api/travels/?page=1&perPage=${OWN_TRAVELS_PAGE}&where=${where}`, null, controller.signal),
      ])
      const context = buildVisitorContext({ statuses, favorites, trips, own })
      // Вошедший без статей, отметок и поездок: учитывать нечего — ход идёт как у гостя, но запросы не повторяются.
      const useful = hasVisitorData(context) ? context : null
      remember(hash, userId, useful)
      return useful
    } catch (error) {
      controller.abort()
      log(`профиль посетителя: ответ как гостю — ${error instanceof ProfileRequestError ? error.message : 'ошибка разбора ответа'}`)
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    async resolve(request) {
      try {
        const token = readVisitorToken(request.headers, cookieName)
        if (!token) return null
        const hash = tokenHash(token)
        const hit = cached(hash)
        if (hit) {
          hits += 1
          return hit.context
        }
        misses += 1
        // Два вопроса подряд с одним токеном ждут один сбор сводки.
        let running = pending.get(hash)
        if (!running) {
          running = load(token, hash).finally(() => pending.delete(hash))
          pending.set(hash, running)
        }
        return await running
      } catch {
        return null
      }
    },
    stats: () => ({ size: owners.size, hits, misses }),
  }
}
