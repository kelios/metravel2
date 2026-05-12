import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { devError } from '@/utils/logger'
import { safeJsonParseString } from '@/utils/safeJsonParse'

const TRAVEL_STATUS_KEY = 'metravel_travel_status'

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
  plannedDate?: string  // ISO "YYYY-MM-DD", только для status === 'planned'
  visitedDate?: string  // ISO "YYYY-MM-DD", опционально для status === 'visited'
  addedAt: number       // timestamp
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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
  return {
    id,
    type: 'travel',
    title,
    url,
    status: status as TravelStatus,
    addedAt: Number(addedAt),
    imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
    country: typeof item.country === 'string' ? item.country : undefined,
    city: typeof item.city === 'string' ? item.city : undefined,
    plannedDate: typeof item.plannedDate === 'string' ? item.plannedDate : undefined,
    visitedDate: typeof item.visitedDate === 'string' ? item.visitedDate : undefined,
  }
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
    const existing = get().entries.find((e) => String(e.id) === String(entry.id))
    const newEntry: TravelStatusEntry = {
      ...entry,
      addedAt: existing?.addedAt ?? Date.now(),
    }
    const newEntries = [
      ...get().entries.filter((e) => String(e.id) !== String(entry.id)),
      newEntry,
    ]
    set({ entries: newEntries })
    try {
      const key = userId ? `${TRAVEL_STATUS_KEY}_${userId}` : TRAVEL_STATUS_KEY
      await AsyncStorage.setItem(key, JSON.stringify(newEntries))
    } catch (error) {
      devError('Ошибка сохранения статуса путешествия:', error)
    }
  },

  removeStatus: async (id, userId) => {
    const newEntries = get().entries.filter((e) => String(e.id) !== String(id))
    set({ entries: newEntries })
    try {
      const key = userId ? `${TRAVEL_STATUS_KEY}_${userId}` : TRAVEL_STATUS_KEY
      await AsyncStorage.setItem(key, JSON.stringify(newEntries))
    } catch (error) {
      devError('Ошибка удаления статуса путешествия:', error)
    }
  },

  getByStatus: (status) =>
    get().entries.filter((e) => e.status === status),

  getByMonth: (year, month) =>
    get().entries.filter((e) => {
      if (e.status !== 'planned' || !e.plannedDate) return false
      const d = new Date(e.plannedDate)
      return d.getFullYear() === year && d.getMonth() + 1 === month
    }),

  loadLocal: async (userId) => {
    try {
      const key = userId ? `${TRAVEL_STATUS_KEY}_${userId}` : TRAVEL_STATUS_KEY
      const data = await AsyncStorage.getItem(key)
      if (data) {
        const parsed = safeJsonParseString(data, [])
        const normalized = (Array.isArray(parsed) ? parsed : [])
          .map(normalizeEntry)
          .filter((item): item is TravelStatusEntry => item !== null)
        set({ entries: normalized, _userId: userId })
      } else {
        set({ _userId: userId })
      }
    } catch (error) {
      devError('Ошибка загрузки статусов путешествий:', error)
    }
  },
}))

