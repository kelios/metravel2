/**
 * Тесты безопасности для useRouting хука
 * Проверяют обработку невалидных данных, rate limiting и retry логику
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRouting, clearResolvedRouteKeys } from '@/components/MapPage/useRouting';
import { routeCache } from '@/utils/routeCache';

// Mock fetch globally
global.fetch = jest.fn();

describe('useRouting - Safety Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearResolvedRouteKeys();
    routeCache.clear();
    (global.fetch as jest.Mock).mockReset();
  });

  describe('Invalid Route Points', () => {
    it('handles empty route points array', async () => {
      const { result } = await renderHook(() =>
        useRouting([], 'car', 'test-api-key')
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(false);
      expect(result.current.distance).toBe(0);
      expect(result.current.coords).toEqual([]);
    });

    it('handles single route point', async () => {
      const { result } = await renderHook(() =>
        useRouting([[27.56, 53.9]], 'car', 'test-api-key')
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(false);
    });

    it('handles invalid coordinates (NaN)', async () => {
      const { result } = await renderHook(() =>
        useRouting(
          [
            [NaN, 53.9],
            [27.6, 53.95],
          ],
          'car',
          'test-api-key'
        )
      );

      // Хук должен обработать невалидные координаты
      expect(result.current).toBeDefined();
    });

    it('handles invalid coordinates (Infinity)', async () => {
      const { result } = await renderHook(() =>
        useRouting(
          [
            [Infinity, 53.9],
            [27.6, 53.95],
          ],
          'car',
          'test-api-key'
        )
      );

      expect(result.current).toBeDefined();
    });

    it('handles out-of-range coordinates', async () => {
      const { result } = await renderHook(() =>
        useRouting(
          [
            [181, 53.9], // invalid longitude
            [27.6, 91], // invalid latitude
          ],
          'car',
          'test-api-key'
        )
      );

      expect(result.current).toBeDefined();
    });
  });

  describe('API Key Validation', () => {
    it('handles missing API key', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValue('Forbidden'),
      });

      const { result } = await renderHook(() =>
        useRouting(
          [
            [27.56, 53.9],
            [27.6, 53.95],
          ],
          'car',
          undefined
        )
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('handles invalid API key', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        text: jest.fn().mockResolvedValue('Invalid API key'),
      });

      const { result } = await renderHook(() =>
        useRouting(
          [
            [27.56, 53.9],
            [27.6, 53.95],
          ],
          'car',
          'invalid-key'
        )
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('handles short API key', async () => {
      const { result } = await renderHook(() =>
        useRouting(
          [
            [27.56, 53.9],
            [27.6, 53.95],
          ],
          'car',
          'short'
        )
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Network Error Handling', () => {
    it('retries ORS with radiuses when error.code=2010 (no routable point)', async () => {
      // First call: canonical server routing endpoint fails, so the hook
      // falls back to client-side ORS.
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: jest.fn().mockResolvedValue(''),
        })
        // Second call: ORS 404 with code=2010 and coordinate index 0
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: jest.fn().mockResolvedValue(
            JSON.stringify({
              error: {
                code: 2010,
                message:
                  'Could not find routable point within a radius of 350.0 meters of specified coordinate 0: 20.1805115 50.2621317.',
              },
            })
          ),
        })
        // Third call: ORS ok
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            features: [
              {
                geometry: {
                  coordinates: [
                    [27.56, 53.9],
                    [27.6, 53.95],
                  ],
                },
                properties: {
                  summary: { distance: 5000, duration: 0 },
                },
              },
            ],
          }),
        });

      await renderHook(() =>
        useRouting(
          [
            [20.1805115, 50.2621317],
            [20.1502991, 50.3375723],
          ],
          'foot',
          'test-api-key-long-enough'
        )
      );

      await waitFor(() => {
        expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(3);
      });

      const thirdCall = (global.fetch as jest.Mock).mock.calls[2];
      const options = thirdCall?.[1] as any;
      const body = JSON.parse(String(options?.body || '{}'));
      expect(Array.isArray(body.radiuses)).toBe(true);
      expect(body.radiuses.length).toBe(2);
      // coordinate index 0 should be bumped above the default 350
      expect(body.radiuses[0]).toBeGreaterThan(350);
    });

    it('handles network timeout', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 100)
          )
      );

      const { result } = await renderHook(() =>
        useRouting(
          [
            [27.56, 53.9],
            [27.6, 53.95],
          ],
          'car',
          'test-api-key-long-enough'
        )
      );

      await waitFor(
        () => {
          expect(result.current.loading).toBe(false);
        },
        { timeout: 5000 }
      );
    });

    it('handles 429 rate limit error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        text: jest.fn().mockResolvedValue('Too many requests'),
      });

      const { result } = await renderHook(() =>
        useRouting(
          [
            [27.56, 53.9],
            [27.6, 53.95],
          ],
          'car',
          'test-api-key-long-enough'
        )
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toContain('лимит');
      });
    });

    it('handles 400 bad request error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue('Bad request'),
      });

      const { result } = await renderHook(() =>
        useRouting(
          [
            [27.56, 53.9],
            [27.6, 53.95],
          ],
          'car',
          'test-api-key-long-enough'
        )
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toContain('координаты');
      });
    });

    it('handles 500 server error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue('Internal server error'),
      });

      const { result } = await renderHook(() =>
        useRouting(
          [
            [27.56, 53.9],
            [27.6, 53.95],
          ],
          'car',
          'test-api-key-long-enough'
        )
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Response Validation', () => {
    it('accepts a legacy routed server response without is_optimal', async () => {
      const points: [number, number][] = [
        [26.25, 55.998381],
        [26.274319, 55.993965],
      ];
      const routedGeometry: [number, number][] = [
        points[0],
        [26.258, 55.996],
        points[1],
      ];

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          geometry: routedGeometry,
          distance_m: 2100,
          duration_s: 510,
          provider: 'ors',
        }),
      });

      const { result } = await renderHook(() => useRouting(points, 'car', undefined));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe(false);
        expect(result.current.coords).toEqual(routedGeometry);
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(routeCache.get(points, 'car')?.coords).toEqual(routedGeometry);
    });

    it('continues to OSRM when the server returns a direct-line fallback', async () => {
      const points: [number, number][] = [
        [26.25, 55.998381],
        [26.274319, 55.993965],
      ];
      const routedGeometry: [number, number][] = [
        points[0],
        [26.258, 55.996],
        [26.267, 55.9945],
        points[1],
      ];

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            geometry: points,
            distance_m: 1628,
            duration_s: 388,
            provider: 'direct',
            is_optimal: false,
            fallback_reason: 'routing_provider_unavailable',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            routes: [{
              geometry: { coordinates: routedGeometry },
              distance: 2100,
              duration: 510,
            }],
          }),
        });

      const { result } = await renderHook(() => useRouting(points, 'car', undefined));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe(false);
        expect(result.current.coords).toEqual(routedGeometry);
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(routeCache.get(points, 'car')?.coords).toEqual(routedGeometry);
    });

    it('keeps a server direct-line fallback degraded when every provider fails', async () => {
      const points: [number, number][] = [
        [26.25, 55.998381],
        [26.274319, 55.993965],
      ];

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            geometry: points,
            distance_m: 1628,
            duration_s: 388,
            provider: 'direct',
            is_optimal: false,
            fallback_reason: 'routing_provider_unavailable',
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: jest.fn().mockResolvedValue('OSRM unavailable'),
        });

      const { result } = await renderHook(() => useRouting(points, 'car', undefined));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeTruthy();
        expect(result.current.coords).toEqual(points);
      });

      expect(routeCache.get(points, 'car')).toBeNull();
    });

    it('handles empty response', async () => {
      jest.useFakeTimers();
      const points: [number, number][] = [[27.56, 53.9], [27.6, 53.95]];
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });
      try {
        const hook = await renderHook(() => useRouting(points, 'car', 'test-api-key-long-enough'));
        try {
          // Settle the real debounce and ORS retry/backoff chain before inspecting
          // the terminal fallback. Awaited renderHook no longer exposes a pre-effect false state.
          await act(async () => { await jest.runAllTimersAsync(); });
          expect(global.fetch).toHaveBeenCalledTimes(5); // server, ORS × 3, OSRM
          expect(hook.result.current.loading).toBe(false);
          expect(hook.result.current.error).toEqual(expect.any(String));
          expect(hook.result.current.coords).toEqual(points);
          expect(hook.result.current.isOptimal).toBe(false);
          expect(routeCache.get(points, 'car')).toBeNull();
        } finally {
          await hook.unmount();
        }
      } finally {
        jest.useRealTimers();
      }
    });

    it('handles malformed JSON response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      const { result } = await renderHook(() =>
        useRouting(
          [
            [27.56, 53.9],
            [27.6, 53.95],
          ],
          'car',
          'test-api-key-long-enough'
        )
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('handles response with missing coordinates', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          features: [
            {
              geometry: {
                coordinates: [],
              },
            },
          ],
        }),
      });

      const { result } = await renderHook(() =>
        useRouting(
          [
            [27.56, 53.9],
            [27.6, 53.95],
          ],
          'car',
          'test-api-key-long-enough'
        )
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('Cleanup and Memory Leaks', () => {
    it('cancels pending requests on unmount', async () => {
      let requestSignal: AbortSignal | undefined;
      (global.fetch as jest.Mock).mockImplementation((_url, init) => {
        requestSignal = init?.signal;
        return new Promise(() => {}); // Never resolves
      });

      const { unmount } = await renderHook(() =>
        useRouting(
          [
            [27.56, 53.9],
            [27.6, 53.95],
          ],
          'car',
          'test-api-key-long-enough'
        )
      );

      await waitFor(() => expect(global.fetch).toHaveBeenCalled());
      expect(requestSignal?.aborted).toBe(false);

      await unmount();

      expect(requestSignal?.aborted).toBe(true);
    });

    it('handles rapid route changes', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          features: [
            {
              geometry: {
                coordinates: [
                  [27.56, 53.9],
                  [27.6, 53.95],
                ],
              },
              properties: {
                summary: { distance: 5000 },
              },
            },
          ],
        }),
      });

      const { rerender } = await renderHook(
        ({ points }) => useRouting(points, 'car', 'test-api-key-long-enough'),
        {
          initialProps: {
            points: [
              [27.56, 53.9],
              [27.6, 53.95],
            ] as [number, number][],
          },
        }
      );

      // Быстрые изменения маршрута
      for (let i = 0; i < 5; i++) {
        await rerender({
          points: [
            [27.56 + i * 0.01, 53.9],
            [27.6 + i * 0.01, 53.95],
          ],
        });
      }

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });

  describe('Caching behavior', () => {
    it.each([400, 500])(
      'does not cache a direct-line fallback after provider status %s',
      async (status) => {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status,
          text: jest.fn().mockResolvedValue(`routing failed: ${status}`),
        });

        const points: [number, number][] = [
          [27.56, 53.9],
          [27.6, 53.95],
        ];

        const first = await renderHook(() => useRouting(points, 'car', undefined));

        await waitFor(() => {
          expect(first.result.current.loading).toBe(false);
          expect(first.result.current.error).toBeTruthy();
          expect(first.result.current.coords).toEqual(points);
        });

        expect(routeCache.get(points, 'car')).toBeNull();
        const callsAfterFirstFailure = (global.fetch as jest.Mock).mock.calls.length;
        await first.unmount();

        const second = await renderHook(() => useRouting(points, 'car', undefined));

        await waitFor(() => {
          expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(
            callsAfterFirstFailure
          );
          expect(second.result.current.error).toBeTruthy();
        });

        await second.unmount();
      }
    );

    it('does not refetch when the same route is rendered again and cached', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          features: [
            {
              geometry: {
                coordinates: [
                  [27.56, 53.9],
                  [27.6, 53.95],
                ],
              },
              properties: {
                summary: { distance: 5000, duration: 0 },
              },
            },
          ],
        }),
      });

      const points: [number, number][] = [
        [27.56, 53.9],
        [27.6, 53.95],
      ];

      const { rerender, result } = await renderHook(
        ({ pts }) => useRouting(pts, 'foot', 'test-api-key-long-enough'),
        { initialProps: { pts: points } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.coords.length).toBeGreaterThanOrEqual(2);
      });

      const firstCalls = (global.fetch as jest.Mock).mock.calls.length;
      expect(firstCalls).toBeGreaterThanOrEqual(1);

      // Re-render with same points (should use cache and return without scheduling a new fetch)
      await rerender({ pts: points });
      await new Promise((r) => setTimeout(r, 30));

      const afterCalls = (global.fetch as jest.Mock).mock.calls.length;
      expect(afterCalls).toBe(firstCalls);
    });
  });

  describe('Transport Mode Changes', () => {
    it('handles transport mode change with same points', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          features: [
            {
              geometry: {
                coordinates: [
                  [27.56, 53.9],
                  [27.6, 53.95],
                ],
              },
              properties: {
                summary: { distance: 5000 },
              },
            },
          ],
        }),
      });

      const points: [number, number][] = [
        [27.56, 53.9],
        [27.6, 53.95],
      ];

      const { rerender, result } = await renderHook(
        ({ mode }) => useRouting(points, mode, 'test-api-key-long-enough'),
        {
          initialProps: { mode: 'car' as const },
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Меняем режим транспорта
      await rerender({ mode: 'bike' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Меняем на пеший режим
      await rerender({ mode: 'foot' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });
});

describe('useRouting - shared bounded Valhalla fallback', () => {
  const first: [number, number] = [19.9383, 50.0614];
  const second: [number, number] = [19.9091, 50.0751];
  const forward = 'odon~Aw~|_e@gwY~_x@';
  const backward = 'w|io~Aw}c~d@fwY_`x@';
  const makePoints = (count: number): [number, number][] =>
    Array.from({ length: count }, (_, index) => index % 2 ? [...second] : [...first]);

  beforeEach(() => {
    jest.clearAllMocks();
    clearResolvedRouteKeys();
    routeCache.clear();
    jest.mocked(global.fetch).mockReset();
  });

  it.each(['foot', 'bike'] as const)('routes and caches all twelve %s waypoints through the shared provider primitive', async (mode) => {
    const points = makePoints(12);
    const requests: Array<{ locations: Array<{ lon: number; lat: number }>; costing: string }> = [];
    jest.mocked(global.fetch).mockImplementation(async (url) => {
      if (String(url).includes('valhalla1.openstreetmap.de')) {
        const body = JSON.parse(new URL(String(url)).searchParams.get('json')!);
        requests.push(body);
        return {
          ok: true,
          json: async () => ({ trip: {
            legs: body.locations.slice(1).map((_point: unknown, index: number) => ({
              shape: body.locations[index].lon === first[0] ? forward : backward,
            })),
            summary: { length: (body.locations.length - 1) * 0.123, time: (body.locations.length - 1) * 17 },
          } }),
        } as Response;
      }
      return { ok: false, status: 503, text: async () => 'unavailable' } as Response;
    });

    const { result, unmount } = await renderHook(() => useRouting(points, mode, undefined));
    await waitFor(() => {
      expect(result.current.coords).toEqual(points);
      expect(result.current.loading).toBe(false);
      expect(result.current.isOptimal).toBe(true);
    });

    expect(requests.map(({ locations }) => locations.length)).toEqual([10, 3]);
    expect(requests.map(({ costing }) => costing)).toEqual([mode === 'bike' ? 'bicycle' : 'pedestrian', mode === 'bike' ? 'bicycle' : 'pedestrian']);
    expect(result.current.distance).toBeCloseTo(1353);
    expect(result.current.duration).toBe(187);
    expect(result.current.error).toBe(false);
    expect(routeCache.get(points, mode)?.coords).toEqual(points);
    expect(global.fetch).toHaveBeenCalledTimes(3); // server + both complete provider chunks
    await unmount();
  });

  it('never caches a partial route when a later Valhalla chunk fails', async () => {
    const points = makePoints(20);
    let valhallaRequests = 0;
    jest.mocked(global.fetch).mockImplementation(async (url) => {
      if (String(url).includes('valhalla1.openstreetmap.de')) {
        valhallaRequests += 1;
        if (valhallaRequests === 1) {
          return {
            ok: true,
            json: async () => ({ trip: {
              legs: Array.from({ length: 9 }, (_, index) => ({ shape: index % 2 ? backward : forward })),
              summary: { length: 1.107, time: 153 },
            } }),
          } as Response;
        }
      }
      return { ok: false, status: 503, text: async () => 'unavailable' } as Response;
    });

    const { result, unmount } = await renderHook(() => useRouting(points, 'foot', undefined));
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
      expect(result.current.loading).toBe(false);
    });
    expect(valhallaRequests).toBe(2); // the third chunk was never requested
    expect(result.current.coords).toEqual(points);
    expect(result.current.isOptimal).toBe(false);
    expect(routeCache.get(points, 'foot')).toBeNull();
    await unmount();
  });
});
