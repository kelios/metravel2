import AsyncStorage from '@react-native-async-storage/async-storage'

import type { RoutePoint } from '@/api/plannedTrips'
import { isValidCoordinate } from '@/utils/coordinates'
import { MAX_ROUTE_DAY } from '@/utils/routePointDay'

/**
 * Черновик маршрута для формы новой поездки (#3298, #3416 п.1) — общий приём точек.
 *
 * Форма `/trips/plan/create` создаёт поездку без маршрута: точки добавлялись только внутри уже созданной
 * поездки. Теперь вход в форму может принести точки с собой, и после создания поездки они сохраняются её
 * маршрутом тем же запросом, что у конструктора (`updateTripRoute`). Источников два:
 *
 *   - **план ассистента** — несколько точек по дням. В адрес формы он не помещается (длина) и не должен
 *     там лежать (вопрос посетителя попал бы в историю браузера и журналы): черновик кладётся в
 *     `AsyncStorage`, в адресе — только его короткий идентификатор `draft`. Запись одна, живёт сутки,
 *     переживает вход гостя с возвратом в форму и удаляется после создания поездки;
 *   - **одна точка материала** (квест из ответа ассистента) — координаты помещаются в параметр
 *     `sourcePoint=<lat>,<lng>`; название точки — название материала из тех же параметров ссылки.
 *
 * У точки маршрута есть день (`dayNumber`, #1845), поэтому разбивка плана по дням сохраняется в самом
 * маршруте; текст по дням дублируется в описании поездки — его видно до создания.
 */
export const TRIP_PLAN_DRAFT_KEY = 'metravel:tripPlanDraft'
export const TRIP_PLAN_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000
export const TRIP_PLAN_DRAFT_MAX_POINTS = 40
/** Значение параметра `source` формы для входа с черновиком плана. */
export const TRIP_PLAN_DRAFT_SOURCE = 'plan'

export type TripPlanDraftPoint = {
  /** Материал сайта, из которого точка: статья — «Место» с привязкой, квест — обычная точка. */
  type: 'travel' | 'quest'
  sourceId?: number | null
  title: string
  lat: number
  lng: number
  /** День плана, с единицы; нет — точка без дня. */
  day?: number | null
  /** Короткая подпись точки: адрес материала или время на него. */
  note?: string | null
}

export type TripPlanDraft = {
  id: string
  title: string
  description: string
  /** Сколько дней в плане — по нему форма ставит дату окончания. */
  days: number
  points: TripPlanDraftPoint[]
  createdAt: number
  /** Кто сохранил: id вошедшего пользователя; `null` — гость (так же читаются записи без поля). */
  owner: string | null
}

export type TripPlanDraftInput = Omit<TripPlanDraft, 'id' | 'createdAt' | 'owner'>

const clip = (value: unknown, max: number): string => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

/** Точка из недоверенного источника (хранилище, параметры адреса): `null` — без названия или координат. */
export const cleanDraftPoint = (raw: unknown): TripPlanDraftPoint | null => {
  if (!raw || typeof raw !== 'object') return null
  const point = raw as Partial<TripPlanDraftPoint>
  const title = clip(point.title, 160)
  const lat = Number(point.lat)
  const lng = Number(point.lng)
  if (!title || !isValidCoordinate(lat, lng)) return null
  const day = Number(point.day)
  const sourceId = Number(point.sourceId)
  return {
    type: point.type === 'travel' ? 'travel' : 'quest',
    sourceId: Number.isInteger(sourceId) && sourceId > 0 ? sourceId : null,
    title,
    lat,
    lng,
    day: Number.isInteger(day) && day >= 1 && day <= MAX_ROUTE_DAY ? day : null,
    note: clip(point.note, 240) || null,
  }
}

const cleanDraft = (raw: unknown): TripPlanDraft | null => {
  if (!raw || typeof raw !== 'object') return null
  const draft = raw as Partial<TripPlanDraft>
  const points = (Array.isArray(draft.points) ? draft.points : []).flatMap((point) => cleanDraftPoint(point) ?? []).slice(0, TRIP_PLAN_DRAFT_MAX_POINTS)
  if (typeof draft.id !== 'string' || !/^[a-z0-9]{6,24}$/.test(draft.id) || typeof draft.createdAt !== 'number' || !points.length) return null
  const days = Number(draft.days)
  return {
    id: draft.id,
    title: clip(draft.title, 96),
    description: String(draft.description ?? '').trim().slice(0, 2000),
    days: Number.isInteger(days) && days >= 1 && days <= MAX_ROUTE_DAY ? days : 1,
    points,
    createdAt: draft.createdAt,
    owner: typeof draft.owner === 'string' && draft.owner ? draft.owner : null,
  }
}

