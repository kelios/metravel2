// FE-ARCH D1 #994 — travelStatus мигрирован с Zustand на React Query.
// Этот модуль остаётся домашним для чистых хелперов/нормализации/типов (их
// импортируют ~14 файлов), но состояние entries живёт в RQ-кэше
// queryKeys.travelStatus(userId) + persistQueryClient (whitelist 'travel-status',
// #1015) вместо Zustand-стора и ручного AsyncStorage-ключа.
import { useQuery } from '@tanstack/react-query'
import { devError, devWarn } from '@/utils/logger'
import { buildTravelMonthFallbackDate } from '@/utils/travelCalendarDate'
import { useAuth } from '@/context/AuthContext'
import { queryKeys } from '@/api/queryKeys'
import { getActiveQueryClient } from '@/api/activeQueryClient'
import { translate as i18nT } from '@/i18n'


const getUserApi = async () => import('@/api/user')
const getTravelUserApi = async () => import('@/api/travelUserQueries')

export type TravelStatus = 'visited' | 'planned' | 'wishlist'

// Статус модерации авторского путешествия для бейджа в календаре.
// Опубликованные (publish=1 & moderation=1) бейджа не получают → undefined.
export type TravelModerationState = 'draft' | 'pending'

export type TravelStatusEntry = {
  id: string | number
  type: 'travel'
  title: string
  imageUrl?: string
  url: string
  country?: string
  city?: string
  status: TravelStatus
  plannedDate?: string  // ISO "YYYY-MM-DD", опционально для status === 'planned'
  visitedDate?: string  // ISO "YYYY-MM-DD", опционально для status === 'visited'
  wishlistDate?: string // ISO "YYYY-MM-DD", опционально для status === 'wishlist'
  travelYear?: string
  travelMonth?: string | string[]
  travelMonthName?: string
  moderationState?: TravelModerationState // черновик / на модерации; опубликованные — undefined
  addedAt: number       // timestamp
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (value == null) return undefined
  const text = String(value).trim()
  if (!text || text === 'null' || text === 'undefined') return undefined
  return text
}

const normalizeTravelMonthItem = (value: unknown): string | undefined => {
  if (isRecord(value)) {
    return normalizeTravelMonthItem(value.id ?? value.value ?? value.month ?? value.name ?? value.title)
  }
  return normalizeOptionalString(value)
}

const normalizeTravelMonth = (value: unknown): string | string[] | undefined => {
  if (Array.isArray(value)) {
    const items = value
      .map(normalizeTravelMonthItem)
      .filter((item): item is string => Boolean(item))
    return items.length > 0 ? items : undefined
  }
  return normalizeTravelMonthItem(value)
}

const normalizeTravelId = (value: unknown): string | number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const text = value.trim()
    const numeric = Number(text)
    return Number.isInteger(numeric) && String(numeric) === text ? numeric : text
  }
  return undefined
}

const normalizeTravelUrl = (item: Record<string, unknown>, id: string | number): string => {
  const rawUrl = normalizeOptionalString(item.url ?? item.urlTravel ?? item.href)
  const rawSlug = normalizeOptionalString(item.slug)
  if (rawUrl) {
    const cleanUrl = rawUrl.split('?')[0]?.split('#')[0] || rawUrl
    if (cleanUrl.includes('/travels/')) return cleanUrl
    if (cleanUrl.startsWith('/')) return cleanUrl
  }
  return rawSlug ? `/travels/${rawSlug}` : `/travels/${String(id)}`
}

const getStatusDateField = (status: TravelStatus): 'visitedDate' | 'plannedDate' | 'wishlistDate' =>
  status === 'visited' ? 'visitedDate' : status === 'wishlist' ? 'wishlistDate' : 'plannedDate'

// Локальная «сегодня» в формате ISO YYYY-MM-DD — сравнивается лексикографически.
const getTodayIsoDate = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Статус авторского путешествия выводится из даты: прошлое → «Был»,
// сегодня/будущее или дата не определена → «Планирую».
export const deriveAuthoredTravelStatus = (calendarDate: string | undefined): TravelStatus => {
  if (!parseTravelStatusDateParts(calendarDate)) return 'planned'
  return (calendarDate as string) < getTodayIsoDate() ? 'visited' : 'planned'
}

const toModerationFlag = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase()
    return text === '1' || text === 'true'
  }
  return false
}

