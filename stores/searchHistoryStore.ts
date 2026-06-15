import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { devError } from '@/utils/logger'
import { safeJsonParseString } from '@/utils/safeJsonParse'

const SEARCH_HISTORY_KEY = 'metravel_search_history'
const MAX_HISTORY_ITEMS = 5

const normalizeQuery = (value: string): string => value.trim()

const dedupe = (items: string[]): string[] => {
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of items) {
    const key = item.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

interface SearchHistoryState {
  history: string[]
  _loaded: boolean
  load: () => Promise<void>
  addQuery: (query: string) => Promise<void>
  removeQuery: (query: string) => Promise<void>
  clearHistory: () => Promise<void>
}

const persist = async (history: string[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history))
  } catch (error) {
    devError('Ошибка сохранения истории поиска:', error)
  }
}

export const useSearchHistoryStore = create<SearchHistoryState>((set, get) => ({
  history: [],
  _loaded: false,

  load: async () => {
    if (get()._loaded) return
    set({ _loaded: true })
    try {
      const raw = await AsyncStorage.getItem(SEARCH_HISTORY_KEY)
      if (!raw) return
      const parsed = safeJsonParseString<unknown>(raw, [])
      const normalized = dedupe(
        (Array.isArray(parsed) ? parsed : [])
          .filter((item): item is string => typeof item === 'string')
          .map(normalizeQuery)
          .filter((item) => item.length > 0),
      ).slice(0, MAX_HISTORY_ITEMS)
      set({ history: normalized })
    } catch (error) {
      devError('Ошибка загрузки истории поиска:', error)
    }
  },

  addQuery: async (query) => {
    const normalized = normalizeQuery(query)
    if (!normalized) return

    let next: string[] = []
    set((s) => {
      next = dedupe([normalized, ...s.history]).slice(0, MAX_HISTORY_ITEMS)
      return { history: next }
    })
    await persist(next)
  },

  removeQuery: async (query) => {
    const key = normalizeQuery(query).toLocaleLowerCase()
    let next: string[] = []
    set((s) => {
      next = s.history.filter((item) => item.toLocaleLowerCase() !== key)
      return { history: next }
    })
    await persist(next)
  },

  clearHistory: async () => {
    set({ history: [] })
    await persist([])
  },
}))
