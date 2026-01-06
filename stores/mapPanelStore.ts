import { create } from 'zustand';

interface MapPanelState {
  openNonce: number;
  requestOpen: () => void;
}

export const useMapPanelStore = create<MapPanelState>((set) => ({
  openNonce: 0,
  requestOpen: () => set((s) => ({ openNonce: s.openNonce + 1 })),
}));
