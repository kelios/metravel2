/**
 * #1571 — place/source модель: группировка O(n), стабильность placeKey,
 * негативные контроли (different place_id never merge / no place_id stays
 * standalone / legacy flat fallback) и адаптеры sources endpoint.
 */
import {
  canonicalizeMapPlaceSourceId,
  getMapPlaceKey,
  getMapPointIdentityKey,
  groupMapPlaces,
  isSameMapPlaceSource,
  materializeMapPlaceRecord,
  normalizeMapPlaceSource,
  type MapPlaceRecordLike,
  type MapPlaceSource,
} from '@/api/mapPlaces';
import {
  fetchAllMapPlaceSources,
  fetchMapClusters,
  fetchMapPlaceSources,
  fetchTravelsForMap,
  fetchTravelsNearRoute,
} from '@/api/map';
import {
  LIBRARY_PLACE_UUID,
  RAW_FLAT_LIBRARY_ROW_A,
  RAW_FLAT_LIBRARY_ROW_A_UUID,
  RAW_FLAT_LIBRARY_ROW_B,
  RAW_FLAT_LIBRARY_ROW_B_UUID,
  RAW_GROUPED_LIBRARY_MARKER,
  RAW_GROUPED_LIBRARY_MARKER_UUID,
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

describe('map place source identity', () => {
  it('canonicalizes a live point-id source_id onto travel-address:<point_id>', () => {
    expect(canonicalizeMapPlaceSourceId('14029', 14029)).toBe('travel-address:14029');
    expect(canonicalizeMapPlaceSourceId('travel-address:14029', 14029)).toBe(
      'travel-address:14029',
    );
    expect(canonicalizeMapPlaceSourceId(null, 14029)).toBe('travel-address:14029');
    expect(canonicalizeMapPlaceSourceId('other-source', 14029)).toBe('other-source');
  });

  it('treats travel-address and bare point-id spellings as the same source', () => {
    expect(
      isSameMapPlaceSource(
        { sourceId: 'travel-address:14029', pointId: 14029 },
        { sourceId: '14029', pointId: 14029 },
      ),
    ).toBe(true);
    expect(
      isSameMapPlaceSource(
        { sourceId: 'travel-address:14029', pointId: 14029 },
        { sourceId: 'travel-address:15688', pointId: 15688 },
      ),
    ).toBe(false);
  });

  it('normalizes production source_id strings through the source DTO', () => {
    const source = normalizeMapPlaceSource({
      source_id: '14029',
      point_id: 14029,
      travel_id: 389,
      article_title: 'Из Мозыря в Микашевичи через Минск',
      article_url: '/travels/iz-mozyrya-v-mikashevichi?id=389',
    });
    expect(source?.sourceId).toBe('travel-address:14029');
    expect(source?.pointId).toBe(14029);
  });
});

describe('groupMapPlaces', () => {
  it.each([500, 1000, 2000])('reads source identities linearly for %i sources of one place', (count) => {
    let sourceIdReads = 0;
    const records = Array.from({ length: count }, (_, index) => {
      const primarySource = {
        ...normalizeMapPlaceSource(RAW_LIBRARY_SOURCE_A)!,
        pointId: index + 1,
      };
      // Define after the spread so Babel cannot flatten the getter while
      // constructing the fixture and hide reads made by the real algorithm.
      Object.defineProperty(primarySource, 'sourceId', {
        get() {
          sourceIdReads += 1;
          return `travel-address:${index + 1}`;
        },
      });
      return { ...RAW_FLAT_LIBRARY_ROW_A, primarySource };
    });

    expect(sourceIdReads).toBe(0);
    const [place] = groupMapPlaces(records);

    expect(place.sources).toHaveLength(count);
    expect(place.sourceCount).toBe(count);
    // Count real source reads, not elapsed time: a scan of all accepted
    // sources grows quadratically even when the fixture runs quickly.
    expect(sourceIdReads).toBeLessThanOrEqual(count * 8);
    expect(place.sources[0]).toBe(records[0].primarySource);
    expect(place.sources[count - 1]).toBe(records[count - 1].primarySource);
  });

  it('keeps the same source identity and first-accepted order as the pager comparator', () => {
    const source = (sourceId: string, pointId: number | null): MapPlaceSource => ({
      ...normalizeMapPlaceSource(RAW_LIBRARY_SOURCE_A)!,
      sourceId,
      pointId,
    });
    const candidates = [
      source('travel-address:14029', 14029),
      source('14029', 14029),
      source('travel-address:14029', null),
      source('alternate', 14029),
      // A rejected source must not add its alternate id to the index.
      source('alternate', 15688),
      source('alternate', 999),
      // Nor may a raw-id duplicate contribute its different pointId.
      source('point-999', 999),
      source('15688', 15688),
      source('travel-address:15688', null),
      source('no-point', null),
      source('other-no-point', null),
      // Canonical identity still matches without raw-id or point-id equality.
      source('777', 777),
      source('travel-address:777', null),
      // Null/NaN pointIds must not form a shared identity in the numeric index.
      source('nan-a', Number.NaN),
      source('nan-b', Number.NaN),
      source('', null),
      source('', 888),
      source('travel-address:888', null),
    ];
    const expected: MapPlaceSource[] = [];
    for (const candidate of candidates) {
      if (!expected.some((previous) => isSameMapPlaceSource(previous, candidate))) {
        expected.push(candidate);
      }
    }

    const [place] = groupMapPlaces(candidates.map((primarySource) => ({
      ...RAW_FLAT_LIBRARY_ROW_A,
      primarySource,
    })));

    expect(place.sources).toEqual(expected);
    expect(place.sources.map(({ sourceId }) => sourceId)).toEqual([
      'travel-address:14029', 'alternate', 'point-999', 'travel-address:15688',
      'no-point', 'other-no-point', '777', 'nan-a', 'nan-b', '', 'travel-address:888',
    ]);
  });

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

  it('accepts later sources when the first place row has no source', () => {
    const firstRecord: MapPlaceRecordLike = { placeId: 501, sourceCount: 5 };
    const [place] = groupMapPlaces([
      firstRecord,
      RAW_FLAT_LIBRARY_ROW_A,
      RAW_FLAT_LIBRARY_ROW_B,
      { ...RAW_FLAT_LIBRARY_ROW_A, sourceCount: 8 },
    ]);

    expect(place.record).toBe(firstRecord);
    expect(place.primarySource).toBe(place.sources[0]);
    expect(place.sources.map(({ sourceId }) => sourceId)).toEqual([
      'travel-address:14029', 'travel-address:15688',
    ]);
    expect(place.sourceCount).toBe(8);
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

  it('merges production UUID place_id rows and keeps String(uuid) as placeKey', () => {
    const markers = groupMapPlaces([RAW_FLAT_LIBRARY_ROW_A_UUID, RAW_FLAT_LIBRARY_ROW_B_UUID]);

    expect(markers).toHaveLength(1);
    expect(markers[0].placeKey).toBe(LIBRARY_PLACE_UUID);
    expect(markers[0].placeId).toBe(LIBRARY_PLACE_UUID);
    expect(markers[0].sourceCount).toBe(2);
    expect(getMapPlaceKey(RAW_GROUPED_LIBRARY_MARKER_UUID)).toBe(LIBRARY_PLACE_UUID);
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

  it('accepts a UUID grouped DTO and canonicalizes a bare production source_id', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      createResponseMock({
        clusters: [],
        markers: [RAW_GROUPED_LIBRARY_MARKER_UUID],
        total_count: 1,
        source: 'places',
        generated_at: '2026-08-28T12:00:00Z',
      }),
    );

    const result = await fetchMapClusters({ south: 53, west: 27, north: 54, east: 28 }, 16);
    const marker = result.markers[0];

    expect(marker.placeId).toBe(LIBRARY_PLACE_UUID);
    expect(marker.sourceCount).toBe(2);
    expect(marker.primarySource?.sourceId).toBe('travel-address:14029');
    expect(marker.primarySource?.pointId).toBe(14029);
  });
});

describe('fetchTravelsForMap place passthrough', () => {
  it('keeps grouped DTO fields on a dict payload (legacy shape)', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      createResponseMock({ 0: RAW_GROUPED_LIBRARY_MARKER }),
    );

    const result = await fetchTravelsForMap(0, 10, { lat: '53.93', lng: '27.64', radius: '60' });
    const marker = (result as Record<string, unknown>)[0] as MapPlaceRecordLike;

    expect(marker.placeId).toBe(501);
    expect(marker.sourceCount).toBe(2);
    expect(marker.primarySource?.sourceId).toBe('travel-address:14029');
  });

  it('keeps UUID place identity on a results-envelope payload', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      createResponseMock({ results: [RAW_GROUPED_LIBRARY_MARKER_UUID], count: 1 }),
    );

    const result = await fetchTravelsForMap(0, 10, { lat: '53.93', lng: '27.64', radius: '60' });
    const marker = (result as Record<string, unknown>)[0] as MapPlaceRecordLike;

    expect(marker.placeId).toBe(LIBRARY_PLACE_UUID);
    expect(marker.sourceCount).toBe(2);
  });
});

