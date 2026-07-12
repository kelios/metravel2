import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const QUEST_FONT_SCALE_STEPS = [1, 1.15, 1.3] as const;

export type QuestFontScale = (typeof QUEST_FONT_SCALE_STEPS)[number];

const clampToStep = (value: number): QuestFontScale => {
  const nearest = QUEST_FONT_SCALE_STEPS.reduce((best, step) =>
    Math.abs(step - value) < Math.abs(best - value) ? step : best,
  );
  return nearest;
};

interface QuestFontScaleState {
  fontScale: QuestFontScale;
  increase: () => void;
  decrease: () => void;
}

export const useQuestFontScaleStore = create<QuestFontScaleState>()(
  persist(
    (set, get) => ({
      fontScale: 1,
      increase: () => {
        const index = QUEST_FONT_SCALE_STEPS.indexOf(get().fontScale);
        const next = QUEST_FONT_SCALE_STEPS[Math.min(index + 1, QUEST_FONT_SCALE_STEPS.length - 1)];
        set({ fontScale: next });
      },
      decrease: () => {
        const index = QUEST_FONT_SCALE_STEPS.indexOf(get().fontScale);
        const next = QUEST_FONT_SCALE_STEPS[Math.max(index - 1, 0)];
        set({ fontScale: next });
      },
    }),
    {
      name: 'quest-font-scale-storage',
      storage: createJSONStorage(() => {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          return localStorage;
        }
        return AsyncStorage;
      }),
      partialize: (state) => ({ fontScale: state.fontScale }),
      merge: (persisted, current) => {
        const raw = (persisted as { fontScale?: number } | undefined)?.fontScale
        return { ...current, fontScale: clampToStep(raw ?? current.fontScale) }
      },
    }
  )
);
