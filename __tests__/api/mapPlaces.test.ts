/**
 * #1571 — place/source модель: группировка O(n), стабильность placeKey,
 * негативные контроли (different place_id never merge / no place_id stays
 * standalone / legacy flat fallback) и адаптеры sources endpoint.
 */
import {
  getMapPlaceKey,
  getMapPointIdentityKey,
  groupMapPlaces,
  materializeMapPlaceRecord,
  normalizeMapPlaceSource,
  type MapPlaceRecordLike,
} from '@/api/mapPlaces';
import { fetchAllMapPlaceSources, fetchMapClusters, fetchMapPlaceSources } from '@/api/map';
import {
  RAW_FLAT_LIBRARY_ROW_A,
  RAW_FLAT_LIBRARY_ROW_B,
  RAW_GROUPED_LIBRARY_MARKER,
  RAW_LEGACY_PLACELESS_ROW,
  RAW_LIBRARY_SOURCE_A,
  RAW_LIBRARY_SOURCE_B,
  RAW_NEARBY_DISTINCT_MARKER,
  RAW_SOURCES_PAGE_1,
  RAW_SOURCES_PAGE_2,
  RAW_SOURCES_SINGLE_PAGE,
} from '../fixtures/mapPlaceFixtures';

const mockFetchWithTimeout = jest.fn();

const createResponseMock = (payload: unknown, ok = true, status = 200) => ({
  ok,
  status,
  statusText: ok ? 'OK' : 'Error',
  text: async () => JSON.stringify(payload),
});

jest.mock('@/utils/fetchWithTimeout', () => ({
  __esModule: true,
  fetchWithTimeout: (...args: any[]) => mockFetchWithTimeout(...args),
}));

beforeEach(() => {
  mockFetchWithTimeout.mockReset();
});

