import React, { useEffect, useRef } from 'react';
import { render, waitFor } from '@testing-library/react-native';

import { useRouteBuilding } from '@/components/MapPage/Map/useRouteBuilding';
import { useRouteStore } from '@/stores/routeStore';

const start = { lat: 53.9, lng: 27.56 };
const end = { lat: 53.91, lng: 27.57 };

function HookHost() {
  useRouteBuilding(); // attaches effects to the store

  // Use a stable ref to avoid subscribing the component to store updates
  const storeRef = useRef(useRouteStore.getState());

  useEffect(() => {
    const store = storeRef.current;
    store.clearRoute();
    store.addPoint(start, 'start');
    store.addPoint(end, 'end');
  }, []);

  return null;
}

describe('useRouteBuilding', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    useRouteStore.getState().clearRoute();
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('builds a route via OSRM when two points are set', async () => {
    const mockResponse = {
      routes: [
        {
          distance: 1234,
          duration: 567,
          geometry: {
            coordinates: [
              [start.lng, start.lat],
              [end.lng, end.lat],
            ],
          },
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
      text: async () => '',
    } as any);

    render(<HookHost />);

    await waitFor(() => {
      const route = useRouteStore.getState().route;
      expect(route).not.toBeNull();
      expect(route?.coordinates.length).toBeGreaterThanOrEqual(2);
    });

    const route = useRouteStore.getState().route!;
    expect(route.distance).toBe(1234);
    expect(route.isOptimal).toBe(true);
    expect(useRouteStore.getState().error).toBeNull();
  });

  it('falls back to direct line and sets error when routing fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));

    render(<HookHost />);

    await waitFor(() => {
      const route = useRouteStore.getState().route;
      expect(route).not.toBeNull();
    });

    const route = useRouteStore.getState().route!;
    expect(route.isOptimal).toBe(false);
    expect(route.coordinates).toHaveLength(2);
    expect(useRouteStore.getState().error).toBeDefined();
  });
});