// Бейдж модерации ставим только когда поле присутствует и явно «не готово».
// Отсутствие поля трактуем как опубликованное — иначе рискуем пометить черновиком всё.
const resolveModerationState = (item: Record<string, unknown>): TravelModerationState | undefined => {
  if ('publish' in item && !toModerationFlag(item.publish)) return 'draft'
  if ('moderation' in item && !toModerationFlag(item.moderation)) return 'pending'
  return undefined
}


const normalizeAuthoredTravelEntry = (item: unknown): TravelStatusEntry | null => {
  if (!isRecord(item)) return null
  const id = normalizeTravelId(item.id ?? item.travel_id ?? item._id)
  if (id === undefined) return null

  const title = normalizeOptionalString(item.name ?? item.title) ?? i18nT('errorsStatic:stores.travelStatus.titleFallback', { id: String(id) })
  const imageUrl = normalizeOptionalString(
    item.travel_image_thumb_url ??
      item.travel_image_thumb_small_url ??
      item.travelImageThumbUrl ??
      item.travelImageThumbSmallUrl ??
      item.imageUrl
  )
  const explicitDate = normalizeOptionalString(item.visitedDate ?? item.visited_date)
  const travelYear = normalizeOptionalString(item.year)
  const travelMonth = normalizeTravelMonth(item.month)
  const travelMonthName = normalizeOptionalString(item.monthName ?? item.month_name)

  // Эффективная дата = явная дата ИЛИ вычисленная из года/месяца (выходные).
  // По ней определяем статус (прошлое → «Был», будущее → «Планирую»).
  const calendarDate = parseTravelStatusDateParts(explicitDate)
    ? explicitDate
    : buildTravelMonthFallbackDate({
        year: travelYear,
        month: travelMonth,
        monthName: travelMonthName,
        seed: id,
        allowYearOnly: true,
      })
  const status = deriveAuthoredTravelStatus(calendarDate)

  return normalizeStatusDates({
    id,
    type: 'travel' as const,
    title,
    url: normalizeTravelUrl(item, id),
    status,
    addedAt: parseServerTimestamp(item.updated_at ?? item.created_at),
    imageUrl,
    country: normalizeOptionalString(item.countryName ?? item.country_name ?? item.country),
    city: normalizeOptionalString(item.cityName ?? item.city_name ?? item.city),
    // Явную дату кладём в поле, соответствующее выведенному статусу, иначе
    // normalizeStatusDates её обнулит; fallback по году/месяцу остаётся derived.
    [getStatusDateField(status)]: explicitDate,
    travelYear,
    travelMonth,
    travelMonthName,
    moderationState: resolveModerationState(item),
  })
}

export const parseTravelStatusDateParts = (value: unknown): { year: number; month: number; day: number } | null => {
  if (typeof value !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12) return null
  const maxDay = new Date(year, month, 0).getDate()
  if (day < 1 || day > maxDay) return null
  return { year, month, day }
}

export const getTravelStatusCalendarDate = (
  entry: Pick<
    TravelStatusEntry,
    'id' | 'status' | 'plannedDate' | 'visitedDate' | 'wishlistDate' | 'travelYear' | 'travelMonth' | 'travelMonthName'
  >,
  occupiedDates?: Set<string> | string[]
): string | undefined => {
  const value =
    entry.status === 'planned'
      ? entry.plannedDate
      : entry.status === 'visited'
        ? entry.visitedDate
        : entry.wishlistDate

  if (parseTravelStatusDateParts(value)) return value
  return buildTravelMonthFallbackDate({
    year: entry.travelYear,
    month: entry.travelMonth,
    monthName: entry.travelMonthName,
    seed: entry.id,
    occupiedDates,
    allowYearOnly: true,
  })
}

const normalizeStatusDates = <T extends { status: TravelStatus; plannedDate?: string; visitedDate?: string; wishlistDate?: string }>(entry: T): T => {
  const plannedDate = entry.status === 'planned' && parseTravelStatusDateParts(entry.plannedDate)
    ? entry.plannedDate
    : undefined
  const visitedDate = entry.status === 'visited' && parseTravelStatusDateParts(entry.visitedDate)
    ? entry.visitedDate
    : undefined
  const wishlistDate = entry.status === 'wishlist' && parseTravelStatusDateParts(entry.wishlistDate)
    ? entry.wishlistDate
    : undefined

  return {
    ...entry,
    plannedDate,
    visitedDate,
    wishlistDate,
  }
}

const parseServerTimestamp = (value: unknown): number => {
  if (typeof value !== 'string') return Date.now()
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : Date.now()
}

