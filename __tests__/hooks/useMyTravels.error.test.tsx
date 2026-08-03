// Сбой загрузки «Моих маршрутов» не должен выглядеть как пустой профиль.
// До этого fetchMyTravels вызывался без throwOnError: 5xx глотался в api-слое,
// возвращался [], и пользователь Play-сборки видел «маршрутов нет» вместо ошибки —
// без текста причины и без возможности повторить.

import { renderHook, waitFor, act } from '@testing-library/react-native';

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

    const { result } = renderHook(() => useMyTravels({ userId: 'u-1', perPage: 10 }));
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

    const { result } = renderHook(() =>
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
    expect(onTotalChange).toHaveBeenCalledWith(0);
  });

  it('успешная повторная загрузка гасит error и возвращает данные', async () => {
    mockFetchMyTravels.mockRejectedValueOnce(httpError(502, 'Bad Gateway'));

    const { result } = renderHook(() => useMyTravels({ userId: 'u-1', perPage: 10 }));
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

    const { result } = renderHook(() => useMyTravels({ userId: 'u-1', perPage: 2 }));
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

    const { result, rerender } = renderHook(
      ({ userId }: { userId: string | null }) => useMyTravels({ userId, perPage: 10 }),
      { initialProps: { userId: 'u-1' as string | null } }
    );
    await act(async () => {
      await result.current.load();
    });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    rerender({ userId: null });
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.error).toBeNull();
  });
});
