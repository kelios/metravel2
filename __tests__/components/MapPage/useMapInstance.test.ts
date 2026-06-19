import { getThemedBaseLayerOptions } from '@/components/MapPage/Map/useMapInstance';
import { OSM_PROXY_MAX_ZOOM } from '@/config/mapWebLayers';

describe('getThemedBaseLayerOptions', () => {
  it('always returns the light OSM proxy layer options regardless of theme', () => {
    const options = getThemedBaseLayerOptions() as Record<string, unknown>;

    expect(options.maxZoom).toBe(OSM_PROXY_MAX_ZOOM);
    // OSM-прокси без субдоменов и без detectRetina (см. комментарий в хуке).
    expect(options.subdomains).toBeUndefined();
    expect(options.detectRetina).toBeUndefined();
  });
});