const normalizeServerStatusEntry = (item: unknown): TravelStatusEntry | null => {
  if (!isRecord(item)) return null
  const status = item.status
  const travel = isRecord(item.travel) ? item.travel : {}
  const travelId = item.travel_id ?? travel.id
  const title = typeof travel.name === 'string' && travel.name.trim()
    ? travel.name.trim()
    : i18nT('shared:stores.travelStatusStore.puteshestvie_value1_a99c3208', { value1: String(travelId ?? '').trim() })
  const url = typeof travel.url === 'string' && travel.url.trim()
    ? travel.url.trim()
    : typeof travel.slug === 'string' && travel.slug.trim()
      ? `/travels/${travel.slug.trim()}`
      : travelId != null
        ? `/travels/${String(travelId)}`
        : ''

  if (
    (typeof travelId !== 'string' && typeof travelId !== 'number') ||
    (status !== 'visited' && status !== 'planned' && status !== 'wishlist') ||
    !url
  ) {
    return null
  }

  return normalizeStatusDates({
    id: travelId,
    type: 'travel' as const,
    title,
    url,
    status,
    addedAt: parseServerTimestamp(item.added_at),
    imageUrl: typeof travel.travel_image_thumb_url === 'string' ? travel.travel_image_thumb_url : undefined,
    country: typeof travel.countryName === 'string' ? travel.countryName : undefined,
    plannedDate: typeof item.planned_date === 'string' ? item.planned_date : undefined,
    visitedDate: typeof item.visited_date === 'string' ? item.visited_date : undefined,
    travelYear: normalizeOptionalString(travel.year),
    travelMonth: normalizeTravelMonth(travel.month),
    travelMonthName: normalizeOptionalString(travel.monthName ?? travel.month_name),
    moderationState: resolveModerationState(travel),
  })
}

const mergeStatusAndAuthoredEntries = (
  explicitEntries: TravelStatusEntry[],
  authoredEntries: TravelStatusEntry[]
): TravelStatusEntry[] => {
  const authoredById = new Map<string, TravelStatusEntry>()
  authoredEntries.forEach((entry) => {
    authoredById.set(String(entry.id), entry)
  })

  const mergedById = new Map<string, TravelStatusEntry>()
  explicitEntries.forEach((entry) => {
    const authored = authoredById.get(String(entry.id))
    mergedById.set(String(entry.id), authored ? {
      ...authored,
      ...entry,
      title: entry.title || authored.title,
      url: entry.url || authored.url,
      imageUrl: entry.imageUrl ?? authored.imageUrl,
      country: entry.country ?? authored.country,
      city: entry.city ?? authored.city,
      travelYear: entry.travelYear ?? authored.travelYear,
      travelMonth: entry.travelMonth ?? authored.travelMonth,
      travelMonthName: entry.travelMonthName ?? authored.travelMonthName,
      moderationState: entry.moderationState ?? authored.moderationState,
    } : entry)
  })

  authoredEntries.forEach((entry) => {
    const key = String(entry.id)
    if (!mergedById.has(key)) {
      mergedById.set(key, entry)
    }
  })

  return Array.from(mergedById.values())
}

const fetchAuthoredTravelStatusEntries = async (userId: string | number): Promise<TravelStatusEntry[]> => {
  const { fetchMyTravels, unwrapMyTravelsPayload } = await getTravelUserApi()
  const payload = await fetchMyTravels({
    user_id: userId,
    page: 1,
    perPage: 9999,
    includeDrafts: true,
    throwOnError: true,
  })
  const { items } = unwrapMyTravelsPayload(payload)
  return items
    .map(normalizeAuthoredTravelEntry)
    .filter((item): item is TravelStatusEntry => item !== null)
}

const getNumericTravelId = (id: string | number): number => {
  const travelId = Number(id)
  if (!Number.isInteger(travelId) || travelId <= 0) {
    throw new Error('INVALID_TRAVEL_ID')
  }
  return travelId
}

const syncStatusToServer = async (entry: TravelStatusEntry, userId: string | null): Promise<void> => {
  if (!userId) return

  const { upsertUserTravelStatus } = await getUserApi()
  await upsertUserTravelStatus(userId, {
    travel_id: getNumericTravelId(entry.id),
    status: entry.status,
    planned_date: entry.status === 'planned' ? entry.plannedDate ?? null : null,
    visited_date: entry.status === 'visited' ? entry.visitedDate ?? null : null,
  })
}

