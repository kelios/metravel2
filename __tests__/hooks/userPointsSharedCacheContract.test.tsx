import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * #1709 — регресс на ОДНОМ (делённом) `QueryClient`.
 *
 * Ключ `userPointsAll` делят producer с частичным контрактом
 * (`usePointsDataModel`: первая страница сразу + фоновая докачка) и потребитель
 * с контрактом полноты (`useSavedPointToggle`: вся коллекция одним
 * `getAllPoints()`). Существующие тесты каждого хука создают СВОЙ изолированный
 * клиент и эту гонку увидеть физически не могут.
 *
 * Сценарий: стрим прерван уходом со страницы → сосед читает тот же ключ →
 * реально сохранённая точка за пределами докачанного префикса обязана остаться
 * «сохранённой».
 */

jest.mock('@/api/miscOptimized', () => ({
  fetchAllFiltersOptimized: jest.fn(async () => ({ categoryTravelAddress: [] })),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: true }),
}));

jest.mock('@/api/userPoints', () => ({
  userPointsApi: {
    getPointsPage: jest.fn(),
    getAllPoints: jest.fn(),
    createPoint: jest.fn(),
    deletePoint: jest.fn(),
  },
}));

import { userPointsApi } from '@/api/userPoints';
import {
  isPointsCollectionPartial,
  writePointsPaginationState,
} from '@/api/userPointsCollectionCache';
import { usePointsDataModel } from '@/components/UserPoints/usePointsDataModel';
import { useSavedPointToggle } from '@/hooks/map/useSavedPointToggle';
import type { ImportedPoint } from '@/types/userPoints';

const mockedApi = userPointsApi as jest.Mocked<typeof userPointsApi>;

const PER_PAGE = 200;
const TOTAL = 900; // 5 страниц: 200×4 + 100
const STREAMED_PREFIX = 2 * PER_PAGE; // сколько успевает докачаться до ухода

/** Точка №n: координаты разнесены далеко за COORD_EPSILON (1e-5). */
const coordOf = (n: number) => ({ lat: 10 + n * 0.01, lng: 20 + n * 0.01 });

const ALL_POINTS: ImportedPoint[] = Array.from({ length: TOTAL }, (_, i) => {
  const n = i + 1;
  const { lat, lng } = coordOf(n);
  return {
    id: n,
    name: `P${n}`,
    latitude: lat,
    longitude: lng,
    color: 'blue',
    status: 'planning',
  } as unknown as ImportedPoint;
});

/** Точка внутри докачанного префикса — контроль исправности матчера. */
const POINT_INSIDE_PREFIX = 50;
/** Точка ЗА пределами префикса — та, что показывалась несохранённой. */
const POINT_BEYOND_PREFIX = 450;

const pageOf = (page: number) => ALL_POINTS.slice((page - 1) * PER_PAGE, page * PER_PAGE);

/**
 * Страницы после `stopAfterPage` не резолвятся никогда — так момент ухода со
 * страницы «Мои точки» посреди докачки задаётся детерминированно, без таймеров.
 */
const mockStreamingBackend = ({ stopAfterPage }: { stopAfterPage: number }) => {
  mockedApi.getPointsPage.mockImplementation(async (page: number, perPage: number) => {
    if (page > stopAfterPage) return new Promise(() => {}) as never;
    const items = pageOf(page);
    return { items, hasMore: items.length >= perPage };
  });
  mockedApi.getAllPoints.mockResolvedValue(ALL_POINTS);
};

describe('#1709 общий кэш userPointsAll: частичный стрим не выдаётся за полную коллекцию', () => {
  let queryClient: QueryClient;
  let wrapper: React.FC<{ children: React.ReactNode }>;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  });

  afterEach(() => queryClient.clear());

  const renderPointsScreen = () =>
    renderHook(
      () =>
        usePointsDataModel({
          defaultPerPage: PER_PAGE,
          filters: { page: 1, perPage: PER_PAGE } as never,
          searchQuery: '',
          currentLocation: null,
          defaultPointColors: ['blue'],
        }),
      { wrapper },
    );

  const renderToggleFor = (n: number) =>
    renderHook(() => useSavedPointToggle({ coord: coordOf(n) }), { wrapper });

  it('прерванный стрим: сосед перечитывает коллекцию и видит точку сохранённой', async () => {
    mockStreamingBackend({ stopAfterPage: 2 });

    // 1. Экран «Мои точки»: докачали 2 страницы из 5.
    const screen = renderPointsScreen();
    await waitFor(() => expect(screen.result.current.points).toHaveLength(STREAMED_PREFIX));

    // 2. Пользователь ушёл со страницы посреди докачки.
    screen.unmount();

    // 3. Соседний потребитель читает тот же ключ.
    const toggle = renderToggleFor(POINT_BEYOND_PREFIX);
    await waitFor(() => expect(toggle.result.current.isSaved).toBe(true));
    expect(mockedApi.getAllPoints).toHaveBeenCalledTimes(1);
  });

  it('контроль: точка внутри докачанного префикса тоже сохранена (матчер исправен)', async () => {
    mockStreamingBackend({ stopAfterPage: 2 });

    const screen = renderPointsScreen();
    await waitFor(() => expect(screen.result.current.points).toHaveLength(STREAMED_PREFIX));
    screen.unmount();

    const toggle = renderToggleFor(POINT_INSIDE_PREFIX);
    await waitFor(() => expect(toggle.result.current.isSaved).toBe(true));
  });

  it('отметка полноты переживает сами данные: у неё бесконечный gcTime', () => {
    // Запись метаданных идёт без наблюдателей и без фетчей, а React Query
    // продлевает gcTime только на подписке и на фетче. С общим 10-минутным
    // gcTime отметка исчезла бы раньше частичного префикса, и он снова сошёл бы
    // за полную коллекцию.
    writePointsPaginationState(queryClient, { nextPage: 3, complete: false });
    const meta = queryClient.getQueryCache().find({ queryKey: ['userPointsAll', 'pagination'] });
    expect(meta?.gcTime).toBe(Infinity);
    expect(isPointsCollectionPartial(queryClient)).toBe(true);
    writePointsPaginationState(queryClient, { nextPage: 3, complete: true });
    expect(isPointsCollectionPartial(queryClient)).toBe(false);
  });

  it('контроль: непрерванный стрим отдаёт полную коллекцию без лишнего запроса', async () => {
    mockStreamingBackend({ stopAfterPage: Number.POSITIVE_INFINITY });

    const screen = renderPointsScreen();
    await waitFor(() => expect(screen.result.current.points).toHaveLength(TOTAL));
    screen.unmount();

    const toggle = renderToggleFor(POINT_BEYOND_PREFIX);
    await waitFor(() => expect(toggle.result.current.isSaved).toBe(true));
    // Коллекция уже полная — потребитель не тратит ещё одно чтение.
    expect(mockedApi.getAllPoints).not.toHaveBeenCalled();
  });
});
