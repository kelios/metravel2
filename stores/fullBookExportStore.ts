import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// #2357: локально храним только ссылки и предпочтения владельца — период и
// скрытое пользователем задание. Состояние задания, счётчики, снимки, билеты
// и файлы книги живут на сервере и сюда не попадают: после перезагрузки панель
// читает последнее задание из owner job list.
export interface FullBookOwnerPrefs {
  yearFrom?: number;
  yearTo?: number;
  dismissedJobId?: string;
}

interface FullBookExportState {
  byOwner: Record<string, FullBookOwnerPrefs>;
  setPeriod: (owner: string, yearFrom: number, yearTo: number) => void;
  dismissJob: (owner: string, jobId: string) => void;
}

export const useFullBookExportStore = create<FullBookExportState>()(
  persist(
    (set) => ({
      byOwner: {},
      setPeriod: (owner, yearFrom, yearTo) =>
        set((state) => ({
          byOwner: { ...state.byOwner, [owner]: { ...state.byOwner[owner], yearFrom, yearTo } },
        })),
      dismissJob: (owner, jobId) =>
        set((state) => ({
          byOwner: { ...state.byOwner, [owner]: { ...state.byOwner[owner], dismissedJobId: jobId } },
        })),
    }),
    {
      name: 'full-book-export-prefs',
      version: 1,
      storage: createJSONStorage(() => {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          return localStorage;
        }
        return AsyncStorage;
      }),
      partialize: (state) => ({ byOwner: state.byOwner }),
    }
  )
);
