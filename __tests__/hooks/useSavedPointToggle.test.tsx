import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useSavedPointToggle, findSavedPointByCoord } from '@/hooks/map/useSavedPointToggle';
import { userPointsApi } from '@/api/userPoints';
import type { ImportedPoint } from '@/types/userPoints';

jest.mock('@/api/userPoints', () => ({
  userPointsApi: {
    getAllPoints: jest.fn(),
    createPoint: jest.fn(),
    deletePoint: jest.fn(),
  },
}));

// Хук читает `isAuthenticated` из zustand-стора через селектор.
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
}));

const mockedApi = userPointsApi as jest.Mocked<typeof userPointsApi>;

const COORD = { lat: 50.05924, lng: 19.93941 };

function makePoint(overrides: Partial<ImportedPoint> = {}): ImportedPoint {
  return {
    id: 42,
    latitude: COORD.lat,
    longitude: COORD.lng,
    ...(overrides as ImportedPoint),
  } as ImportedPoint;
}

/** Deferred promise, чтобы «поймать» состояние ДО ответа сервера. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('findSavedPointByCoord', () => {
  it('matches within epsilon and rejects far / invalid coords', () => {
    const points = [makePoint()];
    expect(findSavedPointByCoord(points, COORD.lat, COORD.lng)?.id).toBe(42);
    expect(findSavedPointByCoord(points, COORD.lat + 0.001, COORD.lng)).toBeNull();
    expect(findSavedPointByCoord(points, NaN, COORD.lng)).toBeNull();
  });
});

describe('useSavedPointToggle — optimistic toggle', () => {
  let queryClient: QueryClient;
  let wrapper: React.FC<{ children: React.ReactNode }>;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  });

  afterEach(() => queryClient.clear());

  it('derives isSaved from the shared userPointsAll cache', async () => {
    mockedApi.getAllPoints.mockResolvedValue([makePoint()]);
    const { result } = renderHook(() => useSavedPointToggle({ coord: COORD }), { wrapper });
    await waitFor(() => expect(result.current.isSaved).toBe(true));
    expect(result.current.savedPointId).toBe(42);
  });

  it('createPoint flips isSaved to true immediately, before the server responds', async () => {
    // Сначала ничего не сохранено; сервер отдаёт созданную точку с реальным id,
    // и она ложится в кэш без рефетча коллекции (#1706).
    mockedApi.getAllPoints.mockResolvedValueOnce([]).mockResolvedValue([makePoint({ id: 777 })]);
    const created = deferred<ImportedPoint>();
    mockedApi.createPoint.mockReturnValue(created.promise as any);

    const { result } = renderHook(() => useSavedPointToggle({ coord: COORD }), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.isSaved).toBe(false);

    let pending: Promise<unknown>;
    act(() => {
      pending = result.current.createPoint({
        latitude: COORD.lat,
        longitude: COORD.lng,
      });
    });

    // Оптимистично — ещё ДО ответа сервера иконка уже «сохранено».
    await waitFor(() => expect(result.current.isSaved).toBe(true));
    expect(mockedApi.createPoint).toHaveBeenCalledTimes(1);

    await act(async () => {
      created.resolve(makePoint({ id: 777 }));
      await pending;
    });

    // После ответа сервера остаётся сохранено с реальным id.
    await waitFor(() => expect(result.current.savedPointId).toBe(777));
    expect(result.current.isSaved).toBe(true);
  });

  /**
   * #1706: коллекция читается постранично (серверный потолок 200), поэтому полный
   * рефетч после каждого toggle стоил бы ceil(count/200) запросов. Лимитер считает
   * `/user-points/` одним ключом (`utils/rateLimiter.ts:58`, 60 запросов в минуту),
   * и серия сохранений на карте упиралась бы в ложное 429.
   */
  it('не перечитывает коллекцию после успешных createPoint и removeSaved', async () => {
    mockedApi.getAllPoints.mockResolvedValue([]);
    mockedApi.createPoint.mockResolvedValue(makePoint({ id: 777 }) as any);
    mockedApi.deletePoint.mockResolvedValue(undefined as any);

    const { result } = renderHook(() => useSavedPointToggle({ coord: COORD }), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(mockedApi.getAllPoints).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.createPoint({ latitude: COORD.lat, longitude: COORD.lng });
    });
    await waitFor(() => expect(result.current.savedPointId).toBe(777));

    await act(async () => {
      await result.current.removeSaved();
    });
    await waitFor(() => expect(result.current.isSaved).toBe(false));

    // Ни одно из двух успешных действий не потянуло коллекцию заново.
    expect(mockedApi.getAllPoints).toHaveBeenCalledTimes(1);
  });

  /**
   * #1706 P1: тап «Сохранить» в первые секунды, пока коллекция (14 страниц) ещё
   * читается. `cancelQueries` откатывает данные к предыдущему состоянию, а на
   * первом чтении это `undefined` — оптимистичная запись оставила бы в общем
   * кэше ОДНУ точку, помеченную свежей на весь staleTime, и все остальные
   * сохранённые точки молча стали бы «не сохранено».
   */
  it('не схлопывает коллекцию, если сохранить во время её первой загрузки', async () => {
    const firstRead = deferred<ImportedPoint[]>();
    mockedApi.getAllPoints.mockReturnValueOnce(firstRead.promise as any);
    const wholeCollection = Array.from({ length: 300 }, (_, i) =>
      makePoint({ id: 1000 + i, latitude: 10 + i / 1000, longitude: 20 + i / 1000 }),
    );
    mockedApi.createPoint.mockResolvedValue(makePoint({ id: 777 }) as any);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const localWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSavedPointToggle({ coord: COORD }), {
      wrapper: localWrapper,
    });

    // Коллекция ещё летит — сохраняем прямо сейчас, не дожидаясь её.
    let pending: Promise<unknown>;
    act(() => {
      pending = result.current.createPoint({ latitude: COORD.lat, longitude: COORD.lng });
    });
    firstRead.resolve(wholeCollection);
    await act(async () => {
      await pending;
    });

    // Кэш обязан содержать всю коллекцию, а не только что созданную точку.
    await waitFor(() => {
      const cached = client.getQueryData(['userPointsAll']) as ImportedPoint[] | undefined;
      expect(Array.isArray(cached) && cached.length).toBeGreaterThan(1);
    });
    // Вся коллекция на месте, и созданная точка дописана — без лишнего запроса.
    const cached = client.getQueryData(['userPointsAll']) as ImportedPoint[];
    expect(cached).toHaveLength(wholeCollection.length + 1);
    expect(mockedApi.getAllPoints).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.isSaved).toBe(true));
  });

  it('rolls back to not-saved when createPoint fails', async () => {
    mockedApi.getAllPoints.mockResolvedValue([]);
    mockedApi.createPoint.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useSavedPointToggle({ coord: COORD }), { wrapper });
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      await expect(
        result.current.createPoint({ latitude: COORD.lat, longitude: COORD.lng }),
      ).rejects.toThrow('network');
    });

    await waitFor(() => expect(result.current.isSaved).toBe(false));
  });

  it('removeSaved flips isSaved to false immediately, before the server responds', async () => {
    mockedApi.getAllPoints.mockResolvedValue([makePoint()]);
    const removed = deferred<unknown>();
    mockedApi.deletePoint.mockReturnValue(removed.promise as any);

    const { result } = renderHook(() => useSavedPointToggle({ coord: COORD }), { wrapper });
    await waitFor(() => expect(result.current.isSaved).toBe(true));

    let pending: Promise<unknown>;
    act(() => {
      pending = result.current.removeSaved();
    });

    // Оптимистично снято сразу.
    await waitFor(() => expect(result.current.isSaved).toBe(false));
    expect(mockedApi.deletePoint).toHaveBeenCalledWith(42);

    await act(async () => {
      removed.resolve(undefined);
      await pending;
    });
    expect(result.current.isSaved).toBe(false);
  });

  it('resyncs (point returns) when removeSaved fails', async () => {
    // Первый getAllPoints — точка есть; после провала delete инвалидация рефетчит и точка возвращается.
    mockedApi.getAllPoints.mockResolvedValue([makePoint()]);
    mockedApi.deletePoint.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useSavedPointToggle({ coord: COORD }), { wrapper });
    await waitFor(() => expect(result.current.isSaved).toBe(true));

    await act(async () => {
      await expect(result.current.removeSaved()).rejects.toThrow('boom');
    });

    // Инвалидация вернёт точку из (замоканного) сервера.
    await waitFor(() => expect(result.current.isSaved).toBe(true));
  });
});
