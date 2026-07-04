import {
  fetchMapClusters,
  serializeMapClusterBBox,
  type MapClusterBBox,
} from '@/api/map';

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

const BBOX: MapClusterBBox = { south: 51, west: 23, north: 56.5, east: 33 };

// Prod-shape fixture (confirmed against https://metravel.by/api/map/clusters/).
const CLUSTER_PAYLOAD = {
  clusters: [
    {
      id: '4a280ab8739d09d5',
      center: { lat: 53.885445, lng: 27.545189 },
      count: 23,
      bounds: { south: 53.789, west: 27.45, north: 53.918, east: 27.587 },
      preview_items: [
        {
          id: 14321,
          point_id: 14321,
          title: 'Аккаунты в instagram',
          lng: '26.8430203',
          lat: '51.8865137',
          address: 'Синагога главная (1793), Столин',
          country_name: 'Беларусь',
          country_code: 'by',
          travelImageThumbUrl: '/address-image/5960/conversions/x-thumb_400_wp.webp',
        },
      ],
    },
  ],
  markers: [],
  total_count: 118,
  source: 'travel_addresses',
  generated_at: '2026-07-04T13:00:00Z',
};

const MARKER_PAYLOAD = {
  clusters: [],
  markers: [
    {
      id: 15677,
      point_id: 15677,
      title: 'Минск за выходные',
      lng: '27.5567000',
      lat: '53.9047000',
      address: 'Верхний город',
      country_name: 'Беларусь',
      country_code: 'by',
      image: 'http://metravel.by/travel-image/1/full.jpg',
    },
  ],
  total_count: 1,
  source: 'travel_addresses',
  generated_at: '2026-07-04T13:00:00Z',
};

describe('serializeMapClusterBBox', () => {
  test('serializes as south,west,north,east (BE #719 contract)', () => {
    expect(serializeMapClusterBBox(BBOX)).toBe('51,23,56.5,33');
  });
});

describe('fetchMapClusters', () => {
  beforeEach(() => {
    mockFetchWithTimeout.mockReset();
    mockFetchWithTimeout.mockResolvedValue(createResponseMock(CLUSTER_PAYLOAD));
  });

  test('requests bbox + rounded zoom', async () => {
    await fetchMapClusters(BBOX, 8.6, undefined, { throwOnError: true });
    const url = String(mockFetchWithTimeout.mock.calls[0][0]);
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    expect(params.get('bbox')).toBe('51,23,56.5,33');
    expect(params.get('zoom')).toBe('9');
  });

  test('adds q and category filters when provided', async () => {
    await fetchMapClusters(BBOX, 8, { query: '  замок ', category: [5, '10', 'bad'] });
    const url = String(mockFetchWithTimeout.mock.calls[0][0]);
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    expect(params.get('q')).toBe('замок');
    // normalizeNumericArray drops non-numeric + sorts
    expect(params.get('category')).toBe('5,10');
  });

  test('omits empty filters', async () => {
    await fetchMapClusters(BBOX, 8, { query: '   ', category: [] });
    const url = String(mockFetchWithTimeout.mock.calls[0][0]);
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    expect(params.has('q')).toBe(false);
    expect(params.has('category')).toBe(false);
  });

  test('adapts clusters to internal shape', async () => {
    const result = await fetchMapClusters(BBOX, 8);
    expect(result.totalCount).toBe(118);
    expect(result.clusters).toHaveLength(1);
    const c = result.clusters[0];
    expect(c.id).toBe('4a280ab8739d09d5');
    expect(c.center).toEqual({ lat: 53.885445, lng: 27.545189 });
    expect(c.count).toBe(23);
    expect(c.bounds.north).toBe(53.918);
    expect(c.previewItems).toHaveLength(1);
    const p = c.previewItems[0];
    expect(p.id).toBe(14321);
    expect(p.coord).toBe('51.8865137,26.8430203'); // lat,lng
    expect(p.countryName).toBe('Беларусь');
    expect(p.countryCode).toBe('by');
  });

  test('adapts markers (high zoom) and upgrades http image to https', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(createResponseMock(MARKER_PAYLOAD));
    const result = await fetchMapClusters(BBOX, 16);
    expect(result.clusters).toHaveLength(0);
    expect(result.markers).toHaveLength(1);
    const m = result.markers[0];
    expect(m.coord).toBe('53.9047000,27.5567000');
    expect(m.address).toBe('Верхний город');
    expect(m.imageUrl).toBe('https://metravel.by/travel-image/1/full.jpg');
  });

  test('drops bare media-endpoint placeholder images', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      createResponseMock({
        clusters: [],
        markers: [{ id: 1, lat: '53.9', lng: '27.5', address: 'X', travelImageThumbUrl: '/address-image/' }],
        total_count: 1,
      }),
    );
    const result = await fetchMapClusters(BBOX, 16);
    expect(result.markers[0].travelImageThumbUrl).toBe('');
    expect(result.markers[0].imageUrl).toBe('');
  });

  test('returns empty result on non-ok without throwOnError', async () => {
    mockFetchWithTimeout.mockResolvedValue(createResponseMock({}, false, 500));
    const result = await fetchMapClusters(BBOX, 8);
    expect(result.clusters).toEqual([]);
    expect(result.markers).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  test('returns empty result on malformed payload', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(createResponseMock('not-an-object'));
    const result = await fetchMapClusters(BBOX, 8);
    expect(result).toMatchObject({ clusters: [], markers: [], totalCount: 0 });
  });
});
