import { create } from 'zustand';

interface TravelSectionsState {
  openNonce: number;
  requestOpen: () => void;
}

export const useTravelSectionsStore = create<TravelSectionsState>((set) => ({
  openNonce: 0,
  requestOpen: () => set((s) => ({ openNonce: s.openNonce + 1 })),
}));
