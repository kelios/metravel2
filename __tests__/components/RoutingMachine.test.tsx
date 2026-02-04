import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import RoutingMachine from '../../components/MapPage/RoutingMachine';
import { clearResolvedRouteKeys } from '../../components/MapPage/useRouting';

// Mock fetch
global.fetch = jest.fn();

describe('RoutingMachine', () => {
  const mockSetRoutingLoading = jest.fn();
  const mockSetErrors = jest.fn();
  const mockSetRouteDistance = jest.fn();
  const mockSetFullRouteCoords = jest.fn();

  const defaultProps: any = {
    routePoints: [[27.5590, 53.9006], [27.5700, 53.9100]] as [number, number][],
    transportMode: 'car' as const,
    setRoutingLoading: mockSetRoutingLoading,
    setErrors: mockSetErrors,
    setRouteDistance: mockSetRouteDistance,
    setFullRouteCoords: mockSetFullRouteCoords,
    ORS_API_KEY: undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
    // Clear route cache to prevent rate limiting in tests
    const { routeCache } = require('@/src/utils/routeCache');
    routeCache.clear();
    clearResolvedRouteKeys();
  });

  it('should render without crashing', () => {
    render(<RoutingMachine {...defaultProps} />);
    // Component renders successfully with 2 route points
    expect(mockSetRoutingLoading).toHaveBeenCalledWith(true);
  });

  it('should not call setRoutingLoading when less than 2 points', async () => {
    const props = {
      ...defaultProps,
      routePoints: [[27.5590, 53.9006]],
    };

    render(<RoutingMachine {...props} />);

    await waitFor(() => {
      expect(mockSetRoutingLoading).not.toHaveBeenCalled();
    });
  });

  it('should call setRoutingLoading when routing starts', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{
          geometry: {
            coordinates: [[27.5590, 53.9006], [27.5700, 53.9100]],
          },
          distance: 5000,
        }],
      }),
    });

    render(<RoutingMachine {...defaultProps} />);

    await waitFor(() => {
      expect(mockSetRoutingLoading).toHaveBeenCalledWith(true);
    });
  });

  it('should call setRoutingLoading(false) when routing completes', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{
          geometry: {
            coordinates: [[27.5590, 53.9006], [27.5700, 53.9100]],
          },
          distance: 5000,
        }],
      }),
    });

    render(<RoutingMachine {...defaultProps} />);

    await waitFor(() => {
      expect(mockSetRoutingLoading).toHaveBeenCalledWith(false);
    }, { timeout: 3000 });
  });

  it('should set route distance when routing succeeds', async () => {
    const expectedDistance = 5000;
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{
          geometry: {
            coordinates: [[27.5590, 53.9006], [27.5700, 53.9100]],
          },
          distance: expectedDistance,
        }],
      }),
    });

    render(<RoutingMachine {...defaultProps} />);

    await waitFor(() => {
      expect(mockSetRouteDistance).toHaveBeenCalledWith(expectedDistance);
    }, { timeout: 3000 });
  });

  it('should set full route coordinates when routing succeeds', async () => {
    const expectedCoords = [[27.5590, 53.9006], [27.5700, 53.9100]];
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{
          geometry: {
            coordinates: expectedCoords,
          },
          distance: 5000,
        }],
      }),
    });

    render(<RoutingMachine {...defaultProps} />);

    await waitFor(() => {
      expect(mockSetFullRouteCoords).toHaveBeenCalledWith(expectedCoords);
    }, { timeout: 3000 });
  });

  it('should handle routing errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<RoutingMachine {...defaultProps} />);

    await waitFor(() => {
      const calls = mockSetErrors.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastArg = calls[calls.length - 1]?.[0];
      const nextState = typeof lastArg === 'function' ? lastArg({}) : lastArg;
      expect(nextState).toEqual(expect.objectContaining({
        routing: expect.any(String),
      }));
    }, { timeout: 3000 });
  });

  it('should not trigger routing for same route within 5 seconds', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{
          geometry: {
            coordinates: [[27.5590, 53.9006], [27.5700, 53.9100]],
          },
          distance: 5000,
        }],
      }),
    });

    const { rerender } = render(<RoutingMachine {...defaultProps} />);

    await waitFor(() => {
      expect(mockSetRoutingLoading).toHaveBeenCalledWith(true);
    });

    // Ensure we only made a single routing request so far.
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    jest.clearAllMocks();

    // Re-render with same props
    rerender(<RoutingMachine {...defaultProps} />);

    // Should not trigger another routing request (component may still sync loading=false).
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should clear polyline when route points are removed', async () => {
    const { rerender } = render(<RoutingMachine {...defaultProps} />);

    // Re-render with less than 2 points
    rerender(
      <RoutingMachine
        {...defaultProps}
        routePoints={[[27.5590, 53.9006]]}
      />
    );

    await waitFor(() => {
      const calls = mockSetErrors.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastArg = calls[calls.length - 1]?.[0];
      const nextState = typeof lastArg === 'function' ? lastArg({}) : lastArg;
      expect(nextState).toEqual({ routing: false });
      expect(mockSetRouteDistance).toHaveBeenCalledWith(0);
    });
  });

  it('should handle transport mode changes', async () => {
    const { routeCache } = require('@/src/utils/routeCache');
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{
          geometry: {
            coordinates: [[27.5590, 53.9006], [27.5700, 53.9100]],
          },
          distance: 5000,
        }],
      }),
    });

    const { rerender } = render(<RoutingMachine {...defaultProps} />);

    await waitFor(() => {
      expect(mockSetRoutingLoading).toHaveBeenCalledWith(true);
    });

    await waitFor(() => {
      expect(mockSetRoutingLoading).toHaveBeenCalledWith(false);
    });

    // Clear cache and mocks to allow new request
    routeCache.clear();
    jest.clearAllMocks();
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [{
          geometry: {
            coordinates: [[27.5590, 53.9006], [27.5700, 53.9100]],
          },
          distance: 4000,
        }],
      }),
    });

    // Change transport mode
    rerender(
      <RoutingMachine
        {...defaultProps}
        transportMode="bike"
      />
    );

    await waitFor(() => {
      expect(mockSetRoutingLoading).toHaveBeenCalledWith(true);
    }, { timeout: 3000 });
  });

  it('should abort previous request when new routing starts', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'development';

    const { routeCache } = require('@/src/utils/routeCache');
    jest.spyOn(routeCache, 'canMakeRequest').mockReturnValue(true);

    const abortSpy = jest.fn();
    const mockAbortController = {
      abort: abortSpy,
      signal: {},
    };

    global.AbortController = jest.fn(() => mockAbortController) as any;

    // Make first request hang so that the second routing attempt can abort it.
    let resolveFetch: ((value: any) => void) | undefined;
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      new Promise((resolve) => {
        resolveFetch = resolve as any;
      })
    );

    const { rerender } = render(<RoutingMachine {...defaultProps} />);

    await waitFor(() => {
      expect(mockSetRoutingLoading).toHaveBeenCalledWith(true);
    });

    // Change route points to trigger new routing
    rerender(
      <RoutingMachine
        {...defaultProps}
        routePoints={[[27.5590, 53.9006], [27.5800, 53.9200]]}
      />
    );

    await waitFor(() => {
      expect(abortSpy).toHaveBeenCalled();
    });

    // Resolve the hanging fetch to avoid unhandled promise / leaks.
    if (typeof resolveFetch === 'function') {
      resolveFetch({
        ok: true,
        json: async () => ({
          routes: [{
            geometry: {
              coordinates: [[27.5590, 53.9006], [27.5700, 53.9100]],
            },
            distance: 5000,
          }],
        }),
      });
    }

    ;(routeCache.canMakeRequest as jest.Mock).mockRestore?.();
    (process.env as any).NODE_ENV = prevNodeEnv;
  });
});
