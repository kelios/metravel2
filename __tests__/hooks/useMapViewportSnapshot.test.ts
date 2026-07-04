import { readMapViewportSnapshot } from '@/hooks/map/useMapViewportSnapshot';

describe('readMapViewportSnapshot', () => {
  it('derives bbox and zoom from a Leaflet-like map instance', () => {
    const snapshot = readMapViewportSnapshot(
      {
        getZoom: () => 8.6,
        getBounds: () => ({
          getSouth: () => 51,
          getWest: () => 23,
          getNorth: () => 56,
          getEast: () => 32,
        }),
      },
      11,
    );

    expect(snapshot).toEqual({
      bbox: { south: 51, west: 23, north: 56, east: 32 },
      zoom: 8.6,
    });
  });

  it('falls back to zoom without bbox when bounds are not available', () => {
    expect(readMapViewportSnapshot({ getZoom: () => 9 }, 11)).toEqual({
      bbox: null,
      zoom: 9,
    });
  });
});
