import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { devError } from '@/utils/logger'
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
    travelYear: typeof item.travelYear === 'string' ? item.travelYear : undefined,
    travelMonth: Array.isArray(item.travelMonth)
      ? item.travelMonth.map(String)
      : typeof item.travelMonth === 'string'
        ? item.travelMonth
        : undefined,
    travelMonthName: typeof item.travelMonthName === 'string' ? item.travelMonthName : undefined,
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
      if (data) {
        const parsed = safeJsonParseString(data, [])
        const normalized = (Array.isArray(parsed) ? parsed : [])
          .map(normalizeEntry)
          .filter((item): item is TravelStatusEntry => item !== null)
        set({ entries: normalized, _userId: userId })
      } else {
        set({ entries: [], _userId: userId })
      }
    } catch (error) {
      devError('Ошибка загрузки статусов путешествий:', error)
    }
  },
}))
