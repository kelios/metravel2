import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { devError, devWarn } from '@/utils/logger'
import { safeJsonParseString } from '@/utils/safeJsonParse'
import { buildTravelMonthFallbackDate } from '@/utils/travelCalendarDate'

const TRAVEL_STATUS_KEY = 'metravel_travel_status'

const getUserApi = async () => import('@/api/user')

export type TravelStatus = 'visited' | 'planned' | 'wishlist'

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
  >
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

const normalizeEntry = (item: unknown): TravelStatusEntry | null => {
  if (!isRecord(item)) return null
  const { id, type, title, url, status, addedAt } = item
  if (
    (typeof id !== 'string' && typeof id !== 'number') ||
    type !== 'travel' ||
    typeof title !== 'string' ||
    typeof url !== 'string' ||
    (status !== 'visited' && status !== 'planned' && status !== 'wishlist') ||
    !Number.isFinite(Number(addedAt))
  ) return null
  return normalizeStatusDates({
    id,
    type: 'travel' as const,
    title,
    url,
    status: status as TravelStatus,
    addedAt: Number(addedAt),
    imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
    country: typeof item.country === 'string' ? item.country : undefined,
    city: typeof item.city === 'string' ? item.city : undefined,
    plannedDate: typeof item.plannedDate === 'string' ? item.plannedDate : undefined,
    visitedDate: typeof item.visitedDate === 'string' ? item.visitedDate : undefined,
    wishlistDate: typeof item.wishlistDate === 'string' ? item.wishlistDate : undefined,
    travelYear: normalizeOptionalString(item.travelYear),
    travelMonth: normalizeTravelMonth(item.travelMonth),
    travelMonthName: normalizeOptionalString(item.travelMonthName),
  })
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
    : `Путешествие ${String(travelId ?? '').trim()}`
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
  })
}

const getStorageKey = (userId: string | null): string =>
  userId ? `${TRAVEL_STATUS_KEY}_${userId}` : TRAVEL_STATUS_KEY

const persistEntries = async (entries: TravelStatusEntry[], userId: string | null): Promise<void> => {
  await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(entries))
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

interface TravelStatusState {
  entries: TravelStatusEntry[]
  _userId: string | null

  getStatus: (id: string | number) => TravelStatusEntry | undefined
  setStatus: (entry: Omit<TravelStatusEntry, 'addedAt'>, userId: string | null) => Promise<void>
  removeStatus: (id: string | number, userId: string | null) => Promise<void>
  getByStatus: (status: TravelStatus) => TravelStatusEntry[]
  getByMonth: (year: number, month: number) => TravelStatusEntry[]
  loadLocal: (userId: string | null) => Promise<void>
}

export const useTravelStatusStore = create<TravelStatusState>((set, get) => ({
  entries: [],
  _userId: null,

  getStatus: (id) =>
    get().entries.find((e) => String(e.id) === String(id)),

  setStatus: async (entry, userId) => {
    const previousEntries = get().entries
    const existing = get().entries.find((e) => String(e.id) === String(entry.id))
    const newEntry: TravelStatusEntry = normalizeStatusDates({
      ...entry,
      addedAt: existing?.addedAt ?? Date.now(),
    })
    const newEntries = [
      ...get().entries.filter((e) => String(e.id) !== String(entry.id)),
      newEntry,
    ]
    set({ entries: newEntries })
    try {
      await persistEntries(newEntries, userId)
      await syncStatusToServer(newEntry, userId)
    } catch (error) {
      set({ entries: previousEntries })
      try {
        await persistEntries(previousEntries, userId)
      } catch (persistError) {
        devError('Ошибка отката статуса путешествия:', persistError)
      }
      devError('Ошибка сохранения статуса путешествия:', error)
      throw error
    }
  },

  removeStatus: async (id, userId) => {
    const previousEntries = get().entries
    const newEntries = get().entries.filter((e) => String(e.id) !== String(id))
    set({ entries: newEntries })
    try {
      await persistEntries(newEntries, userId)
      await syncRemoveStatusFromServer(id, userId)
    } catch (error) {
      set({ entries: previousEntries })
      try {
        await persistEntries(previousEntries, userId)
      } catch (persistError) {
        devError('Ошибка отката удаления статуса путешествия:', persistError)
      }
      devError('Ошибка удаления статуса путешествия:', error)
      throw error
    }
  },

  getByStatus: (status) =>
    get().entries.filter((e) => e.status === status),

  getByMonth: (year, month) =>
    get().entries.filter((e) => {
      const dateParts = parseTravelStatusDateParts(getTravelStatusCalendarDate(e))
      return dateParts?.year === year && dateParts.month === month
    }),

  loadLocal: async (userId) => {
    try {
      const data = await AsyncStorage.getItem(getStorageKey(userId))
      const parsed = data ? safeJsonParseString(data, []) : []
      const localEntries = Array.isArray(parsed)
        ? parsed
          .map(normalizeEntry)
          .filter((item): item is TravelStatusEntry => item !== null)
        : []

      set({ entries: localEntries, _userId: userId })

      if (!userId) return

      const { fetchUserTravelStatuses } = await getUserApi()
      const serverEntries = (await fetchUserTravelStatuses(userId, { perPage: 9999 }))
        .map(normalizeServerStatusEntry)
        .filter((item): item is TravelStatusEntry => item !== null)

      // Пользователь сменился (logout/смена аккаунта) пока шёл серверный фетч —
      // не затираем актуальные записи устаревшим ответом.
      if (get()._userId !== userId) return

      set({ entries: serverEntries, _userId: userId })
      await persistEntries(serverEntries, userId)
    } catch (error) {
      // Best-effort серверная синхронизация: локальные статусы уже загружены
      // выше, поэтому сбой фетча не фатален — предупреждение, не ошибка.
      devWarn('Не удалось синхронизировать статусы путешествий с сервером:', error)
    }
  },
}))