describe('fetchTravelsNearRoute place passthrough', () => {
  it('accepts grouped and legacy-flat rows in one near-route payload', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      createResponseMock([RAW_GROUPED_LIBRARY_MARKER_UUID, RAW_LEGACY_PLACELESS_ROW]),
    );

    const result = await fetchTravelsNearRoute(
      [
        [27.64, 53.93],
        [27.65, 53.94],
      ],
      2,
    );
    const rows = result as unknown as MapPlaceRecordLike[];

    expect(rows).toHaveLength(2);
    expect(rows[0].placeId).toBe(LIBRARY_PLACE_UUID);
    expect(rows[0].sourceCount).toBe(2);
    expect(rows[0].primarySource?.sourceId).toBe('travel-address:14029');
    expect(rows[1].placeId).toBeUndefined();
    expect(rows[1].sourceCount).toBeUndefined();
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

  it('URL-encodes a UUID place_id for the production sources endpoint', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(createResponseMock(RAW_SOURCES_SINGLE_PAGE));

    await fetchMapPlaceSources(LIBRARY_PLACE_UUID);

    const url = String(mockFetchWithTimeout.mock.calls[0][0]);
    expect(url).toContain(`/map/places/${encodeURIComponent(LIBRARY_PLACE_UUID)}/sources/`);
    expect(url).not.toContain('/map/places/14029/sources/');
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
