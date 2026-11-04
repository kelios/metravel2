import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { DEFAULT_LIST_DENSITY, LIST_VIEW_PERSISTENCE, type ListDensity, type PersistedListView } from './listViewPersistence';

export type { ListDensity } from './listViewPersistence';

interface ListViewState {
  /** Density of the travel catalog grid. Default keeps the existing large cards. */
  density: ListDensity;
  setDensity: (density: ListDensity) => void;
  toggleDensity: () => void;
}

export const useListViewStore = create<ListViewState>()(
  persist(
    (set, get) => ({
      density: DEFAULT_LIST_DENSITY,
      setDensity: (density) => set({ density }),
      toggleDensity: () =>
        set({ density: get().density === 'compact' ? 'comfortable' : 'compact' }),
    }),
    {
      ...LIST_VIEW_PERSISTENCE,
      storage: createJSONStorage(() => {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          return localStorage;
        }
        return AsyncStorage;
      }),
      partialize: (state): PersistedListView => ({ density: state.density }),
    }
  )
);
