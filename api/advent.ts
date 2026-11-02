// Серверная часть адвент-календаря (#2867, #2868; бэкенд — #2864, #2865).
//
// Контракт зафиксирован в карточках бэка и в `docs/features/advent-calendar.md`
// → «Данные». Пока бэкенд не выкачен, эндпоинты отвечают 404: это штатное
// состояние «сервер адвента недоступен», а не ошибка экрана. Экран остаётся на
// локальном прогрессе и бандловом конфиге; фейкового успеха нет.

import { apiClient } from '@/api/client'
import { ApiError } from '@/api/clientErrors'
import type { AdventCampaignConfig, AdventProgressSnapshot } from '@/types/advent'
import type { AdventProgressMaps } from '@/utils/advent/adventCalendar'

const ADVENT_TIMEOUT_MS = 10000

/** 404/501 — бэкенд адвента ещё не выкачен; повторять запрос бессмысленно. */
export const isAdventBackendMissing = (error: unknown): boolean =>
  error instanceof ApiError && (error.status === 404 || error.status === 501)

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/

/** `{ day: isoDate }` из ответа; ключи — номера дверец, значения — даты `YYYY-MM-DD`. */
export const normalizeAdventDayMap = (raw: unknown): Record<string, string> => {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  Object.entries(raw as Record<string, unknown>).forEach(([day, value]) => {
    const dayNumber = Number(day)
    if (!Number.isInteger(dayNumber) || dayNumber < 1) return
    if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return
    out[String(dayNumber)] = value.slice(0, 10)
  })
  return out
}

type AdventProgressDto = {
  opened?: unknown
  tasks_done?: unknown
  streak?: unknown
}

export const normalizeAdventProgress = (dto: AdventProgressDto | null | undefined): AdventProgressSnapshot => {
  const streak = Number(dto?.streak)
  return {
    opened: normalizeAdventDayMap(dto?.opened),
    tasksDone: normalizeAdventDayMap(dto?.tasks_done),
    streak: Number.isFinite(streak) && streak > 0 ? Math.floor(streak) : 0,
  }
}

/** Минимальная проверка серверного конфига: иначе экран остаётся на бандловом. */
export const isValidAdventCampaign = (raw: unknown, expectedYear: number): raw is AdventCampaignConfig => {
  if (!raw || typeof raw !== 'object') return false
  const value = raw as Partial<AdventCampaignConfig>
  if (value.year !== expectedYear || typeof value.start !== 'string' || typeof value.end !== 'string') return false
  if (!Array.isArray(value.doors) || value.doors.length === 0) return false
  return value.doors.every(
    (door) =>
      !!door &&
      Number.isInteger(door.day) &&
      typeof door.date === 'string' &&
      ISO_DATE_RE.test(door.date) &&
      typeof door.kind === 'string' &&
      !!door.gift &&
      typeof door.gift.title === 'string' &&
      !!door.task &&
      typeof door.task.type === 'string' &&
      typeof door.task.text === 'string' &&
      !!door.reward &&
      typeof door.reward.xp === 'number',
  )
}

/**
 * Серверный конфиг, прошедший проверку, или `null` — тогда экран остаётся на
 * бандловом. `task.serverCredited` (#2940) — только строгое `true`: любое другое
 * значение означает прежнюю ручную отметку «Сделано».
 */
export const normalizeAdventCampaign = (raw: unknown, expectedYear: number): AdventCampaignConfig | null => {
  if (!isValidAdventCampaign(raw, expectedYear)) return null
  return {
    ...raw,
    doors: raw.doors.map((door) => {
      const { serverCredited, ...task } = door.task
      return { ...door, task: serverCredited === true ? { ...task, serverCredited: true } : task }
    }),
  }
}

/** `GET /api/advent/campaigns/current/` — публичный конфиг в форме `AdventCampaignConfig`. */
export async function fetchAdventCampaign(signal?: AbortSignal): Promise<unknown> {
  return apiClient.get<unknown>('/advent/campaigns/current/', ADVENT_TIMEOUT_MS, { skipAuth: true, signal })
}

/** `GET /api/advent/progress/` — прогресс текущего пользователя. */
export async function fetchAdventProgress(signal?: AbortSignal): Promise<AdventProgressSnapshot> {
  const dto = await apiClient.get<AdventProgressDto>('/advent/progress/', ADVENT_TIMEOUT_MS, { signal })
  return normalizeAdventProgress(dto)
}

/**
 * `POST /api/advent/progress/` — сервер сливает присланное объединением и
 * пересчитывает серию по датам; ответ — итоговый прогресс.
 */
