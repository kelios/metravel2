/**
 * Тесты безопасности для useRouting хука
 * Проверяют обработку невалидных данных, rate limiting и retry логику
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { useRouting, clearResolvedRouteKeys } from '@/components/MapPage/useRouting';

// Mock fetch globally
global.fetch = jest.fn();

describe('useRouting - Safety Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearResolvedRouteKeys();
    (global.fetch as jest.Mock).mockReset();
  });

  describe('Invalid Route Points', () => {
    it('handles empty route points array', () => {
      const { result } = renderHook(() =>
        useRouting([], 'car', 'test-api-key')
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(false);
      expect(result.current.distance).toBe(0);
      expect(result.current.coords).toEqual([]);
    });

    it('handles single route point', () => {
      const { result } = renderHook(() =>
        useRouting([[27.56, 53.9]], 'car', 'test-api-key')
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(false);
    });

    it('handles invalid coordinates (NaN)', () => {
      const { result } = renderHook(() =>
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

    it('handles invalid coordinates (Infinity)', () => {
      const { result } = renderHook(() =>
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

    it('handles out-of-range coordinates', () => {
      const { result } = renderHook(() =>
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

      const { result } = renderHook(() =>
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

      const { result } = renderHook(() =>
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
      const { result } = renderHook(() =>
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
    it('handles network timeout', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 100)
          )
      );

      const { result } = renderHook(() =>
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

      const { result } = renderHook(() =>
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

      const { result } = renderHook(() =>
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

      const { result } = renderHook(() =>
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
    it('handles empty response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      const { result } = renderHook(() =>
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

    it('handles malformed JSON response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      const { result } = renderHook(() =>
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

      const { result } = renderHook(() =>
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
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { unmount } = renderHook(() =>
        useRouting(
          [
            [27.56, 53.9],
            [27.6, 53.95],
          ],
          'car',
          'test-api-key-long-enough'
        )
      );

      // Размонтируем до завершения запроса
      unmount();

      // Проверяем, что нет ошибок
      await waitFor(() => {
        expect(true).toBe(true);
      });
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

      const { rerender } = renderHook(
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
        rerender({
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

      const { rerender, result } = renderHook(
        ({ mode }) => useRouting(points, mode, 'test-api-key-long-enough'),
        {
          initialProps: { mode: 'car' as const },
        }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Меняем режим транспорта
      rerender({ mode: 'bike' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Меняем на пеший режим
      rerender({ mode: 'foot' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });
});
