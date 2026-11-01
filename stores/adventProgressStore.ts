// Локальный прогресс адвент-календаря (#2861): какие дверцы открыты и какие
// задания зачтены, по владельцу сессии. Гость и каждый аккаунт хранятся под
// своим ключом в одном persist-хранилище (как `hiddenContentStore`): смена
// пользователя на устройстве не показывает чужой прогресс, а гостевой остаётся
// для переноса при регистрации (поезд B, #2867).

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

import type { AdventProgressMaps } from '@/utils/advent/adventCalendar'

export const ADVENT_GUEST_OWNER = 'guest'

export type AdventProgressOwner = { isAuthenticated: boolean; userId?: string | number | null }

/** `guest` для гостя, `u<id>` для аккаунта; `null` — auth ещё не готов, писать некуда. */
export const buildAdventOwnerKey = (owner: AdventProgressOwner & { authReady?: boolean }): string | null => {
  if (owner.authReady === false) return null
  if (!owner.isAuthenticated) return ADVENT_GUEST_OWNER
  const userId = String(owner.userId ?? '').trim()
  return userId ? `u${userId}` : null
}

type AdventProgressState = {
  byOwner: Record<string, AdventProgressMaps>
  openDoor: (owner: string, day: number, isoDate: string) => void
  completeTask: (owner: string, day: number, isoDate: string) => void
  resetOwner: (owner: string) => void
}

const emptyMaps = (): AdventProgressMaps => ({ opened: {}, tasksDone: {} })

const isStringMap = (value: unknown): value is Record<string, string> =>
  !!value && typeof value === 'object' && Object.values(value as Record<string, unknown>).every((v) => typeof v === 'string')

export const useAdventProgressStore = create<AdventProgressState>()(
  persist(
    (set) => ({
      byOwner: {},
      openDoor: (owner, day, isoDate) =>
        set((state) => {
          const current = state.byOwner[owner] ?? emptyMaps()
          const key = String(day)
          // Первая дата открытия — факт для серии; повторное открытие её не сдвигает.
          if (current.opened[key]) return state
          return { byOwner: { ...state.byOwner, [owner]: { ...current, opened: { ...current.opened, [key]: isoDate } } } }
        }),
      completeTask: (owner, day, isoDate) =>
        set((state) => {
          const current = state.byOwner[owner] ?? emptyMaps()
          const key = String(day)
          if (current.tasksDone[key]) return state
          return {
            byOwner: {
              ...state.byOwner,
              [owner]: {
                opened: current.opened[key] ? current.opened : { ...current.opened, [key]: isoDate },
                tasksDone: { ...current.tasksDone, [key]: isoDate },
              },
            },
          }
        }),
      resetOwner: (owner) =>
        set((state) => {
          if (!state.byOwner[owner]) return state
          const next = { ...state.byOwner }
          delete next[owner]
          return { byOwner: next }
        }),
    }),
    {
      name: 'advent-progress-storage',
      storage: createJSONStorage(() => {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') return localStorage
        return AsyncStorage
      }),
      partialize: (state) => ({ byOwner: state.byOwner }),
      merge: (persisted, current) => {
        const raw = (persisted as { byOwner?: unknown } | undefined)?.byOwner
        const byOwner: Record<string, AdventProgressMaps> = {}
        if (raw && typeof raw === 'object') {
          Object.entries(raw as Record<string, unknown>).forEach(([owner, maps]) => {
            const candidate = maps as Partial<AdventProgressMaps> | null
            byOwner[owner] = {
              opened: isStringMap(candidate?.opened) ? candidate.opened : {},
              tasksDone: isStringMap(candidate?.tasksDone) ? candidate.tasksDone : {},
            }
          })
        }
        return { ...current, byOwner }
      },
    },
  ),
)

export const selectAdventOwnerProgress = (owner: string | null) => (state: AdventProgressState): AdventProgressMaps =>
  (owner && state.byOwner[owner]) || EMPTY_OWNER_PROGRESS

const EMPTY_OWNER_PROGRESS: AdventProgressMaps = Object.freeze({ opened: {}, tasksDone: {} })
