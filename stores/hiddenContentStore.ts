// #2133: «Скрыть» — убрать один чужой объект из своих лент, не блокируя автора.
//
// Набор хранится на устройстве по владельцу сессии: скрытое одним аккаунтом не
// пропадает у другого на том же устройстве, гость ничего не скрывает. Рендер
// списка читает его через `HiddenContentGate`, который оставляет на месте объекта
// плашку «Скрыто · Показать» — лента не прыгает, и скрытие обратимо.

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

// Потолок на владельца: старые скрытия вытесняются новыми, хранилище не растёт без конца.
export const HIDDEN_CONTENT_LIMIT = 500

type HiddenContentState = {
  byOwner: Record<string, string[]>
  hide: (owner: string, key: string) => void
  unhide: (owner: string, key: string) => void
}

export const useHiddenContentStore = create<HiddenContentState>()(
  persist(
    (set) => ({
      byOwner: {},
      hide: (owner, key) =>
        set((state) => {
          const current = state.byOwner[owner] ?? []
          if (current.includes(key)) return state
          return { byOwner: { ...state.byOwner, [owner]: [...current, key].slice(-HIDDEN_CONTENT_LIMIT) } }
        }),
      unhide: (owner, key) =>
        set((state) => {
          const current = state.byOwner[owner] ?? []
          if (!current.includes(key)) return state
          return { byOwner: { ...state.byOwner, [owner]: current.filter((item) => item !== key) } }
        }),
    }),
    {
      name: 'hidden-content-storage',
      storage: createJSONStorage(() => {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          return localStorage
        }
        return AsyncStorage
      }),
      partialize: (state) => ({ byOwner: state.byOwner }),
      merge: (persisted, current) => {
        const raw = (persisted as { byOwner?: unknown } | undefined)?.byOwner
        const byOwner: Record<string, string[]> = {}
        if (raw && typeof raw === 'object') {
          Object.entries(raw as Record<string, unknown>).forEach(([owner, keys]) => {
            if (Array.isArray(keys)) byOwner[owner] = keys.filter((key): key is string => typeof key === 'string')
          })
        }
        return { ...current, byOwner }
      },
    },
  ),
)
