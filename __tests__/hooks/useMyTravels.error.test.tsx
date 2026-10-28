// Сбой загрузки «Моих маршрутов» не должен выглядеть как пустой профиль.
// До этого fetchMyTravels вызывался без throwOnError: 5xx глотался в api-слое,
// возвращался [], и пользователь Play-сборки видел «маршрутов нет» вместо ошибки —
// без текста причины и без возможности повторить.

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook as renderQueryHook, waitFor, act } from '@testing-library/react-native';

jest.mock('@/hooks/useQueryOwner', () => ({ useQueryOwner: () => 'u-1' }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ isAuthenticated: Boolean('u-1'), userId: 'u-1' }) } }));

jest.mock('@/api/travelsApi', () => ({
  fetchMyTravels: jest.fn(),
  deleteTravel: jest.fn(),
  unwrapMyTravelsPayload: jest.requireActual('@/api/travelUserQueries').unwrapMyTravelsPayload,
}));

const mockShowToastMessage = jest.fn();
jest.mock('@/utils/toast', () => ({
  showToastMessage: (...args: unknown[]) => mockShowToastMessage(...args),
}));

import { useMyTravels } from '@/hooks/useMyTravels';
import { fetchMyTravels } from '@/api/travelsApi';
import { invalidateTravelCollections } from '@/utils/travelQueryInvalidation';

const mockFetchMyTravels = fetchMyTravels as jest.MockedFunction<typeof fetchMyTravels>;

const travelPayload = (ids: number[], total = ids.length) => ({
  data: ids.map((id) => ({ id, name: `Travel ${id}`, slug: `t-${id}`, url: `/travels/${id}` })),
  total,
});

