import { WEB_MAP_OVERLAY_LAYERS } from '@/src/config/mapWebLayers';

describe('WEB_MAP_OVERLAY_LAYERS (waymarked trails)', () => {
  it('includes Waymarked Trails overlays for hiking and cycling', () => {
    const hiking = WEB_MAP_OVERLAY_LAYERS.find((l) => l.id === 'waymarked-hiking');
    const cycling = WEB_MAP_OVERLAY_LAYERS.find((l) => l.id === 'waymarked-cycling');

    expect(hiking).toBeTruthy();
    expect(hiking?.kind).toBe('tile');
    expect(hiking?.url).toContain('tile.waymarkedtrails.org/hiking');

    expect(cycling).toBeTruthy();
    expect(cycling?.kind).toBe('tile');
    expect(cycling?.url).toContain('tile.waymarkedtrails.org/cycling');
  });
});
