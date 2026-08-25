/**
 * #1568 — интеграционный сетевой контракт ленивых материалов места.
 *
 * Слайсы закрывают свои слои по отдельности: `__tests__/api/mapPlaces.test.ts`
 * проверяет группировку и адаптеры (#1571), `PlaceSourcePager.test.tsx` —
 * презентацию счётчика и контролов (#1572). Здесь проверяется то, что не видно
 * ни модели, ни UI: КОГДА и СКОЛЬКО раз уходит запрос
 * `GET /api/map/places/{place_id}/sources/` при работе карточки места.
 *
 * Контракт (Task Contract #1568, `docs/features/map.md`):
 * - запрос уходит только после первого открытия карточки, никогда на рендере
 *   маркеров;
 * - один запрос на place на cache lifetime: перелистывание источников и
 *   повторное открытие карточки идут из кэша;
 * - legacy-место без `place_id` и одиночный source сети не касаются;
 * - соседнее место с другим `place_id` кэшируется отдельно и не склеивается.
 *
 * Проверка идёт через реальный `usePlaceSourcePagerState` (владелец данных
 * карточки) и мок транспортного слоя `fetchWithTimeout`, поэтому ассертится
 * фактический URL, а не внутренний вызов адаптера.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { usePlaceSourcePagerState } from '@/components/MapPage/Map/PlacePopupCard/usePlaceSourcePagerState';
import {
  RAW_GROUPED_LIBRARY_MARKER,
  RAW_LEGACY_PLACELESS_ROW,
  RAW_LIBRARY_SOURCE_B_WITHOUT_MEDIA,
  RAW_NEARBY_DISTINCT_MARKER,
  RAW_SOURCES_PAGE_1,
  RAW_SOURCES_PAGE_2,
  RAW_SOURCES_PAGE_WITHOUT_MEDIA,
  RAW_SOURCES_SINGLE_PAGE,
} from '../../fixtures/mapPlaceFixtures';
import {
  normalizeMapPlaceSource,
  readMapPlaceMarkerFields,
  type MapPlaceSource,
} from '@/api/mapPlaces';
import { queryKeys } from '@/api/queryKeys';

const mockFetchWithTimeout = jest.fn();

jest.mock('@/utils/fetchWithTimeout', () => ({
  __esModule: true,
  fetchWithTimeout: (...args: any[]) => mockFetchWithTimeout(...args),
}));

const createResponseMock = (payload: unknown, ok = true, status = 200) => ({
  ok,
  status,
  statusText: ok ? 'OK' : 'Error',
  text: async () => JSON.stringify(payload),
});

/** Маркер в том виде, в каком его получает карточка после нормализации DTO. */
const toPoint = (raw: Record<string, unknown>) => ({
  id: raw.id,
  coord: `${raw.lat},${raw.lng}`,
  ...readMapPlaceMarkerFields(raw),
});

const sourcesUrls = () =>
  mockFetchWithTimeout.mock.calls
    .map((call) => String(call[0]))
    .filter((url) => url.includes('/map/places/'));

const cachedSourceIds = (
  queryClient: QueryClient,
  placeKey: string | number,
): string[] | undefined =>
  queryClient
    .getQueryData<MapPlaceSource[]>(queryKeys.mapPlaceSources(String(placeKey)))
    ?.map((source) => source.sourceId);

/**
 * `sourcesUrls()` фиксирует только факт ОТПРАВКИ запроса, а листать место можно
 * лишь по уже загруженной коллекции. Ждём именно того момента, когда материалы
 * доехали до хука: до этого активный source — экземпляр `primary_source` из
 * маркера, после — объект из ответа коллекции. Ожидание по кэшу здесь давало
 * гонку (кэш уже полон, а хук ещё не перерисован), и тест мигал.
 */
const waitForCollectionInHook = async (
  getState: () => ReturnType<typeof usePlaceSourcePagerState> | undefined,
  point: ReturnType<typeof toPoint>,
) => {
  await waitFor(() => expect(getState()?.activeSource).not.toBe(point.primarySource));
};

type HarnessProps = {
  point: ReturnType<typeof toPoint>;
  /** Открыта ли карточка места — гейт лени. */
  enabled: boolean;
  onState?: (state: ReturnType<typeof usePlaceSourcePagerState>) => void;
};

