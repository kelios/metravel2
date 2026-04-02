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

  /** Сигнал на сворачивание Bottom Sheet из внешних слоев карты */
  collapseNonce: number;
  requestCollapse: () => void;

  /** Получить рекомендуемый отступ снизу для контролов карты */
  getControlsBottomOffset: () => number;
}

export const getBottomSheetControlsOffset = (
  state: BottomSheetState,
  heightPx: number
) => {
  const safeHeight = Number.isFinite(heightPx) ? Math.max(0, heightPx) : 0;

  if (state === 'collapsed') {
    return 120;
  }

  if (state === 'quarter') {
    return Math.max(safeHeight + 16, 150);
  }

  if (state === 'half') {
    return Math.max(safeHeight + 16, 220);
  }

  if (state === 'full') {
    return Math.max(safeHeight + 16, 400);
  }

  return 120;
};

export const useBottomSheetStore = create<BottomSheetStore>((set, get) => ({
  state: 'collapsed',
  heightPx: 0,
  collapseNonce: 0,

  setState: (state) => set({ state }),

  setHeightPx: (height) => set({ heightPx: height }),

  requestCollapse: () => set((s) => ({ collapseNonce: s.collapseNonce + 1 })),

  getControlsBottomOffset: () => {
    const { state, heightPx } = get();
    return getBottomSheetControlsOffset(state, heightPx);
  },
}));