describe('groupMapPlaces', () => {
  it('merges two flat rows sharing one place_id into one marker preserving both sources', () => {
    const markers = groupMapPlaces([RAW_FLAT_LIBRARY_ROW_A, RAW_FLAT_LIBRARY_ROW_B]);

    expect(markers).toHaveLength(1);
    const [place] = markers;
    expect(place.placeKey).toBe('501');
    expect(place.placeId).toBe(501);
    expect(place.sourceCount).toBe(2);
    expect(place.sources.map((s) => s.sourceId)).toEqual([
      'travel-address:14029',
      'travel-address:15688',
    ]);
    // Оба article URL сохраняются (#841): разные материалы не теряются.
    expect(place.sources.map((s) => s.articleUrl)).toEqual([
      '/travels/minsk-za-vyhodnye',
      '/travels/biblioteki-belarusi',
    ]);
    // Канонические поля места — от первой записи, перелистывание их не меняет.
    expect(place.lat).toBe('53.9312900');
    expect(place.lng).toBe('27.6459000');
    expect(place.record).toBe(RAW_FLAT_LIBRARY_ROW_A);
  });

  it('materializes computed place summary for popup without mutating the source record', () => {
    const rowA = { ...RAW_FLAT_LIBRARY_ROW_A };
    const rowB = { ...RAW_FLAT_LIBRARY_ROW_B };
    const [place] = groupMapPlaces([rowA, rowB]);

    // Переходные flat rows не несут source_count/primary_source, но карточка
    // обязана увидеть вычисленное значение и запустить lazy sources endpoint.
    expect(rowA).not.toHaveProperty('sourceCount');
    expect(rowA).not.toHaveProperty('primarySource');

    const popupRecord = materializeMapPlaceRecord(place);
    expect(popupRecord).not.toBe(rowA);
    expect(popupRecord.placeId).toBe(501);
    expect(popupRecord.sourceCount).toBe(2);
    expect(popupRecord.primarySource?.sourceId).toBe('travel-address:14029');
    expect(popupRecord).not.toHaveProperty('sources');
  });

  it('keeps grouped marker 1:1 with declared source_count and primary source', () => {
    const primarySource = normalizeMapPlaceSource(RAW_LIBRARY_SOURCE_A);
    const groupedRecord: MapPlaceRecordLike = {
      placeId: 501,
      sourceCount: 2,
      primarySource,
      name: 'Национальная библиотека Беларуси',
      address: 'Минск, просп. Независимости 116',
      coord: '53.93129,27.6459',
      lat: '53.93129',
      lng: '27.6459',
      id: 14029,
    };

    const markers = groupMapPlaces([groupedRecord]);

    expect(markers).toHaveLength(1);
    expect(markers[0].sourceCount).toBe(2);
    expect(markers[0].primarySource).toBe(primarySource);
    expect(markers[0].name).toBe('Национальная библиотека Беларуси');
  });

  it('never merges nearby places with different place_id', () => {
    const markers = groupMapPlaces([
      { ...RAW_GROUPED_LIBRARY_MARKER },
      { ...RAW_NEARBY_DISTINCT_MARKER },
    ]);

    expect(markers).toHaveLength(2);
    expect(markers.map((m) => m.placeKey)).toEqual(['501', '502']);
  });

  it('keeps legacy rows without place_id standalone even with matching address', () => {
    const twin = { ...RAW_LEGACY_PLACELESS_ROW, id: 4243 };
    const markers = groupMapPlaces([RAW_LEGACY_PLACELESS_ROW, twin]);

    expect(markers).toHaveLength(2);
    expect(markers[0].placeId).toBeNull();
    expect(markers[1].placeId).toBeNull();
    expect(markers[0].sourceCount).toBe(1);
    // Legacy placeKey — прежний record-ключ #1347: внедрение модели не даёт churn.
    expect(markers[0].placeKey).toBe(getMapPointIdentityKey(RAW_LEGACY_PLACELESS_ROW));
  });

  it('suffixes colliding legacy keys instead of merging records', () => {
    const markers = groupMapPlaces([RAW_LEGACY_PLACELESS_ROW, { ...RAW_LEGACY_PLACELESS_ROW }]);

    expect(markers).toHaveLength(2);
    expect(markers[1].placeKey).toBe(`${markers[0].placeKey}#1`);
  });

  it('maps a legacy flat payload without place fields 1:1 (fallback)', () => {
    const rows = [
      RAW_LEGACY_PLACELESS_ROW,
      { ...RAW_LEGACY_PLACELESS_ROW, id: 5001, lat: '52.1', lng: '25.3' },
    ];
    const markers = groupMapPlaces(rows);

    expect(markers).toHaveLength(rows.length);
    expect(markers.every((m) => m.placeId === null && m.sourceCount === 1)).toBe(true);
  });

  it('keeps placeKey stable across dataset reorder', () => {
    const records = [
      RAW_FLAT_LIBRARY_ROW_A,
      RAW_NEARBY_DISTINCT_MARKER,
      RAW_FLAT_LIBRARY_ROW_B,
      RAW_LEGACY_PLACELESS_ROW,
    ];
    const reordered = [
      RAW_LEGACY_PLACELESS_ROW,
      RAW_FLAT_LIBRARY_ROW_B,
      RAW_NEARBY_DISTINCT_MARKER,
      RAW_FLAT_LIBRARY_ROW_A,
    ];

    const first = groupMapPlaces(records);
    const second = groupMapPlaces(reordered);

    expect(new Set(second.map((m) => m.placeKey))).toEqual(new Set(first.map((m) => m.placeKey)));
    const library = second.find((m) => m.placeKey === '501');
    expect(library?.sources.map((s) => s.sourceId).sort()).toEqual([
      'travel-address:14029',
      'travel-address:15688',
    ]);
  });

  it('derives the same key via getMapPlaceKey for records and markers', () => {
    expect(getMapPlaceKey(RAW_FLAT_LIBRARY_ROW_A)).toBe('501');
    expect(getMapPlaceKey(RAW_LEGACY_PLACELESS_ROW)).toBe(
      getMapPointIdentityKey(RAW_LEGACY_PLACELESS_ROW),
    );
  });
});