const PagerHarness: React.FC<HarnessProps> = ({ point, enabled, onState }) => {
  const state = usePlaceSourcePagerState(point, enabled);
  onState?.(state);
  return (
    <Text testID="counter">{`${state.activeSourceIndex + 1}/${state.sourceCount}:${
      state.activeSource?.sourceId ?? 'none'
    }`}</Text>
  );
};

describe('#1568 lazy place sources network contract', () => {
  let queryClient: QueryClient;

  const renderHarness = (props: HarnessProps) =>
    render(
      <QueryClientProvider client={queryClient}>
        <PagerHarness {...props} />
      </QueryClientProvider>,
    );

  beforeEach(() => {
    mockFetchWithTimeout.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('does not request sources while the card is closed (markers must stay network-free)', async () => {
    mockFetchWithTimeout.mockResolvedValue(createResponseMock(RAW_SOURCES_SINGLE_PAGE));

    const { getByTestId } = renderHarness({
      point: toPoint(RAW_GROUPED_LIBRARY_MARKER as unknown as Record<string, unknown>),
      enabled: false,
    });

    // Счётчик показывает заявленное маркером число материалов ещё до запроса.
    expect(getByTestId('counter').props.children).toBe(
      `1/2:${RAW_GROUPED_LIBRARY_MARKER.primary_source.source_id}`,
    );
    await waitFor(() => expect(sourcesUrls()).toHaveLength(0));
  });

  it('requests sources once after the card opens and never again while paging', async () => {
    mockFetchWithTimeout.mockResolvedValue(createResponseMock(RAW_SOURCES_SINGLE_PAGE));

    let state: ReturnType<typeof usePlaceSourcePagerState> | undefined;
    const point = toPoint(RAW_GROUPED_LIBRARY_MARKER as unknown as Record<string, unknown>);
    const { getByTestId } = renderHarness({
      point,
      enabled: true,
      onState: (value) => {
        state = value;
      },
    });

    await waitFor(() => expect(sourcesUrls()).toHaveLength(1));
    expect(sourcesUrls()[0]).toContain(`/map/places/${RAW_GROUPED_LIBRARY_MARKER.place_id}/sources/`);
    await waitForCollectionInHook(() => state, point);
    expect(cachedSourceIds(queryClient, RAW_GROUPED_LIBRARY_MARKER.place_id)).toHaveLength(2);

    const [, sourceB] = RAW_SOURCES_SINGLE_PAGE.results;
    await act(async () => {
      state?.goNext();
    });
    await waitFor(() =>
      expect(getByTestId('counter').props.children).toBe(`2/2:${sourceB.source_id}`),
    );

    await act(async () => {
      state?.goPrev();
    });
    await waitFor(() =>
      expect(getByTestId('counter').props.children).toBe(
        `1/2:${RAW_GROUPED_LIBRARY_MARKER.primary_source.source_id}`,
      ),
    );

    // Перелистывание работает по уже загруженной коллекции: сеть не трогается.
    expect(sourcesUrls()).toHaveLength(1);
  });

  it('serves a reopened card from cache (one request per place per cache lifetime)', async () => {
    mockFetchWithTimeout.mockResolvedValue(createResponseMock(RAW_SOURCES_SINGLE_PAGE));

    const point = toPoint(RAW_GROUPED_LIBRARY_MARKER as unknown as Record<string, unknown>);
    const first = renderHarness({ point, enabled: true });
    await waitFor(() => expect(sourcesUrls()).toHaveLength(1));
    first.unmount();

    const second = renderHarness({ point, enabled: true });
    await waitFor(() =>
      expect(second.getByTestId('counter').props.children).toBe(
        `1/2:${RAW_GROUPED_LIBRARY_MARKER.primary_source.source_id}`,
      ),
    );

    expect(sourcesUrls()).toHaveLength(1);
  });

  it('keeps a nearby distinct place on its own cache entry (never merged)', async () => {
    mockFetchWithTimeout
      .mockResolvedValueOnce(createResponseMock(RAW_SOURCES_SINGLE_PAGE))
      .mockResolvedValue(createResponseMock({ results: [], next: null }));

    const library = renderHarness({
      point: toPoint(RAW_GROUPED_LIBRARY_MARKER as unknown as Record<string, unknown>),
      enabled: true,
    });
    await waitFor(() => expect(sourcesUrls()).toHaveLength(1));
    library.unmount();

    // Соседнее место (другой place_id) — одиночный source, запроса быть не должно.
    const nearby = renderHarness({
      point: toPoint(RAW_NEARBY_DISTINCT_MARKER as unknown as Record<string, unknown>),
      enabled: true,
    });
    const nearbyPrimary = normalizeMapPlaceSource(RAW_NEARBY_DISTINCT_MARKER.primary_source);
    await waitFor(() =>
      expect(nearby.getByTestId('counter').props.children).toBe(`1/1:${nearbyPrimary?.sourceId}`),
    );

    expect(sourcesUrls()).toHaveLength(1);
    expect(sourcesUrls()[0]).toContain(`/map/places/${RAW_GROUPED_LIBRARY_MARKER.place_id}/sources/`);
  });

  it('never requests sources for a legacy row without place_id', async () => {
    mockFetchWithTimeout.mockResolvedValue(createResponseMock(RAW_SOURCES_SINGLE_PAGE));

    const { getByTestId } = renderHarness({
      point: toPoint(RAW_LEGACY_PLACELESS_ROW as unknown as Record<string, unknown>),
      enabled: true,
    });

    await waitFor(() => expect(getByTestId('counter').props.children).toBe('1/1:none'));
    expect(sourcesUrls()).toHaveLength(0);
  });

  it('collapses the pager when the sources request fails (no dead controls)', async () => {
    mockFetchWithTimeout.mockResolvedValue(createResponseMock({}, false, 500));

    let state: ReturnType<typeof usePlaceSourcePagerState> | undefined;
    renderHarness({
      point: toPoint(RAW_GROUPED_LIBRARY_MARKER as unknown as Record<string, unknown>),
      enabled: true,
      onState: (value) => {
        state = value;
      },
    });

    // Пока коллекция не пришла — честный счётчик из маркера.
    expect(state?.sourceCount).toBe(2);
    // После провала листать нечего: счётчик обязан упасть до 1, иначе карточка
    // навсегда осталась бы со стрелками, которые ничего не делают.
    await waitFor(() => expect(state?.sourceCount).toBe(1), { timeout: 5000 });
  });

  it('marks a non-primary source active so the card cannot fall back to primary media', async () => {
    mockFetchWithTimeout.mockResolvedValue(createResponseMock(RAW_SOURCES_PAGE_WITHOUT_MEDIA));

    let state: ReturnType<typeof usePlaceSourcePagerState> | undefined;
    const point = toPoint(RAW_GROUPED_LIBRARY_MARKER as unknown as Record<string, unknown>);
    renderHarness({
      point,
      enabled: true,
      onState: (value) => {
        state = value;
      },
    });

    await waitForCollectionInHook(() => state, point);
    expect(sourcesUrls()).toHaveLength(1);
    expect(state?.isPrimarySourceActive).toBe(true);

    await act(async () => {
      state?.goNext();
    });

    await waitFor(() =>
      expect(state?.activeSource?.sourceId).toBe(RAW_LIBRARY_SOURCE_B_WITHOUT_MEDIA.source_id),
    );
    expect(state?.isPrimarySourceActive).toBe(false);
    expect(state?.activeSource?.articleUrl).toBeNull();
    expect(state?.activeSource?.thumbnailUrl).toBeNull();
  });

  it('paginates the cursor inside one cached fetch instead of per-page refetches', async () => {
    mockFetchWithTimeout
      .mockResolvedValueOnce(createResponseMock(RAW_SOURCES_PAGE_1))
      .mockResolvedValueOnce(createResponseMock(RAW_SOURCES_PAGE_2));

    let state: ReturnType<typeof usePlaceSourcePagerState> | undefined;
    const point = toPoint(RAW_GROUPED_LIBRARY_MARKER as unknown as Record<string, unknown>);
    const { getByTestId } = renderHarness({
      point,
      enabled: true,
      onState: (value) => {
        state = value;
      },
    });

    await waitFor(() => expect(sourcesUrls()).toHaveLength(2));
    expect(sourcesUrls()[1]).toContain('cursor=cursor-2');
    await waitForCollectionInHook(() => state, point);

    await act(async () => {
      state?.goNext();
    });
    await waitFor(() =>
      expect(getByTestId('counter').props.children).toBe(
        `2/2:${RAW_SOURCES_PAGE_2.results[0].source_id}`,
      ),
    );

    // Обе страницы собраны в один cache entry: листание не идёт в сеть.
    expect(sourcesUrls()).toHaveLength(2);
  });
});
