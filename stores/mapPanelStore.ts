import { create } from 'zustand';

interface MapPanelState {
  openNonce: number;
  requestOpen: () => void;
  toggleNonce: number;
  requestToggle: () => void;
}

export const useMapPanelStore = create<MapPanelState>((set) => ({
  openNonce: 0,
  requestOpen: () => set((s) => ({ openNonce: s.openNonce + 1 })),
  toggleNonce: 0,
  requestToggle: () => set((s) => ({ toggleNonce: s.toggleNonce + 1 })),
}));
