import { create } from 'zustand';

interface MapPanelState {
  openNonce: number;
  requestOpen: () => void;
  toggleNonce: number;
  requestToggle: () => void;
}

let lastOpenTs = 0;
let lastToggleTs = 0;
const THROTTLE_MS = 300;

export const useMapPanelStore = create<MapPanelState>((set) => ({
  openNonce: 0,
  requestOpen: () =>
    set((s) => {
      const now = Date.now();
      if (now - lastOpenTs < THROTTLE_MS) return s;
      lastOpenTs = now;
      return { openNonce: s.openNonce + 1 };
    }),
  toggleNonce: 0,
  requestToggle: () =>
    set((s) => {
      const now = Date.now();
      if (now - lastToggleTs < THROTTLE_MS) return s;
      lastToggleTs = now;
      return { toggleNonce: s.toggleNonce + 1 };
    }),
}));