const makeDraftId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

/**
 * Сохраняет черновик и возвращает его идентификатор; `null` — точек нет либо хранилище недоступно.
 * `owner` — id вошедшего пользователя; `null` — гость.
 */
export const saveTripPlanDraft = async (input: TripPlanDraftInput, owner: string | null = null): Promise<string | null> => {
  const draft = cleanDraft({ ...input, id: makeDraftId(), createdAt: Date.now(), owner })
  if (!draft) return null
  try {
    await AsyncStorage.setItem(TRIP_PLAN_DRAFT_KEY, JSON.stringify(draft))
    return draft.id
  } catch {
    return null
  }
}

/**
 * Черновик по идентификатору из адреса формы; `null` — нет, другой, испорчен или старше суток.
 * `viewer` — id вошедшего пользователя, `null` — гость. Гостевой черновик принимается всеми (гость входит и
 * возвращается к нему); черновик вошедшего — только им самим, для остальных он удаляется.
 */
export const loadTripPlanDraft = async (
  id: string | null | undefined,
  viewer: string | null = null,
  maxAgeMs: number = TRIP_PLAN_DRAFT_MAX_AGE_MS,
): Promise<TripPlanDraft | null> => {
  if (!id) return null
  try {
    const raw = await AsyncStorage.getItem(TRIP_PLAN_DRAFT_KEY)
    const draft = raw ? cleanDraft(JSON.parse(raw)) : null
    if (!draft || draft.id !== id) return null
    if (Date.now() - draft.createdAt > maxAgeMs || (draft.owner !== null && draft.owner !== viewer)) {
      await AsyncStorage.removeItem(TRIP_PLAN_DRAFT_KEY)
      return null
    }
    return draft
  } catch {
    return null
  }
}

/** Удаляет черновик после создания поездки; чужой идентификатор запись не трогает. */
export const clearTripPlanDraft = async (id: string | null | undefined): Promise<void> => {
  if (!id) return
  try {
    const raw = await AsyncStorage.getItem(TRIP_PLAN_DRAFT_KEY)
    if (raw && (JSON.parse(raw) as { id?: unknown }).id === id) await AsyncStorage.removeItem(TRIP_PLAN_DRAFT_KEY)
  } catch {
    // Best effort: устаревшая запись сама перестанет читаться через сутки.
  }
}

/** Адрес формы новой поездки с черновиком: в адресе только идентификатор. */
export const buildTripPlanDraftHref = (id: string): string => `/trips/plan/create?${new URLSearchParams({ source: TRIP_PLAN_DRAFT_SOURCE, draft: id }).toString()}`

/** Координаты одной точки материала для параметра `sourcePoint`; кривые координаты — пустая строка. */
export const formatSourcePoint = (lat: number | null | undefined, lng: number | null | undefined): string => {
  const [latitude, longitude] = [Number(lat), Number(lng)]
  if (lat === null || lat === undefined || lng === null || lng === undefined || !isValidCoordinate(latitude, longitude)) return ''
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`
}

/** Разбор параметра `sourcePoint=<lat>,<lng>`; не координаты — `null`. */
export const parseSourcePoint = (value: string | string[] | undefined): { lat: number; lng: number } | null => {
  const raw = Array.isArray(value) ? value[0] : value
  const match = /^\s*(-?\d{1,2}(?:\.\d{1,7})?),(-?\d{1,3}(?:\.\d{1,7})?)\s*$/.exec(String(raw ?? ''))
  if (!match) return null
  const [lat, lng] = [Number(match[1]), Number(match[2])]
  return isValidCoordinate(lat, lng) ? { lat, lng } : null
}

/**
 * Точки черновика → точки маршрута поездки в порядке дней. Статья — «Место» с привязкой `placeId`, квест —
 * обычная точка (в домене точки квеста нет), как у блока «Рядом с маршрутом».
 */
export const draftRoutePoints = (points: readonly TripPlanDraftPoint[]): RoutePoint[] =>
  points.map((point, index) => ({
    id: `draft-${point.type}-${point.sourceId ?? index}-${index}`,
    type: point.type === 'travel' ? 'place' : 'custom',
    name: point.title,
    description: point.note ?? null,
    coordinates: [point.lng, point.lat],
    placeId: point.type === 'travel' && point.sourceId ? point.sourceId : null,
    dayNumber: point.day ?? null,
  }))
