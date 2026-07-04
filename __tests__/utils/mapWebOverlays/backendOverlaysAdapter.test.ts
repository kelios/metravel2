import {
  adaptBackendOverlayResponse,
  backendFeaturesToGeoJson,
  backendFeatureToLine,
  backendFeatureToPoint,
  fetchBackendOverlay,
  type BackendOverlayResponse,
} from '@/utils/mapWebOverlays/backendOverlaysAdapter';

const baseResponse = (
  overrides: Partial<BackendOverlayResponse> = {},
): BackendOverlayResponse => ({
  layer: 'osm-overpass-poi',
  bbox: { south: 53, west: 27, north: 54, east: 28 },
  source: 'overpass',
  cache_hit: false,
  min_zoom: null,
  skipped: false,
  reason: null,
  features: [],
  ...overrides,
});

describe('backendOverlaysAdapter — feature normalization', () => {
  it('normalizes a point feature to OSMPointFeature', () => {
    const point = backendFeatureToPoint({
      id: 'node/1',
      kind: 'point',
      title: 'Музей',
      lat: 53.9,
      lng: 27.56,
      tags: { tourism: 'museum', 'osm:url': 'https://osm/x' },
      popup: { title: 'Музей', subtitle: 'Описание', source_label: 'OpenStreetMap' },
    });

    expect(point).not.toBeNull();
    expect(point).toMatchObject({
      id: 'node/1',
      lat: 53.9,
      lng: 27.56,
      title: 'Музей',
      osmUrl: 'https://osm/x',
    });
    // popup.subtitle мержится в description для прежнего рендера попапа
    expect(point?.tags.description).toBe('Описание');
    expect(point?.tags.tourism).toBe('museum');
  });

  it('drops a point feature with non-finite coordinates', () => {
    expect(
      backendFeatureToPoint({ id: 'x', kind: 'point', title: 't', lat: NaN, lng: 1 }),
    ).toBeNull();
    expect(
      backendFeatureToPoint({ id: 'x', kind: 'point', title: 't' }),
    ).toBeNull();
  });

  it('normalizes a line feature from GeoJSON LineString geometry', () => {
    const line = backendFeatureToLine({
      id: 'way/2',
      kind: 'line',
      title: 'Тропа',
      geometry: {
        type: 'LineString',
        coordinates: [
          [27.0, 53.0],
          [27.1, 53.1],
        ],
      },
      tags: { route: 'hiking' },
    });

    expect(line).not.toBeNull();
    expect(line?.coords).toEqual([
      { lat: 53.0, lng: 27.0 },
      { lat: 53.1, lng: 27.1 },
    ]);
    expect(line?.title).toBe('Тропа');
    expect(line?.tags.route).toBe('hiking');
  });

  it('drops a line feature with fewer than 2 valid coords', () => {
    expect(
      backendFeatureToLine({
        id: 'way/3',
        kind: 'line',
        title: 't',
        geometry: { type: 'LineString', coordinates: [[27, 53]] },
      }),
    ).toBeNull();
  });

  it('builds a GeoJSON FeatureCollection from polygon features', () => {
    const geo = backendFeaturesToGeoJson([
      {
        id: 'poly/1',
        kind: 'polygon',
        title: 'Zanocuj',
        geometry: {
          type: 'Polygon',
          coordinates: [[[27, 53], [27.1, 53], [27.1, 53.1], [27, 53]]],
        },
        tags: { NAZWA: 'Las' },
      },
      { id: 'p/1', kind: 'point', title: 'skip me', lat: 1, lng: 2 },
    ]);

    expect(geo).not.toBeNull();
    expect((geo as { type: string }).type).toBe('FeatureCollection');
    const feats = (geo as { features: unknown[] }).features;
    expect(feats).toHaveLength(1);
    expect((feats[0] as { properties: { name: string } }).properties.name).toBe('Zanocuj');
  });
});

describe('backendOverlaysAdapter — adaptBackendOverlayResponse', () => {
  it('returns ok with split point/line/geojson buckets', () => {
    const result = adaptBackendOverlayResponse(
      baseResponse({
        cache_hit: true,
        features: [
          { id: 'n1', kind: 'point', title: 'P', lat: 53, lng: 27 },
          {
            id: 'w1',
            kind: 'line',
            title: 'L',
            geometry: { type: 'LineString', coordinates: [[27, 53], [27.1, 53.1]] },
          },
          {
            id: 'g1',
            kind: 'polygon',
            title: 'G',
            geometry: { type: 'Polygon', coordinates: [[[27, 53], [27.1, 53], [27, 53]]] },
          },
        ],
      }),
    );

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.cacheHit).toBe(true);
    expect(result.points).toHaveLength(1);
    expect(result.lines).toHaveLength(1);
    expect(result.geojson).not.toBeNull();
  });

  it('respects skipped:true with min_zoom reason as skip (no fallback)', () => {
    const result = adaptBackendOverlayResponse(
      baseResponse({ skipped: true, reason: 'min_zoom', min_zoom: 12, features: [] }),
    );
    expect(result).toEqual({ status: 'skip', reason: 'min_zoom', minZoom: 12 });
  });

  it('respects skipped:true with bbox_too_large as skip', () => {
    const result = adaptBackendOverlayResponse(
      baseResponse({ skipped: true, reason: 'bbox_too_large', features: [] }),
    );
    expect(result.status).toBe('skip');
  });

  it('treats skipped:true upstream_error as fallback', () => {
    const result = adaptBackendOverlayResponse(
      baseResponse({ skipped: true, reason: 'upstream_error: Overpass 504', features: [] }),
    );
    expect(result).toEqual({ status: 'fallback', reason: 'upstream_error: Overpass 504' });
  });
});

describe('backendOverlaysAdapter — fetchBackendOverlay', () => {
  const bbox = { south: 53, west: 27, north: 54, east: 28 };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requests the canonical /map/overlays/ endpoint with layer/bbox/zoom', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      json: async () => baseResponse(),
    }));
    (global as any).fetch = fetchMock;

    await fetchBackendOverlay({ layer: 'osm-overpass-poi', bbox, zoom: 13 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/map/overlays/');
    expect(String(url)).toContain('layer=osm-overpass-poi');
    expect(String(url)).toContain('bbox=53%2C27%2C54%2C28');
    expect(String(url)).toContain('zoom=13');
    expect((init as RequestInit).method).toBe('GET');
  });

  it('falls back on non-ok HTTP status', async () => {
    (global as any).fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    const result = await fetchBackendOverlay({ layer: 'osm-overpass-routes', bbox });
    expect(result).toEqual({ status: 'fallback', reason: 'http_503' });
  });

  it('falls back on network error', async () => {
    (global as any).fetch = jest.fn(async () => {
      throw new Error('network down');
    });
    const result = await fetchBackendOverlay({ layer: 'wfs-geojson', bbox });
    expect(result).toEqual({ status: 'fallback', reason: 'network down' });
  });

  it('falls back on invalid bbox without calling fetch', async () => {
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    const result = await fetchBackendOverlay({
      layer: 'osm-overpass-poi',
      bbox: { south: NaN, west: 27, north: 54, east: 28 },
    });
    expect(result).toEqual({ status: 'fallback', reason: 'invalid_bbox' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns skip when endpoint reports skipped min_zoom', async () => {
    (global as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => baseResponse({ skipped: true, reason: 'min_zoom', min_zoom: 12 }),
    }));
    const result = await fetchBackendOverlay({ layer: 'osm-overpass-poi', bbox, zoom: 8 });
    expect(result.status).toBe('skip');
  });
});
