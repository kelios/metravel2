import {
  fetchOsmCamping,
  fetchOsmPoi,
  fetchOsmRoutes,
  overpassToLines,
  overpassToPoints,
  type OSMPointFeature,
} from '@/utils/overpass';
import { fetchBackendOverlay } from '@/utils/mapWebOverlays/backendOverlaysAdapter';
import { attachOsmCampingOverlay } from '@/utils/mapWebOverlays/osmCampingOverlay';
import { attachOsmPoiOverlay } from '@/utils/mapWebOverlays/osmPoiOverlay';
import { attachOsmRoutesOverlay } from '@/utils/mapWebOverlays/osmRoutesOverlay';

jest.mock('@/utils/overpass', () => ({
  bboxAreaKm2: () => 1,
  fetchOsmCamping: jest.fn(),
  fetchOsmPoi: jest.fn(),
  fetchOsmRoutes: jest.fn(),
  overpassToLines: jest.fn(),
  overpassToPoints: jest.fn(),
}));
jest.mock('@/utils/mapWebOverlays/backendOverlaysAdapter', () => ({
  fetchBackendOverlay: jest.fn(),
}));

describe('OSM popup links', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    ['camping', attachOsmCampingOverlay],
    ['POI', attachOsmPoiOverlay],
    ['route', attachOsmRoutesOverlay],
  ])('only adds a safe href to %s popups', async (_name, attachOverlay) => {
    const websiteUrl = 'https://example.org/?a="><img src=x onerror=alert(1)>&b=2';
    const points: OSMPointFeature[] = [
      {
        id: '1',
        lat: 53.9,
        lng: 27.56,
        title: 'Blocked website',
        tags: { website: 'javascript:alert(1)' },
        osmUrl: 'data:text/html,<script>alert(1)</script>',
      },
      { id: '2', lat: 53.9, lng: 27.57, title: 'Allowed website', tags: { url: websiteUrl } },
    ];
    jest.mocked(overpassToPoints).mockReturnValue(points);
    jest.mocked(overpassToLines).mockReturnValue(points.map((point, index) => ({
      id: point.id,
      title: point.title,
      tags: {},
      coords: [{ lat: 53.9, lng: 27.56 }, { lat: 53.91, lng: 27.57 }],
      osmUrl: index === 0 ? point.osmUrl : websiteUrl,
    })));
    jest.mocked(fetchOsmCamping).mockResolvedValue({ elements: [] });
    jest.mocked(fetchOsmPoi).mockResolvedValue({ elements: [] });
    jest.mocked(fetchOsmRoutes).mockResolvedValue({ elements: [] });
    jest.mocked(fetchBackendOverlay).mockResolvedValue({ status: 'fallback', reason: 'test' });

    const marker = { bindPopup: jest.fn(), addTo: jest.fn() };
    const leaflet = {
      layerGroup: () => ({ clearLayers: jest.fn() }),
      circleMarker: () => marker,
      featureGroup: () => marker,
      polyline: () => marker,
    };
    const map = {
      getBounds: () => ({
        getSouthWest: () => ({ lat: 53.9, lng: 27.56 }),
        getNorthEast: () => ({ lat: 53.91, lng: 27.57 }),
      }),
      on: jest.fn(),
      off: jest.fn(),
    };
    const overlay = attachOverlay(leaflet, map, { debounceMs: 0 });
    overlay.start();
    try {
      await jest.runOnlyPendingTimersAsync();
      expect(marker.bindPopup).toHaveBeenCalledTimes(2);
      const [[blocked], [allowed]] = marker.bindPopup.mock.calls;
      expect(blocked).toContain('Blocked website');
      expect(blocked).not.toContain('href=');
      expect(allowed).toContain('href="https://example.org/?a=%22%3E%3Cimg%20src=x%20onerror=alert(1)%3E&amp;b=2"');
      expect(allowed).not.toContain('<img');
    } finally {
      overlay.stop();
    }
  });
});