const httpError = (status: number, statusText: string) => {
  const error = new Error(`Не удалось загрузить ваши маршруты: ${status} ${statusText}`) as Error & {
    status?: number;
  };
  error.status = status;
  return error;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useMyTravels — состояние ошибки первой страницы', () => {
  it('запрашивает первую страницу с throwOnError, иначе сбой не долетит до хука', async () => {
    mockFetchMyTravels.mockResolvedValue(travelPayload([1]) as any);

    const { result } = await renderHook(() => useMyTravels({ userId: 'u-1', perPage: 10 }));
    await act(async () => {
      await result.current.load();
    });

    expect(mockFetchMyTravels).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u-1', page: 1, throwOnError: true })
    );
  });

  it('на 502 выставляет error и не выдаёт пустой список за успешный ответ', async () => {
    mockFetchMyTravels.mockRejectedValue(httpError(502, 'Bad Gateway'));
    const onTotalChange = jest.fn();

    const { result } = await renderHook(() =>
      useMyTravels({ userId: 'u-1', perPage: 10, onTotalChange })
    );
    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Не удалось загрузить ваши маршруты: 502 Bad Gateway');
    });
    expect(result.current.myTravels).toEqual([]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.isLoading).toBe(false);
    // #1871: ноль здесь выдавал сбой сети за пустой профиль — счётчик потерян,
    // а не равен нулю.
    expect(onTotalChange).toHaveBeenCalledWith(null);
    expect(onTotalChange).not.toHaveBeenCalledWith(0);
  });

  it('успешная повторная загрузка гасит error и возвращает данные', async () => {
    mockFetchMyTravels.mockRejectedValueOnce(httpError(502, 'Bad Gateway'));

    const { result } = await renderHook(() => useMyTravels({ userId: 'u-1', perPage: 10 }));
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    mockFetchMyTravels.mockResolvedValueOnce(travelPayload([1, 2]) as any);
    await act(async () => {
      await result.current.load();
    });

    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.myTravels).toHaveLength(2);
  });

  it('сбой подгрузки следующей страницы не стирает уже показанные маршруты', async () => {
    mockFetchMyTravels.mockResolvedValueOnce(travelPayload([1, 2], 4) as any);

    const { result } = await renderHook(() => useMyTravels({ userId: 'u-1', perPage: 2 }));
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    mockFetchMyTravels.mockRejectedValueOnce(httpError(503, 'Service Unavailable'));
    await act(async () => {
      await result.current.loadMore();
    });

    // Список остаётся, автоподгрузка глушится, причина уходит в тост.
    expect(result.current.myTravels).toHaveLength(2);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockShowToastMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        text2: 'Не удалось загрузить ваши маршруты: 503 Service Unavailable',
      })
    );
  });

  it('сбрасывает error, когда пользователь разлогинился', async () => {
    mockFetchMyTravels.mockRejectedValue(httpError(500, 'Server Error'));

    const { result, rerender } = await renderHook(
      ({ userId }: { userId: string | null }) => useMyTravels({ userId, perPage: 10 }),
      { initialProps: { userId: 'u-1' as string | null } }
    );
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    await rerender({ userId: null });
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.error).toBeNull();
  });

  it('после ошибки фонового обновления не выдаёт старый отказ за актуальный список', async () => {
    mockFetchMyTravels.mockResolvedValueOnce(travelPayload([1]) as any);
    const onTotalChange = jest.fn();
    const { result } = await renderHook(() => useMyTravels({ userId: 'u-1', perPage: 10, onTotalChange }));
    await act(async () => { await result.current.load(); });
    await waitFor(() => expect(result.current.myTravels.map(t => t.id)).toEqual([1]));
    mockFetchMyTravels.mockRejectedValueOnce(httpError(503, 'Service Unavailable'));

    // Real invalidation refetches this already-visited mounted observer.
    await act(async () => { await invalidateTravelCollections([...queryClients].at(-1)!, 'u-1'); });
    await waitFor(() => expect(result.current.error).toContain('503'));
    expect(result.current.myTravels).toEqual([]);
    expect(result.current.publicationCounts).toBeNull();
    expect(onTotalChange).toHaveBeenLastCalledWith(null);

    mockFetchMyTravels.mockResolvedValueOnce(travelPayload([2]) as any);
    await act(async () => { await result.current.load(); });
    await waitFor(() => expect(result.current.myTravels.map(t => t.id)).toEqual([2]));
    expect(result.current.error).toBeNull();
    expect(onTotalChange).toHaveBeenLastCalledWith(1);
  });

  it('ошибка следующей страницы замораживает автоподгрузку до явного обновления', async () => {
    mockFetchMyTravels.mockResolvedValueOnce(travelPayload([1, 2], 4) as any);
    const { result } = await renderHook(() => useMyTravels({ userId: 'u-1', perPage: 2 }));
    await act(async () => { await result.current.load(); });
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    mockFetchMyTravels.mockRejectedValueOnce(httpError(503, 'Service Unavailable'));
    await act(async () => { await result.current.loadMore(); });
    await waitFor(() => expect(result.current.hasMore).toBe(false));
    const attempted = mockFetchMyTravels.mock.calls.length;
    await act(async () => { await result.current.loadMore(); });
    expect(mockFetchMyTravels).toHaveBeenCalledTimes(attempted);
    expect(result.current.myTravels.map(t => t.id)).toEqual([1, 2]);
    expect(result.current.error).toBeNull();

    mockFetchMyTravels.mockResolvedValueOnce(travelPayload([3, 4], 6) as any);
    await act(async () => { await result.current.load(); });
    await waitFor(() => expect(result.current.myTravels.map(t => t.id)).toEqual([3, 4]));
    expect(result.current.hasMore).toBe(true);
  });
});


// Isolated real QueryClient: cache lifecycle is part of the hook contract.
const queryClients = new Set<QueryClient>();
const renderHook: typeof renderQueryHook = async (callback, options) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 300_000 } },
  });
  queryClients.add(client);
  const wrapper = ({ children }: React.PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderQueryHook(callback, { ...options, wrapper });
};
afterEach(() => {
  for (const client of queryClients) client.clear();
  queryClients.clear();
});
