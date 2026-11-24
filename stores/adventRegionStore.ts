// Выбор варианта адвента «Беларусь / Польша» (#3486): один на календарь, а не на дверцу,
// переживает перезагрузку. Пока человек не выбирал, регион берётся из языка интерфейса.
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

import type { AdventRegion } from '@/types/advent'
import { isAdventRegion } from '@/utils/advent/adventVariants'

interface AdventRegionState {
  /** `null` — человек ещё не выбирал. */
  region: AdventRegion | null
  setRegion: (region: AdventRegion) => void
}

export const useAdventRegionStore = create<AdventRegionState>()(
  persist(
    (set) => ({
      region: null,
      setRegion: (region) => set({ region }),
    }),
    {
      name: 'advent-region-storage',
      storage: createJSONStorage(() => (Platform.OS === 'web' && typeof localStorage !== 'undefined' ? localStorage : AsyncStorage)),
      partialize: (state) => ({ region: state.region }),
      merge: (persisted, current) => {
        const raw = (persisted as { region?: unknown } | undefined)?.region
        return { ...current, region: isAdventRegion(raw) ? raw : null }
      },
    },
  ),
)
