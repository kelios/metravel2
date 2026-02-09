/**
 * Bottom Sheet Store
 * Управляет состоянием Bottom Sheet для координации с контролами карты
 */

import { create } from 'zustand';

export type BottomSheetState = 'collapsed' | 'quarter' | 'half' | 'full';

interface BottomSheetStore {
  /** Текущее состояние Bottom Sheet */
  state: BottomSheetState;

  /** Высота Bottom Sheet в пикселях для текущего состояния */
  heightPx: number;

  /** Установить состояние Bottom Sheet */
  setState: (state: BottomSheetState) => void;

  /** Установить высоту Bottom Sheet */
  setHeightPx: (height: number) => void;

  /** Получить рекомендуемый отступ снизу для контролов карты */
  getControlsBottomOffset: () => number;
}

export const useBottomSheetStore = create<BottomSheetStore>((set, get) => ({
  state: 'collapsed',
  heightPx: 0,

  setState: (state) => set({ state }),

  setHeightPx: (height) => set({ heightPx: height }),

  getControlsBottomOffset: () => {
    const { state, heightPx } = get();

    // В collapsed состоянии отступ минимальный (peek preview)
    if (state === 'collapsed') {
      return 120; // Примерно высота peek preview + запас
    }

    // В quarter состоянии — компактный preview
    if (state === 'quarter') {
      return Math.max(heightPx * 0.25 + 20, 150);
    }

    // В half/full состоянии используем фактическую высоту + запас
    if (state === 'half') {
      return Math.max(heightPx * 0.5 + 20, 200);
    }

    if (state === 'full') {
      return Math.max(heightPx * 0.9 + 20, 400);
    }

    return 120;
  },
}));