export async function syncAdventProgress(maps: AdventProgressMaps): Promise<AdventProgressSnapshot> {
  const dto = await apiClient.post<AdventProgressDto>(
    '/advent/progress/',
    { opened: maps.opened, tasks_done: maps.tasksDone },
    ADVENT_TIMEOUT_MS,
  )
  return normalizeAdventProgress(dto)
}

export type AdventGuestHandoffPayload = {
  /** Ключ сессии устройства — тот же, что у снимка гостевого квеста (#2739). */
  session_key: string
  /** Та же форма, что у тела `POST /api/advent/progress/`. */
  progress: { opened: Record<string, string>; tasks_done: Record<string, string> }
}

/** Снимок стоит перед отправкой формы регистрации и не должен её тормозить. */
const ADVENT_GUEST_HANDOFF_TIMEOUT_MS = 5000

/**
 * `POST /api/advent/progress/guest-handoff/` (#2939) — гостевой прогресс адвента
 * перед регистрацией по письму; подтверждение переносит его в аккаунт в любом
 * браузере. Анонимный, ответ 204. `skipAuth` — как у квестового снимка: шлёт
 * гость, и 401 до выката бэка не должен запускать auth-invalidation.
 */
export async function sendAdventGuestHandoff(payload: AdventGuestHandoffPayload): Promise<void> {
  await apiClient.request<null>(
    '/advent/progress/guest-handoff/',
    { method: 'POST', body: JSON.stringify(payload), skipAuth: true },
    ADVENT_GUEST_HANDOFF_TIMEOUT_MS,
  )
}

// ── «Итоги года путешественника» (#2865) ────────────────────────────────────

export interface YearInReviewCount {
  count: number
  /** Названия, если сервер отдал список; для числа — пустой массив. */
  names: string[]
}

export interface YearInReview {
  year: number
  countries: YearInReviewCount
  cities: YearInReviewCount
  visitedTravels: number
  publishedTravels: number
  questsCompleted: number
  badgesEarned: number
  longestRouteKm: number
  firstSubscriptionAuthor: string | null
  advent: { opened: number; streak: number; completed: boolean }
}

const toCount = (value: unknown): number => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0
}

const nameOf = (item: unknown): string => {
  if (typeof item === 'string') return item.trim()
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>
    const name = record.name ?? record.title
    return typeof name === 'string' ? name.trim() : ''
  }
  return ''
}

/** Список (`["Беларусь", …]` или `[{name}]`) или число — оба варианта допустимы контрактом. */
const toNamedCount = (value: unknown): YearInReviewCount => {
  if (Array.isArray(value)) {
    const names = value.map(nameOf).filter(Boolean)
    return { count: value.length, names }
  }
  return { count: toCount(value), names: [] }
}

export const normalizeYearInReview = (raw: unknown, year: number): YearInReview => {
  const dto = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const visited = dto.visited && typeof dto.visited === 'object' ? (dto.visited as Record<string, unknown>) : {}
  const advent = dto.advent && typeof dto.advent === 'object' ? (dto.advent as Record<string, unknown>) : {}
  const author = nameOf(dto.first_subscription_author)
  const km = Number(dto.longest_route_km)
  return {
    year: toCount(dto.year) || year,
    countries: toNamedCount(visited.countries),
    cities: toNamedCount(visited.cities),
    visitedTravels: Array.isArray(visited.travels) ? visited.travels.length : toCount(visited.travels),
    publishedTravels: toCount(dto.published_travels),
    questsCompleted: toCount(dto.quests_completed),
    badgesEarned: Array.isArray(dto.badges_earned) ? dto.badges_earned.length : toCount(dto.badges_earned),
    longestRouteKm: Number.isFinite(km) && km > 0 ? Math.round(km) : 0,
    firstSubscriptionAuthor: author || null,
    advent: {
      opened: toCount(advent.opened),
      streak: toCount(advent.streak),
      completed: advent.completed === true,
    },
  }
}

/** Пустой год — все нули: показываем мягкое состояние, а не ошибку. */
export const isYearInReviewEmpty = (value: YearInReview): boolean =>
  value.countries.count === 0 &&
  value.cities.count === 0 &&
  value.visitedTravels === 0 &&
  value.publishedTravels === 0 &&
  value.questsCompleted === 0 &&
  value.badgesEarned === 0 &&
  value.longestRouteKm === 0

/** `GET /api/advent/year-in-review/?year=YYYY` — личные итоги года (авторизованный). */
export async function fetchYearInReview(year: number, signal?: AbortSignal): Promise<YearInReview> {
  const raw = await apiClient.get<unknown>(
    `/advent/year-in-review/?year=${encodeURIComponent(String(year))}`,
    ADVENT_TIMEOUT_MS,
    { signal },
  )
  return normalizeYearInReview(raw, year)
}
