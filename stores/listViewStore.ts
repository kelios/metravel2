import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type ListDensity = 'comfortable' | 'compact';

interface ListViewState {
  /** Density of the travel catalog grid. Default keeps the existing large cards. */
  density: ListDensity;
  setDensity: (density: ListDensity) => void;
  toggleDensity: () => void;
}

export const useListViewStore = create<ListViewState>()(
  persist(
    (set, get) => ({
      density: 'comfortable',
      setDensity: (density) => set({ density }),
      toggleDensity: () =>
        set({ density: get().density === 'compact' ? 'comfortable' : 'compact' }),
    }),
    {
      name: 'list-view-storage',
      storage: createJSONStorage(() => {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          return localStorage;
        }
        return AsyncStorage;
      }),
      partialize: (state) => ({ density: state.density }),
    }
  )
);
