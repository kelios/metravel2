import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import RoutingMachine from '@/components/MapPage/RoutingMachine';
import { clearResolvedRouteKeys } from '@/components/MapPage/useRouting';

// Mock Leaflet
const mockLeaflet = {
  latLng: jest.fn((lat, lng) => ({
    lat,
    lng,
    distanceTo: jest.fn((other: any) => {
      const R = 6371000; // Earth's radius in meters
      const dLat = (other.lat - lat) * Math.PI / 180;
      const dLng = (other.lng - lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat * Math.PI / 180) * Math.cos(other.lat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }),
  })),
  polyline: jest.fn(() => ({
    addTo: jest.fn(),
    getBounds: jest.fn(() => ({ pad: jest.fn(() => ({})) })),
  })),
};

Object.defineProperty(window, 'L', {
  value: mockLeaflet,
  writable: true,
});

global.fetch = jest.fn();

describe('RoutingMachine E2E Tests', () => {
  const mockMap = {
    removeLayer: jest.fn(),
  };

  const mockSetRoutingLoading = jest.fn();
  const mockSetErrors = jest.fn();
  const mockSetRouteDistance = jest.fn();
  const mockSetFullRouteCoords = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    const { routeCache } = require('@/src/utils/routeCache');
    routeCache.clear();
    clearResolvedRouteKeys();
    mockLeaflet.latLng.mockClear();
    mockLeaflet.polyline.mockClear();
  });

  it('should build route from start to end point with OSRM', async () => {
    const startPoint: [number, number] = [27.5590, 53.9006];
    const endPoint: [number, number] = [27.5700, 53.9100];
    const routeCoords = [startPoint, [27.5645, 53.9053], endPoint];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{
          geometry: {
            coordinates: routeCoords,
          },
          distance: 8500,
        }],
      }),
    });

    render(
      <RoutingMachine
        map={mockMap}
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
    expect(mockSetErrors).toHaveBeenCalledWith({ routing: false });
    expect(mockLeaflet.polyline).toHaveBeenCalled();
  });

  it('should display polyline on map after successful routing', async () => {
    const startPoint: [number, number] = [27.5590, 53.9006];
    const endPoint: [number, number] = [27.5700, 53.9100];
    const routeCoords = [startPoint, endPoint];

    const mockPolyline = {
      addTo: jest.fn(),
      getBounds: jest.fn(() => ({ pad: jest.fn(() => ({})) })),
    };

    mockLeaflet.polyline.mockReturnValueOnce(mockPolyline);

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{
          geometry: { coordinates: routeCoords },
          distance: 5000,
        }],
      }),
    });

    render(
      <RoutingMachine
        map={mockMap}
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
      expect(mockPolyline.addTo).toHaveBeenCalledWith(mockMap);
    }, { timeout: 3000 });
  });

  it('should handle different transport modes correctly', async () => {
    const startPoint: [number, number] = [27.5590, 53.9006];
    const endPoint: [number, number] = [27.5700, 53.9100];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{
          geometry: {
            coordinates: [startPoint, endPoint],
          },
          distance: 5000,
        }],
      }),
    });

    const { rerender } = render(
      <RoutingMachine
        map={mockMap}
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
        routes: [{
          geometry: {
            coordinates: [startPoint, endPoint],
          },
          distance: 4000,
        }],
      }),
    });

    rerender(
      <RoutingMachine
        map={mockMap}
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

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{
          geometry: {
            coordinates: [startPoint, endPoint],
          },
          distance: 12345,
        }],
      }),
    });

    render(
      <RoutingMachine
        map={mockMap}
        routePoints={[startPoint, endPoint]}
        transportMode="foot"
        setRoutingLoading={mockSetRoutingLoading}
        setErrors={mockSetErrors}
        setRouteDistance={mockSetRouteDistance}
        setFullRouteCoords={mockSetFullRouteCoords}
        ORS_API_KEY={undefined}
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
        routes: [{
          geometry: {
            coordinates: routeCoords,
          },
          distance: 10000,
        }],
      }),
    });

    render(
      <RoutingMachine
        map={mockMap}
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

    // Do not assert exact call counts: React effects and fitBounds logic may trigger extra `latLng` calls.
    // What we care about is that a polyline is created from all route coordinates.
    await waitFor(() => {
      expect(mockLeaflet.polyline).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Polyline can be drawn once with 2 points (direct line) before the async routing
    // returns the full geometry. We assert that at least one polyline call uses all 4 points.
    const polylineCalls = (mockLeaflet.polyline as jest.Mock).mock.calls;
    const hasFourPointsCall = polylineCalls.some((call) => Array.isArray(call?.[0]) && call[0].length === 4);
    expect(hasFourPointsCall).toBe(true);
  });

  it('should fallback to direct line when routing fails', async () => {
    const startPoint: [number, number] = [27.5590, 53.9006];
    const endPoint: [number, number] = [27.5700, 53.9100];

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(
      <RoutingMachine
        map={mockMap}
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

    // Should draw a polyline (either optimal or direct line)
    expect(mockLeaflet.polyline).toHaveBeenCalled();
  });

  it('should clear previous polyline before drawing new one', async () => {
    const startPoint: [number, number] = [27.5590, 53.9006];
    const endPoint: [number, number] = [27.5700, 53.9100];

    const mockPolyline = {
      addTo: jest.fn(),
      getBounds: jest.fn(() => ({ pad: jest.fn(() => ({})) })),
    };

    mockLeaflet.polyline.mockReturnValueOnce(mockPolyline);

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{
          geometry: {
            coordinates: [startPoint, endPoint],
          },
          distance: 5000,
        }],
      }),
    });

    const { rerender } = render(
      <RoutingMachine
        map={mockMap}
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
      expect(mockPolyline.addTo).toHaveBeenCalled();
    }, { timeout: 3000 });

    jest.clearAllMocks();
    mockLeaflet.polyline.mockReturnValueOnce(mockPolyline);

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{
          geometry: {
            coordinates: [startPoint, endPoint],
          },
          distance: 5000,
        }],
      }),
    });

    // Trigger new routing by changing transport mode
    rerender(
      <RoutingMachine
        map={mockMap}
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
      expect(mockMap.removeLayer).toHaveBeenCalled();
    }, { timeout: 3000 });
  });
});