describe('fetchMapClusters place passthrough', () => {
  it('keeps place_id/source_count/primary_source through marker normalization', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      createResponseMock({
        clusters: [],
        markers: [RAW_GROUPED_LIBRARY_MARKER],
        total_count: 1,
        source: 'places',
        generated_at: '2026-08-25T13:00:00Z',
      }),
    );

    const result = await fetchMapClusters({ south: 53, west: 27, north: 54, east: 28 }, 13);

    expect(result.markers).toHaveLength(1);
    const marker = result.markers[0];
    expect(marker.placeId).toBe(501);
    expect(marker.sourceCount).toBe(2);
    expect(marker.primarySource?.sourceId).toBe('travel-address:14029');
    expect(marker.primarySource?.articleTitle).toBe('Минск за выходные');
    expect(marker.primarySource?.thumbnailUrl).toContain('/address-image/14029/');
  });
});

describe('fetchMapPlaceSources', () => {
  it('normalizes a snake_case sources page', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(createResponseMock(RAW_SOURCES_SINGLE_PAGE));

    const page = await fetchMapPlaceSources(501);

    expect(mockFetchWithTimeout.mock.calls[0][0]).toContain('/map/places/501/sources/');
    expect(page.next).toBeNull();
    expect(page.results.map((s) => s.sourceId)).toEqual([
      RAW_LIBRARY_SOURCE_A.source_id,
      RAW_LIBRARY_SOURCE_B.source_id,
    ]);
    expect(page.results[0].travelId).toBe(389);
    expect(page.results[0].thumbnailWidth).toBe(400);
  });

  it('throws on HTTP error (lazy user-triggered request)', async () => {
    mockFetchWithTimeout.mockResolvedValue(createResponseMock({}, false, 500));

    await expect(fetchMapPlaceSources(501)).rejects.toThrow('HTTP 500');
  });
});

describe('fetchAllMapPlaceSources', () => {
  it('follows the cursor and concatenates pages', async () => {
    mockFetchWithTimeout
      .mockResolvedValueOnce(createResponseMock(RAW_SOURCES_PAGE_1))
      .mockResolvedValueOnce(createResponseMock(RAW_SOURCES_PAGE_2));

    const sources = await fetchAllMapPlaceSources(501);

    expect(sources.map((s) => s.sourceId)).toEqual([
      'travel-address:14029',
      'travel-address:15688',
    ]);
    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    expect(String(mockFetchWithTimeout.mock.calls[1][0])).toContain('cursor=cursor-2');
  });

  it('stops on a repeated cursor instead of looping (backfill cursor trap)', async () => {
    mockFetchWithTimeout.mockResolvedValue(
      createResponseMock({ results: [RAW_LIBRARY_SOURCE_A], next: 'cursor-2' }),
    );

    const sources = await fetchAllMapPlaceSources(501);

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(2);
    // Повторная страница не удваивает материал: на дубле `sourceId` pager искал бы
    // активный источник по первому вхождению и замирал бы на нём.
    expect(sources.map((s) => s.sourceId)).toEqual([RAW_LIBRARY_SOURCE_A.source_id]);
  });

  it('takes the cursor token out of an absolute DRF next URL', async () => {
    mockFetchWithTimeout
      .mockResolvedValueOnce(
        createResponseMock({
          results: [RAW_LIBRARY_SOURCE_A],
          next: 'https://metravel.by/api/map/places/501/sources/?cursor=cD0y%3D',
        }),
      )
      .mockResolvedValueOnce(createResponseMock(RAW_SOURCES_PAGE_2));

    const sources = await fetchAllMapPlaceSources(501);

    const secondUrl = String(mockFetchWithTimeout.mock.calls[1][0]);
    // Абсолютный URL в `?cursor=` вернул бы первую страницу заново; запрашиваем
    // собственный endpoint с извлечённым токеном.
    expect(secondUrl).toContain('/map/places/501/sources/?cursor=');
    expect(secondUrl).not.toContain('https%3A');
    expect(sources.map((s) => s.sourceId)).toEqual([
      RAW_LIBRARY_SOURCE_A.source_id,
      RAW_LIBRARY_SOURCE_B.source_id,
    ]);
  });

  it('stops paging when next carries no cursor instead of sending the URL as one', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      createResponseMock({
        results: [RAW_LIBRARY_SOURCE_A],
        next: 'https://metravel.by/api/map/places/501/sources/?page=2',
      }),
    );

    const sources = await fetchAllMapPlaceSources(501);

    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
    expect(sources.map((s) => s.sourceId)).toEqual([RAW_LIBRARY_SOURCE_A.source_id]);
  });
});
