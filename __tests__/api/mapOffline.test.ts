const mockFetchWithTimeout = jest.fn();

jest.mock('@/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: (...args: unknown[]) => mockFetchWithTimeout(...args),
}));

import { fetchOfflineMapPoints, serializeOfflineMapBBox } from '@/api/mapOffline';

const response = (payload: unknown, etag = '"map-v1"') => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: { get: (name: string) => name.toLowerCase() === 'etag' ? etag : null },
  text: jest.fn().mockResolvedValue(JSON.stringify(payload)),
});

describe('map offline bulk index', () => {
  beforeEach(() => mockFetchWithTimeout.mockReset());

  it('serializes bbox in the backend west,south,east,north order', () => {
    expect(serializeOfflineMapBBox({ west: 23, south: 52, east: 33, north: 56 }))
      .toBe('23,52,33,56');
  });

  it('loads, normalizes and validates the public point index', async () => {
    mockFetchWithTimeout.mockResolvedValue(response([
      {
        id: 7,
        title: 'Замок',
        lat: 53.9,
        lng: 27.5,
        address: 'Минск',
        categoryName: 'История',
        thumb: 'https://cdn.test/castle.webp',
        urlTravel: '/travels/minsk',
        slug: 'minsk',
      },
      { id: 8, title: 'Broken', lat: 200, lng: 27 },
    ]));

    const result = await fetchOfflineMapPoints({ west: 23, south: 52, east: 33, north: 56 });

    expect(mockFetchWithTimeout.mock.calls[0][0]).toContain('bbox=23%2C52%2C33%2C56');
    expect(result).toEqual({
      etag: '"map-v1"',
      points: [expect.objectContaining({ id: 7, title: 'Замок', lat: 53.9, lng: 27.5 })],
      notModified: false,
    });
  });

  it('reuses the persisted point index on ETag 304', async () => {
    const cachedPoints = [{
      id: 7,
      title: 'Saved point',
      lat: 53.9,
      lng: 27.56,
      address: 'Saved address',
      categoryName: 'museum',
      thumb: '',
      urlTravel: '',
      slug: '',
    }];
    mockFetchWithTimeout.mockResolvedValue({
      ok: false,
      status: 304,
      headers: { get: () => '"map-v1"' },
    });

    await expect(fetchOfflineMapPoints(
      { west: 23, south: 52, east: 33, north: 56 },
      { etag: '"map-v1"', cachedPoints },
    )).resolves.toEqual({
      points: cachedPoints,
      etag: '"map-v1"',
      notModified: true,
    });
    expect(mockFetchWithTimeout).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'If-None-Match': '"map-v1"' }),
      }),
      30_000,
    );
  });

  it('rejects 304 without a persisted point index', async () => {
    mockFetchWithTimeout.mockResolvedValue({
      ok: false,
      status: 304,
      headers: { get: () => '"map-v1"' },
    });

    await expect(fetchOfflineMapPoints(
      { west: 23, south: 52, east: 33, north: 56 },
      { etag: '"map-v1"' },
    )).rejects.toThrow('OFFLINE_MAP_POINTS_304_WITHOUT_CACHE');
  });
});
