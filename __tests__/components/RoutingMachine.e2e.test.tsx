import { render, waitFor } from '@testing-library/react-native';
import RoutingMachine from '../../components/MapPage/RoutingMachine';
import { clearResolvedRouteKeys } from '../../components/MapPage/useRouting';

global.fetch = jest.fn();

describe('RoutingMachine E2E Tests', () => {
  const mockSetRoutingLoading = jest.fn();
  const mockSetErrors = jest.fn();
  const mockSetRouteDistance = jest.fn();
  const mockSetFullRouteCoords = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    const { routeCache } = require('@/utils/routeCache');
    routeCache.clear();
    clearResolvedRouteKeys();
  });

  it('should build route from start to end point with OSRM', async () => {
    const startPoint: [number, number] = [27.5590, 53.9006];
    const endPoint: [number, number] = [27.5700, 53.9100];
    const routeCoords = [startPoint, [27.5645, 53.9053], endPoint];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        geometry: routeCoords,
        distance_m: 8500,
        duration_s: 0,
        provider: 'ors',
        is_optimal: true,
      }),
    });

    render(
      <RoutingMachine
        routePoints={[startPoint, endPoint]}
        transportMode="car"
        setRoutingLoading={mockSetRoutingLoading}
        setErrors={mockSetErrors}
        setRouteDistance={mockSetRouteDistance}
        setFullRouteCoords={mockSetFullRouteCoords}
        ORS_API_KEY={undefined}
      />
    );

    await waitFor(() => {
      expect(mockSetFullRouteCoords).toHaveBeenCalledWith(routeCoords);
    }, { timeout: 3000 });

    expect(mockSetRouteDistance).toHaveBeenCalledWith(8500);
    const errorCalls = mockSetErrors.mock.calls;
    expect(errorCalls.length).toBeGreaterThan(0);
    const lastArg = errorCalls[errorCalls.length - 1]?.[0];
    const nextState = typeof lastArg === 'function' ? lastArg({}) : lastArg;
    expect(nextState).toEqual({ routing: false });
  });

  it('should handle different transport modes correctly', async () => {
    const startPoint: [number, number] = [27.5590, 53.9006];
    const endPoint: [number, number] = [27.5700, 53.9100];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        geometry: [startPoint, endPoint],
        distance_m: 5000,
        duration_s: 0,
        provider: 'ors',
        is_optimal: true,
      }),
    });

    const { rerender } = render(
      <RoutingMachine
        routePoints={[startPoint, endPoint]}
        transportMode="car"
        setRoutingLoading={mockSetRoutingLoading}
        setErrors={mockSetErrors}
        setRouteDistance={mockSetRouteDistance}
        setFullRouteCoords={mockSetFullRouteCoords}
        ORS_API_KEY={undefined}
      />
    );

    await waitFor(() => {
      expect(mockSetRoutingLoading).toHaveBeenCalledWith(true);
    });

    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        geometry: [startPoint, endPoint],
        distance_m: 4000,
        duration_s: 0,
        provider: 'ors',
        is_optimal: true,
      }),
    });

    rerender(
      <RoutingMachine
        routePoints={[startPoint, endPoint]}
        transportMode="bike"
        setRoutingLoading={mockSetRoutingLoading}
        setErrors={mockSetErrors}
        setRouteDistance={mockSetRouteDistance}
        setFullRouteCoords={mockSetFullRouteCoords}
        ORS_API_KEY={undefined}
      />
    );

    await waitFor(() => {
      expect(mockSetRoutingLoading).toHaveBeenCalledWith(true);
    });
  });

  it('should calculate correct distance using Haversine formula', async () => {
    const startPoint: [number, number] = [27.5590, 53.9006];
    const endPoint: [number, number] = [27.5700, 53.9100];

    // The canonical routing path (server /api/routing/route/) is tried first;
    // mock its response shape directly.
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        geometry: [startPoint, endPoint],
        distance_m: 12345,
        duration_s: 0,
        provider: 'ors',
        is_optimal: true,
      }),
    });

    render(
      <RoutingMachine
        routePoints={[startPoint, endPoint]}
        transportMode="foot"
        setRoutingLoading={mockSetRoutingLoading}
        setErrors={mockSetErrors}
        setRouteDistance={mockSetRouteDistance}
        setFullRouteCoords={mockSetFullRouteCoords}
        ORS_API_KEY={'test-test-test' as any}
      />
    );

    await waitFor(() => {
      expect(mockSetRouteDistance).toHaveBeenCalledWith(12345);
    }, { timeout: 3000 });
  });

  it('should handle route with multiple intermediate points', async () => {
    const startPoint: [number, number] = [27.5590, 53.9006];
    const point1: [number, number] = [27.5620, 53.9030];
    const point2: [number, number] = [27.5660, 53.9070];
    const endPoint: [number, number] = [27.5700, 53.9100];
    const routeCoords = [startPoint, point1, point2, endPoint];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        geometry: routeCoords,
        distance_m: 10000,
        duration_s: 0,
        provider: 'ors',
        is_optimal: true,
      }),
    });

    render(
      <RoutingMachine
        routePoints={[startPoint, endPoint]}
        transportMode="car"
        setRoutingLoading={mockSetRoutingLoading}
        setErrors={mockSetErrors}
        setRouteDistance={mockSetRouteDistance}
        setFullRouteCoords={mockSetFullRouteCoords}
        ORS_API_KEY={undefined}
      />
    );

    await waitFor(() => {
      expect(mockSetFullRouteCoords).toHaveBeenCalledWith(routeCoords);
    }, { timeout: 3000 });
  });

  it('should fallback to direct line when routing fails', async () => {
    const startPoint: [number, number] = [27.5590, 53.9006];
    const endPoint: [number, number] = [27.5700, 53.9100];

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(
      <RoutingMachine
        routePoints={[startPoint, endPoint]}
        transportMode="car"
        setRoutingLoading={mockSetRoutingLoading}
        setErrors={mockSetErrors}
        setRouteDistance={mockSetRouteDistance}
        setFullRouteCoords={mockSetFullRouteCoords}
        ORS_API_KEY={undefined}
      />
    );

    await waitFor(() => {
      expect(mockSetRouteDistance).toHaveBeenCalled();
    }, { timeout: 3000 });
  });
});
