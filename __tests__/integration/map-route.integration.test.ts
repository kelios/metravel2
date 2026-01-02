/**
 * Integration tests for map route functionality
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useRouteStoreAdapter } from '@/hooks/useRouteStoreAdapter';
import { useRouteStore } from '@/stores/routeStore';

describe('Map Route Integration Tests', () => {
  beforeEach(() => {
    // Clear any persisted state
    localStorage.clear();

    // Also clear in-memory zustand singleton state between tests
    useRouteStore.getState().clearRoute();
  });

  describe('Building a route from scratch', () => {
    it('should build a route with start and end points', async () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      // Initially no points
      expect(result.current.points).toHaveLength(0);
      expect(result.current.startAddress).toBe('');
      expect(result.current.endAddress).toBe('');

      // Add start point
      act(() => {
        result.current.handleAddressSelect(
          'Minsk, Independence Avenue 1',
          { lat: 53.9006, lng: 27.559 },
          true // isStart
        );
      });

      await waitFor(() => {
        expect(result.current.points).toHaveLength(1);
        expect(result.current.startAddress).toBe('Minsk, Independence Avenue 1');
      });

      // Add end point
      act(() => {
        result.current.handleAddressSelect(
          'Minsk, Victory Square',
          { lat: 53.9045, lng: 27.5615 },
          false // isStart = false, so it's end
        );
      });

      await waitFor(() => {
        expect(result.current.points).toHaveLength(2);
        expect(result.current.endAddress).toBe('Minsk, Victory Square');
      });

      // Verify route points in [lng, lat] format
      expect(result.current.routePoints).toEqual([
        [27.559, 53.9006],
        [27.5615, 53.9045],
      ]);
    });

    it('should replace start point when selecting new start', async () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      // Add initial start point
      act(() => {
        result.current.handleAddressSelect(
          'Old Start',
          { lat: 53.9, lng: 27.55 },
          true
        );
      });

      await waitFor(() => {
        expect(result.current.points).toHaveLength(1);
      });

      // Replace with new start point
      act(() => {
        result.current.handleAddressSelect(
          'New Start',
          { lat: 53.95, lng: 27.6 },
          true
        );
      });

      await waitFor(() => {
        expect(result.current.points).toHaveLength(1);
        expect(result.current.startAddress).toBe('New Start');
      });
    });
  });

  describe('Converting coordinates between formats', () => {
    it('should convert map click [lng, lat] to route points', async () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      // Simulate map clicks in [lng, lat] format (as Leaflet provides)
      const mapClickPoints: [number, number][] = [
        [27.559, 53.9006], // lng, lat
        [27.5615, 53.9045],
      ];

      act(() => {
        result.current.setRoutePoints(mapClickPoints);
      });

      await waitFor(() => {
        expect(result.current.points).toHaveLength(2);
      });

      // Verify points are stored correctly
      expect(result.current.points[0].coordinates).toEqual({
        lat: 53.9006,
        lng: 27.559,
      });
      expect(result.current.points[1].coordinates).toEqual({
        lat: 53.9045,
        lng: 27.5615,
      });

      // Verify they convert back correctly for map display
      expect(result.current.routePoints).toEqual([
        [27.559, 53.9006],
        [27.5615, 53.9045],
      ]);
    });
  });

  describe('Setting route data from routing service', () => {
    it('should store full route coordinates and distance', async () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      // Add start and end points first
      act(() => {
        result.current.setRoutePoints([
          [27.559, 53.9006],
          [27.5615, 53.9045],
        ]);
      });

      await waitFor(() => {
        expect(result.current.points).toHaveLength(2);
      });

      // Simulate routing service response
      const fullRouteCoords: [number, number][] = [
        [27.559, 53.9006],
        [27.5595, 53.9015],
        [27.56, 53.9025],
        [27.5605, 53.9035],
        [27.5615, 53.9045],
      ];

      act(() => {
        result.current.setFullRouteCoords(fullRouteCoords);
      });

      await waitFor(() => {
        expect(result.current.fullRouteCoords).toHaveLength(5);
      });

      // Set distance
      act(() => {
        result.current.setRouteDistance(1250); // 1.25 km in meters
      });

      await waitFor(() => {
        expect(result.current.routeDistance).toBe(1250);
      });

      // Verify route is complete
      expect(result.current.route).toBeDefined();
      expect(result.current.route?.distance).toBe(1250);
      expect(result.current.route?.coordinates).toHaveLength(5);
    });
  });

  describe('Clearing and resetting route', () => {
    it('should clear all route data', async () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      // Build a route
      act(() => {
        result.current.setRoutePoints([
          [27.559, 53.9006],
          [27.5615, 53.9045],
        ]);
      });

      act(() => {
        result.current.setRouteDistance(1250);
      });

      await waitFor(() => {
        expect(result.current.points).toHaveLength(2);
        expect(result.current.routeDistance).toBe(1250);
      });

      // Clear route
      act(() => {
        result.current.handleClearRoute();
      });

      await waitFor(() => {
        expect(result.current.points).toHaveLength(0);
        expect(result.current.route).toBeNull();
        expect(result.current.routeDistance).toBeNull();
        expect(result.current.startAddress).toBe('');
        expect(result.current.endAddress).toBe('');
      });
    });
  });

  describe('Swapping start and end points', () => {
    it('should swap start and end addresses', async () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      // Add start and end
      act(() => {
        result.current.handleAddressSelect('Start Point', { lat: 53.9, lng: 27.55 }, true);
      });

      act(() => {
        result.current.handleAddressSelect('End Point', { lat: 54.0, lng: 28.0 }, false);
      });

      await waitFor(() => {
        expect(result.current.points).toHaveLength(2);
      });

      const originalStart = result.current.startAddress;
      const originalEnd = result.current.endAddress;

      // Swap
      act(() => {
        result.current.swapStartEnd();
      });

      await waitFor(() => {
        expect(result.current.startAddress).toBe(originalEnd);
        expect(result.current.endAddress).toBe(originalStart);
      });
    });
  });

  describe('Transport mode switching', () => {
    it('should change transport mode and clear route', async () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      // Build route
      act(() => {
        result.current.setRoutePoints([
          [27.559, 53.9006],
          [27.5615, 53.9045],
        ]);
      });

      act(() => {
        result.current.setFullRouteCoords([
          [27.559, 53.9006],
          [27.56, 53.902],
          [27.5615, 53.9045],
        ]);
      });

      await waitFor(() => {
        expect(result.current.route).toBeDefined();
      });

      // Change transport mode
      act(() => {
        result.current.setTransportMode('bike');
      });

      await waitFor(() => {
        expect(result.current.transportMode).toBe('bike');
        // Route should be cleared when transport mode changes
        expect(result.current.route).toBeNull();
        // But points should remain
        expect(result.current.points).toHaveLength(2);
      });
    });
  });

  describe('Mode switching', () => {
    it('should switch between radius and route modes', async () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      expect(result.current.mode).toBe('radius');

      act(() => {
        result.current.setMode('route');
      });

      await waitFor(() => {
        expect(result.current.mode).toBe('route');
      });

      act(() => {
        result.current.setMode('radius');
      });

      await waitFor(() => {
        expect(result.current.mode).toBe('radius');
      });
    });
  });

  describe('Error states', () => {
    it('should handle routing errors', async () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      expect(result.current.error).toBeNull();
      expect(result.current.isBuilding).toBe(false);
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle empty point array gracefully', async () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      act(() => {
        result.current.setRoutePoints([]);
      });

      // Should not crash, points should remain empty
      expect(result.current.points).toHaveLength(0);
    });

    it('should handle invalid coordinates', async () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      act(() => {
        result.current.setRoutePoints([
          [NaN, 53.9],
          [27.55, NaN],
          [Infinity, 53.9],
        ] as [number, number][]);
      });

      // Should skip invalid points
      expect(result.current.points).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle partial point data', async () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      act(() => {
        result.current.setRoutePoints([
          [27.559, 53.9006], // valid
          [27.56] as any, // invalid - missing lat
          [27.5615, 53.9045], // valid
        ]);
      });

      // Should only add valid points
      expect(result.current.points).toHaveLength(2);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Performance and memoization', () => {
    it('should not recalculate routePoints if store.points unchanged', async () => {
      const { result, rerender } = renderHook(() => useRouteStoreAdapter());

      act(() => {
        result.current.setRoutePoints([
          [27.559, 53.9006],
          [27.5615, 53.9045],
        ]);
      });

      await waitFor(() => {
        expect(result.current.points).toHaveLength(2);
      });

      const routePointsRef1 = result.current.routePoints;

      // Rerender without changing points
      rerender({});

      const routePointsRef2 = result.current.routePoints;

      // Should be the same reference (memoized)
      expect(routePointsRef1).toBe(routePointsRef2);
    });
  });
});

