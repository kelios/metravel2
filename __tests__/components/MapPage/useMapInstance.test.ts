import { getThemedBaseLayerOptions } from '@/components/MapPage/Map/useMapInstance';
import { CARTO_DARK_SUBDOMAINS, OSM_PROXY_MAX_ZOOM } from '@/config/mapWebLayers';

describe('getThemedBaseLayerOptions', () => {
  it('does not enable detectRetina for the light OSM proxy layer', () => {
    const options = getThemedBaseLayerOptions(false) as Record<string, unknown>;

    expect(options.maxZoom).toBe(OSM_PROXY_MAX_ZOOM);
    expect(options.detectRetina).toBeUndefined();
    expect(options.subdomains).toBeUndefined();
  });

  it('keeps CARTO subdomains for the dark base layer', () => {
    const options = getThemedBaseLayerOptions(true) as Record<string, unknown>;

    expect(options.subdomains).toBe(CARTO_DARK_SUBDOMAINS);
    expect(options.detectRetina).toBeUndefined();
  });
});
