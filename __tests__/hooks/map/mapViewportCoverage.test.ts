import {
  isViewportCovered,
  padViewportBBox,
  resolveViewportPublication,
  snapBBoxToTileGrid,
} from '@/hooks/map/mapViewportCoverage';

// #2450 — one coverage contract for web (useMapViewportSnapshot) and native
// (Map.ios MAP_VIEWPORT receiver): a pan inside the padded area already fetched at
// the same rounded zoom must not publish a new snapshot (= no cluster request).
describe('mapViewportCoverage', () => {
  const view = { south: 53.8, west: 27.4, north: 54.0, east: 27.8 };

  it('pads the bbox by the margin ratio on every side', () => {
    const padded = padViewportBBox(view, 0.2);
    expect(padded.south).toBeCloseTo(53.76);
    expect(padded.north).toBeCloseTo(54.04);
    expect(padded.west).toBeCloseTo(27.32);
    expect(padded.east).toBeCloseTo(27.88);
  });

  it('treats a pan of a third of the screen inside the published area as covered', () => {
    const published = resolveViewportPublication(null, { bbox: view, zoom: 12 });
    expect(published).not.toBeNull();

    // 0.4° wide view moved by 0.13° (≈ a third of the screen).
    const nudged = { south: 53.81, west: 27.53, north: 54.01, east: 27.93 };
    expect(isViewportCovered(published, { bbox: nudged, zoom: 12.2 })).toBe(true);
    expect(resolveViewportPublication(published, { bbox: nudged, zoom: 12 })).toBeNull();
  });

  it('publishes again when the viewport leaves the padded area', () => {
    const published = resolveViewportPublication(null, { bbox: view, zoom: 12 });
    const far = { south: 53.8, west: 27.9, north: 54.0, east: 28.3 };
    expect(isViewportCovered(published, { bbox: far, zoom: 12 })).toBe(false);
    const next = resolveViewportPublication(published, { bbox: far, zoom: 12 });
    expect(next?.bbox?.west).toBeCloseTo(27.76);
  });

  it('publishes again when the rounded zoom changes, even inside the area', () => {
    const published = resolveViewportPublication(null, { bbox: view, zoom: 12 });
    const inner = { south: 53.85, west: 27.5, north: 53.95, east: 27.7 };
    expect(isViewportCovered(published, { bbox: inner, zoom: 13 })).toBe(false);
    expect(resolveViewportPublication(published, { bbox: inner, zoom: 13 })).not.toBeNull();
  });

  it('snaps any viewport inside the same tiles to the same grid bbox', () => {
    const a = snapBBoxToTileGrid({ south: 53.86, west: 27.52, north: 53.94, east: 27.58 }, 12);
    const b = snapBBoxToTileGrid({ south: 53.87, west: 27.53, north: 53.93, east: 27.57 }, 12);
    expect(a).toEqual(b);
    // The snapped box is never smaller than the input.
    expect(a.south).toBeLessThanOrEqual(53.86);
    expect(a.north).toBeGreaterThanOrEqual(53.94);
    expect(a.west).toBeLessThanOrEqual(27.52);
    expect(a.east).toBeGreaterThanOrEqual(27.58);
  });

  it('snaps to tile boundaries of the requested zoom (tile width = 360/2^z)', () => {
    const z = 10;
    const snapped = snapBBoxToTileGrid({ south: 53.86, west: 27.52, north: 53.94, east: 27.6 }, z);
    const tileWidth = 360 / 2 ** z;
    const westTiles = (snapped.west + 180) / tileWidth;
    const eastTiles = (snapped.east + 180) / tileWidth;
    // Coordinates are rounded to 1e-6°, i.e. a few 1e-6 of a tile at z10.
    expect(Math.abs(westTiles - Math.round(westTiles))).toBeLessThan(1e-4);
    expect(Math.abs(eastTiles - Math.round(eastTiles))).toBeLessThan(1e-4);
    expect(eastTiles - westTiles).toBeGreaterThanOrEqual(1);
  });

  it('clamps polar latitudes to the Mercator range instead of producing NaN', () => {
    const snapped = snapBBoxToTileGrid({ south: -89.9, west: -180, north: 89.9, east: 180 }, 3);
    expect(Number.isFinite(snapped.south)).toBe(true);
    expect(Number.isFinite(snapped.north)).toBe(true);
    expect(snapped.west).toBe(-180);
    expect(snapped.east).toBe(180);
  });
});
