import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RoutePoint, RouteData, TransportMode } from '@/types/route';
import type { LatLng } from '@/types/coordinates';
import { RouteValidator } from '@/utils/routeValidator';

interface RouteState {
  // Mode
  mode: 'radius' | 'route';
  transportMode: TransportMode;
  
  // Points
  points: RoutePoint[];
  
  // Calculated route
  route: RouteData | null;
  
  // Loading state
  isBuilding: boolean;
  error: string | null;
  
  // Actions
  setMode: (mode: 'radius' | 'route') => void;
  setTransportMode: (mode: TransportMode) => void;
  
  addPoint: (coordinates: LatLng, address: string) => void;
  removePoint: (id: string) => void;
  updatePoint: (id: string, updates: Partial<RoutePoint>) => void;
  reorderPoints: (points: RoutePoint[]) => void;
  swapStartEnd: () => void;
  clearRoute: () => void;
  clearRouteAndSetMode: (mode: 'radius' | 'route') => void;
  forceRebuild: () => void;
  
  setRoute: (route: RouteData | null) => void;
  setBuilding: (isBuilding: boolean) => void;
  setError: (error: string | null) => void;
  
  // Computed
  getStartPoint: () => RoutePoint | null;
  getEndPoint: () => RoutePoint | null;
  getWaypoints: () => RoutePoint[];
}

export const useRouteStore = create<RouteState>()(
  persist(
    (set, get) => ({
      // Initial state
      mode: 'radius',
      transportMode: 'car',
      points: [],
      route: null,
      isBuilding: false,
      error: null,

      // Actions
      setMode: (mode) => set({ mode }),
      
      setTransportMode: (transportMode) => {
        set({ transportMode, route: null });
      },

      addPoint: (coordinates, address) => {
        const points = get().points;
        
        // Determine point type
        let type: 'start' | 'waypoint' | 'end' = 'waypoint';
        if (points.length === 0) {
          type = 'start';
        } else if (points.length === 1) {
          type = 'end';
        } else {
          // Update previous end point to waypoint
          const updatedPoints = points.map((p, i) => 
            i === points.length - 1 ? { ...p, type: 'waypoint' as const } : p
          );
          set({ points: updatedPoints });
        }

        const newPoint: RoutePoint = {
          id: `point-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          coordinates,
          address,
          type,
          timestamp: Date.now(),
        };

        const validation = RouteValidator.canAddPoint(points, newPoint);
        if (!validation.valid) {
          set({ error: RouteValidator.getErrorMessage(validation), isBuilding: false });
          return;
        }

        set({ 
          points: [...get().points, newPoint],
          route: null,
          error: null,
        });
      },

      removePoint: (id) => {
        const points = get().points.filter(p => p.id !== id);
        
        // Recalculate types
        const updatedPoints = points.map((p, i) => ({
          ...p,
          type: i === 0 ? 'start' as const : 
                i === points.length - 1 ? 'end' as const : 
                'waypoint' as const,
        }));

        set({ 
          points: updatedPoints,
          route: null,
          error: null,
        });
      },

      updatePoint: (id, updates) => {
        set({
          points: get().points.map(p => 
            p.id === id ? { ...p, ...updates } : p
          ),
          route: null,
        });
      },

      reorderPoints: (points) => {
        // Recalculate types after reordering
        const updatedPoints = points.map((p, i) => ({
          ...p,
          type: i === 0 ? 'start' as const : 
                i === points.length - 1 ? 'end' as const : 
                'waypoint' as const,
        }));

        set({ 
          points: updatedPoints,
          route: null,
        });
      },

      swapStartEnd: () => {
        const points = get().points;
        if (points.length < 2) return;
        const swapped = [...points];
        // swap first and last entries
        const first = swapped[0];
        swapped[0] = swapped[swapped.length - 1];
        swapped[swapped.length - 1] = first;
        // Recalculate types
        const updatedPoints = swapped.map((p, i) => ({
          ...p,
          type: i === 0 ? 'start' as const :
                i === swapped.length - 1 ? 'end' as const :
                'waypoint' as const,
        }));
        set({
          points: updatedPoints,
          route: null,
          error: null,
        });
      },

      clearRoute: () => {
        set({
          points: [],
          route: null,
          error: null,
          isBuilding: false,
        });
      },

      clearRouteAndSetMode: (mode) => {
        set({
          mode,
          points: [],
          route: null,
          error: null,
          isBuilding: false,
        });
      },

      forceRebuild: () => {
        const points = get().points;
        if (points.length < 2) return;
        // Create new point array references to trigger useRouting re-computation
        set({
          points: points.map(p => ({ ...p })),
          route: null,
          error: null,
        });
      },

      setRoute: (route) => set({ route, isBuilding: false }),
      
      setBuilding: (isBuilding) => set({ isBuilding }),
      
      setError: (error) => set({ error, isBuilding: false }),

      // Computed getters
      getStartPoint: () => {
        const points = get().points;
        return points.find(p => p.type === 'start') || points[0] || null;
      },

      getEndPoint: () => {
        const points = get().points;
        return points.find(p => p.type === 'end') || points[points.length - 1] || null;
      },

      getWaypoints: () => {
        return get().points.filter(p => p.type === 'waypoint');
      },
    }),
    {
      name: 'route-storage',
      partialize: (state) => ({
        mode: state.mode,
        transportMode: state.transportMode,
        points: state.points,
      }),
    }
  )
);