const syncRemoveStatusFromServer = async (id: string | number, userId: string | null): Promise<void> => {
  if (!userId) return

  const { deleteUserTravelStatus } = await getUserApi()
  await deleteUserTravelStatus(userId, getNumericTravelId(id))
}

// ===== React Query state (#994) =====
// Единый источник — RQ-кэш queryKeys.travelStatus(userId). Ключ scoped по userId
// даёт identity-isolation бесплатно (смена пользователя = другой ключ, старый
// серверный ответ не затирает актуальные записи). persistQueryClient (#1015)
// держит офлайн вместо ручного AsyncStorage-ключа.

const EMPTY_ENTRIES: TravelStatusEntry[] = []

const readEntries = (userId: string | null): TravelStatusEntry[] =>
  getActiveQueryClient()?.getQueryData<TravelStatusEntry[]>(queryKeys.travelStatus(userId)) ?? []

const writeEntries = (userId: string | null, entries: TravelStatusEntry[]): void => {
  getActiveQueryClient()?.setQueryData(queryKeys.travelStatus(userId), entries)
}

/** Реактивное чтение статусов текущего пользователя (гость = null отдельный ключ). */
export function useTravelStatus(): TravelStatusEntry[] {
  const { userId } = useAuth()
  const scopedUserId = userId ?? null
  const { data } = useQuery({
    queryKey: queryKeys.travelStatus(scopedUserId),
    queryFn: () => readEntries(scopedUserId),
    enabled: false,
  })
  return data ?? EMPTY_ENTRIES
}

/** Синхронное чтение статуса по id (для рендера кнопок/форм). */
export const getTravelStatus = (
  userId: string | null,
  id: string | number,
): TravelStatusEntry | undefined =>
  readEntries(userId).find((e) => String(e.id) === String(id))

/** Оптимистичная запись статуса с серверным upsert и откатом при ошибке. */
export async function setTravelStatus(
  entry: Omit<TravelStatusEntry, 'addedAt'>,
  userId: string | null,
): Promise<void> {
  const previous = readEntries(userId)
  const existing = previous.find((e) => String(e.id) === String(entry.id))
  const newEntry: TravelStatusEntry = normalizeStatusDates({
    ...entry,
    addedAt: existing?.addedAt ?? Date.now(),
  })
  writeEntries(userId, [
    ...previous.filter((e) => String(e.id) !== String(entry.id)),
    newEntry,
  ])
  try {
    await syncStatusToServer(newEntry, userId)
  } catch (error) {
    writeEntries(userId, previous)
    devError('Ошибка сохранения статуса путешествия:', error)
    throw error
  }
}

/** Оптимистичное удаление статуса с серверным delete и откатом при ошибке. */
export async function removeTravelStatus(
  id: string | number,
  userId: string | null,
): Promise<void> {
  const previous = readEntries(userId)
  writeEntries(userId, previous.filter((e) => String(e.id) !== String(id)))
  try {
    await syncRemoveStatusFromServer(id, userId)
  } catch (error) {
    writeEntries(userId, previous)
    devError('Ошибка удаления статуса путешествия:', error)
    throw error
  }
}

/**
 * Догрузка серверных статусов (замена серверной части старого loadLocal).
 * Гостю — no-op (persist держит локальные записи). Авторизованному — явные
 * серверные статусы + авторские путешествия, смерженные и записанные в кэш.
 * Идентичность изолирована ключом: смена пользователя во время фетча пишет в
 * старый ключ и не затирает актуальные записи нового.
 */
export async function loadTravelStatus(userId: string | null): Promise<void> {
  if (!userId) return
  if (!getActiveQueryClient()) return

  // Фолбэк явных статусов — текущий кэш (как локальные в старом loadLocal).
  let explicitEntries: TravelStatusEntry[] = readEntries(userId)
  try {
    const { fetchUserTravelStatuses } = await getUserApi()
    explicitEntries = (await fetchUserTravelStatuses(userId, { perPage: 9999 }))
      .map(normalizeServerStatusEntry)
      .filter((item): item is TravelStatusEntry => item !== null)
  } catch (error) {
    devWarn('Не удалось синхронизировать явные статусы путешествий с сервером:', error)
  }

  let authoredEntries: TravelStatusEntry[] = []
  try {
    authoredEntries = await fetchAuthoredTravelStatusEntries(userId)
  } catch (error) {
    devWarn('Не удалось загрузить авторские путешествия для календаря:', error)
  }

  writeEntries(userId, mergeStatusAndAuthoredEntries(explicitEntries, authoredEntries))
}
