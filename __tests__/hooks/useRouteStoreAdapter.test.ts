/**
 * Tests for useRouteStoreAdapter hook
 */
import { renderHook, act } from '@testing-library/react-native';
import { useRouteStoreAdapter } from '@/hooks/useRouteStoreAdapter';
import { useRouteStore } from '@/stores/routeStore';

// Mock CoordinateConverter
jest.mock('@/utils/coordinateConverter', () => ({
  CoordinateConverter: {
    formatCoordinates: (coords: { lat: number; lng: number }) =>
      `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
  },
}));

// Mock zustand store
jest.mock('@/stores/routeStore');

describe('useRouteStoreAdapter', () => {
  let mockStore: any;

  beforeEach(() => {
    // Reset mock store before each test
    mockStore = {
      mode: 'radius',
      transportMode: 'car',
      points: [],
      route: null,
      isBuilding: false,
      error: null,
      setMode: jest.fn(),
      setTransportMode: jest.fn(),
      addPoint: jest.fn(),
      removePoint: jest.fn(),
      clearRoute: jest.fn(),
      setRoute: jest.fn(),
      getStartPoint: jest.fn(() => null),
      getEndPoint: jest.fn(() => null),
      swapStartEnd: jest.fn(),
    };

    ;(useRouteStore as unknown as jest.Mock).mockReturnValue(mockStore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('State mapping', () => {
    it('should map basic store state correctly', () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      expect(result.current.mode).toBe('radius');
      expect(result.current.transportMode).toBe('car');
      expect(result.current.isBuilding).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should convert RoutePoint[] to [lng, lat][] format', () => {
      mockStore.points = [
        { id: '1', coordinates: { lat: 53.9, lng: 27.56 }, address: 'Point 1', type: 'start' },
        { id: '2', coordinates: { lat: 54.0, lng: 28.0 }, address: 'Point 2', type: 'end' },
      ];

      const { result } = renderHook(() => useRouteStoreAdapter());

      expect(result.current.routePoints).toEqual([
        [27.56, 53.9],
        [28.0, 54.0],
      ]);
    });

    it('should return empty array when no points', () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      expect(result.current.routePoints).toEqual([]);
    });
  });

  describe('Addresses', () => {
    it('should return start address', () => {
      mockStore.getStartPoint.mockReturnValue({
        id: '1',
        coordinates: { lat: 53.9, lng: 27.56 },
        address: 'Start Address',
        type: 'start',
      });

      const { result } = renderHook(() => useRouteStoreAdapter());

      expect(result.current.startAddress).toBe('Start Address');
    });

    it('should return empty string when no start point', () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      expect(result.current.startAddress).toBe('');
    });

    it('should return end address', () => {
      mockStore.getEndPoint.mockReturnValue({
        id: '2',
        coordinates: { lat: 54.0, lng: 28.0 },
        address: 'End Address',
        type: 'end',
      });

      const { result } = renderHook(() => useRouteStoreAdapter());

      expect(result.current.endAddress).toBe('End Address');
    });
  });

  describe('setRoutePoints', () => {
    it('should add points correctly when given valid [lng, lat][] array', () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      const points: [number, number][] = [
        [27.56, 53.9],
        [28.0, 54.0],
      ];

      act(() => {
        result.current.setRoutePoints(points);
      });

      expect(mockStore.clearRoute).toHaveBeenCalledTimes(1);
      expect(mockStore.addPoint).toHaveBeenCalledTimes(2);

      expect(mockStore.addPoint).toHaveBeenNthCalledWith(
        1,
        { lat: 53.9, lng: 27.56 },
        '53.9000, 27.5600'
      );

      expect(mockStore.addPoint).toHaveBeenNthCalledWith(
        2,
        { lat: 54.0, lng: 28.0 },
        '54.0000, 28.0000'
      );
    });

    it('should not add points if array is empty', () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      act(() => {
        result.current.setRoutePoints([]);
      });

      expect(mockStore.clearRoute).toHaveBeenCalledTimes(1);
      expect(mockStore.addPoint).not.toHaveBeenCalled();
    });

    it('should not add points if not an array', () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      act(() => {
        result.current.setRoutePoints(null as any);
      });

      expect(mockStore.clearRoute).not.toHaveBeenCalled();
      expect(mockStore.addPoint).not.toHaveBeenCalled();
    });

    it('should skip invalid point formats', () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      const points: any[] = [
        [27.56, 53.9], // valid
        [28.0], // invalid - only one coordinate
        'invalid', // invalid - not an array
        [29.0, 55.0], // valid
      ];

      act(() => {
        result.current.setRoutePoints(points);
      });

      expect(mockStore.clearRoute).toHaveBeenCalledTimes(1);
      expect(mockStore.addPoint).toHaveBeenCalledTimes(2); // Only valid points
    });

    it('should skip NaN coordinates', () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      const points: [number, number][] = [
        [27.56, 53.9], // valid
        [NaN, 54.0], // invalid - NaN lng
        [28.0, NaN], // invalid - NaN lat
        [29.0, 55.0], // valid
      ];

      act(() => {
        result.current.setRoutePoints(points);
      });

      expect(mockStore.addPoint).toHaveBeenCalledTimes(2); // Only valid points
    });
  });

  describe('handleAddressSelect', () => {
    it('should add start point and remove existing start', () => {
      mockStore.getStartPoint.mockReturnValue({
        id: 'old-start',
        coordinates: { lat: 53.0, lng: 27.0 },
        address: 'Old Start',
        type: 'start',
      });

      const { result } = renderHook(() => useRouteStoreAdapter());

      act(() => {
        result.current.handleAddressSelect(
          'New Start Address',
          { lat: 53.9, lng: 27.56 },
          true // isStart
        );
      });

      expect(mockStore.removePoint).toHaveBeenCalledWith('old-start');
      expect(mockStore.addPoint).toHaveBeenCalledWith(
        { lat: 53.9, lng: 27.56 },
        'New Start Address'
      );
    });

    it('should add start point when no existing start', () => {
      mockStore.getStartPoint.mockReturnValue(null);

      const { result } = renderHook(() => useRouteStoreAdapter());

      act(() => {
        result.current.handleAddressSelect(
          'Start Address',
          { lat: 53.9, lng: 27.56 },
          true
        );
      });

      expect(mockStore.removePoint).not.toHaveBeenCalled();
      expect(mockStore.addPoint).toHaveBeenCalledWith(
        { lat: 53.9, lng: 27.56 },
        'Start Address'
      );
    });

    it('should add end point', () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      act(() => {
        result.current.handleAddressSelect(
          'End Address',
          { lat: 54.0, lng: 28.0 },
          false // isStart
        );
      });

      expect(mockStore.addPoint).toHaveBeenCalledWith(
        { lat: 54.0, lng: 28.0 },
        'End Address'
      );
    });
  });

  describe('setFullRouteCoords', () => {
    it('should convert [lng, lat][] to LatLng[] and set route', () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      const coords: [number, number][] = [
        [27.56, 53.9],
        [27.57, 53.91],
        [27.58, 53.92],
      ];

      act(() => {
        result.current.setFullRouteCoords(coords);
      });

      expect(mockStore.setRoute).toHaveBeenCalledWith({
        coordinates: [
          { lat: 53.9, lng: 27.56 },
          { lat: 53.91, lng: 27.57 },
          { lat: 53.92, lng: 27.58 },
        ],
        distance: 0,
        duration: 0,
        isOptimal: true,
      });
    });

    it('should not update if route coordinates are the same', () => {
      mockStore.route = {
        coordinates: [
          { lat: 53.9, lng: 27.56 },
          { lat: 54.0, lng: 28.0 },
        ],
        distance: 0,
        duration: 0,
        isOptimal: true,
      };

      const { result } = renderHook(() => useRouteStoreAdapter());

      const coords: [number, number][] = [
        [27.56, 53.9],
        [28.0, 54.0],
      ];

      act(() => {
        result.current.setFullRouteCoords(coords);
      });

      expect(mockStore.setRoute).not.toHaveBeenCalled();
    });
  });

  describe('setRouteDistance', () => {
    it('should set route with distance', () => {
      mockStore.points = [
        { id: '1', coordinates: { lat: 53.9, lng: 27.56 }, address: 'Start', type: 'start' },
        { id: '2', coordinates: { lat: 54.0, lng: 28.0 }, address: 'End', type: 'end' },
      ];

      const { result } = renderHook(() => useRouteStoreAdapter());

      act(() => {
        result.current.setRouteDistance(12500); // 12.5 km
      });

      expect(mockStore.setRoute).toHaveBeenCalledWith({
        coordinates: [
          { lat: 53.9, lng: 27.56 },
          { lat: 54.0, lng: 28.0 },
        ],
        distance: 12500,
        duration: 0,
        isOptimal: true,
      });
    });

    it('should not update if distance is the same', () => {
      mockStore.route = {
        coordinates: [{ lat: 53.9, lng: 27.56 }],
        distance: 12500,
        duration: 0,
        isOptimal: true,
      };

      const { result } = renderHook(() => useRouteStoreAdapter());

      act(() => {
        result.current.setRouteDistance(12500);
      });

      expect(mockStore.setRoute).not.toHaveBeenCalled();
    });
  });

  describe('handleClearRoute', () => {
    it('should call store.clearRoute', () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      act(() => {
        result.current.handleClearRoute();
      });

      expect(mockStore.clearRoute).toHaveBeenCalledTimes(1);
    });
  });

  describe('Direct store actions', () => {
    it('should expose store actions directly', () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      expect(result.current.setMode).toBe(mockStore.setMode);
      expect(result.current.setTransportMode).toBe(mockStore.setTransportMode);
      expect(result.current.addPoint).toBe(mockStore.addPoint);
      expect(result.current.removePoint).toBe(mockStore.removePoint);
      expect(result.current.clearRoute).toBe(mockStore.clearRoute);
      expect(result.current.swapStartEnd).toBe(mockStore.swapStartEnd);
    });

    it('should expose store state directly', () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      expect(result.current.points).toBe(mockStore.points);
      expect(result.current.route).toBe(mockStore.route);
    });
  });

  describe('Route data conversion', () => {
    it('should convert route coordinates to [lng, lat][] format', () => {
      mockStore.route = {
        coordinates: [
          { lat: 53.9, lng: 27.56 },
          { lat: 53.91, lng: 27.57 },
          { lat: 53.92, lng: 27.58 },
        ],
        distance: 5000,
        duration: 300,
        isOptimal: true,
      };

      const { result } = renderHook(() => useRouteStoreAdapter());

      expect(result.current.fullRouteCoords).toEqual([
        [27.56, 53.9],
        [27.57, 53.91],
        [27.58, 53.92],
      ]);
    });

    it('should return empty array when no route', () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      expect(result.current.fullRouteCoords).toEqual([]);
    });

    it('should return route distance', () => {
      mockStore.route = {
        coordinates: [],
        distance: 12500,
        duration: 600,
        isOptimal: true,
      };

      const { result } = renderHook(() => useRouteStoreAdapter());

      expect(result.current.routeDistance).toBe(12500);
    });

    it('should return null when no route distance', () => {
      const { result } = renderHook(() => useRouteStoreAdapter());

      expect(result.current.routeDistance).toBe(null);
    });
  });
});

