import type { WebMapLayerDefinition } from '../../config/mapWebLayers';
import { WEB_MAP_BASE_LAYERS, WEB_MAP_OVERLAY_LAYERS } from '../../config/mapWebLayers';

describe('WEB_MAP_OVERLAY_LAYERS (waymarked trails)', () => {
  it('includes Waymarked Trails overlays for hiking and cycling', () => {
    const hiking = WEB_MAP_OVERLAY_LAYERS.find((l: WebMapLayerDefinition) => l.id === 'waymarked-hiking');
    const cycling = WEB_MAP_OVERLAY_LAYERS.find((l: WebMapLayerDefinition) => l.id === 'waymarked-cycling');

    expect(hiking).toBeTruthy();
    expect(hiking?.kind).toBe('tile');
    expect(hiking?.url).toContain('tile.waymarkedtrails.org/hiking');

    expect(cycling).toBeTruthy();
    expect(cycling?.kind).toBe('tile');
    expect(cycling?.url).toContain('tile.waymarkedtrails.org/cycling');
  });
});

describe('mapWebLayers invariants', () => {
  it('has at least one base layer and exactly one defaultEnabled base layer', () => {
    expect(Array.isArray(WEB_MAP_BASE_LAYERS)).toBe(true);
    expect(WEB_MAP_BASE_LAYERS.length).toBeGreaterThan(0);
    const defaults = WEB_MAP_BASE_LAYERS.filter((l: WebMapLayerDefinition) => Boolean(l.defaultEnabled));
    expect(defaults.length).toBe(1);
  });

  it('layer ids are unique across base + overlays', () => {
    const ids = [...WEB_MAP_BASE_LAYERS, ...WEB_MAP_OVERLAY_LAYERS].map((l: WebMapLayerDefinition) => l.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all layers have non-empty title and kind', () => {
    for (const layer of [...WEB_MAP_BASE_LAYERS, ...WEB_MAP_OVERLAY_LAYERS]) {
      expect(typeof layer.title).toBe('string');
      expect(layer.title.trim().length).toBeGreaterThan(0);
      expect(typeof layer.kind).toBe('string');
      expect(layer.kind.trim().length).toBeGreaterThan(0);
    }
  });

  it('tile layers that have URL must declare attribution', () => {
    const all = [...WEB_MAP_BASE_LAYERS, ...WEB_MAP_OVERLAY_LAYERS];
    const tileLayers = all.filter((l) => l.kind === 'tile');
    for (const layer of tileLayers) {
      expect(typeof layer.url).toBe('string');
      expect(layer.url.trim().length).toBeGreaterThan(0);
      expect(typeof layer.attribution).toBe('string');
      expect((layer.attribution || '').trim().length).toBeGreaterThan(0);
    }
  });

  it('wms layers define wmsParams.layers', () => {
    const wmsLayers = WEB_MAP_OVERLAY_LAYERS.filter((l: WebMapLayerDefinition) => l.kind === 'wms');
    for (const layer of wmsLayers) {
      expect(layer.wmsParams).toBeTruthy();
      expect(typeof layer.wmsParams?.layers).toBe('string');
      expect(layer.wmsParams?.layers?.trim().length).toBeGreaterThan(0);
    }
  });

  it('wfs-geojson layers define wfsParams.typeName', () => {
    const wfsLayers = WEB_MAP_OVERLAY_LAYERS.filter((l: WebMapLayerDefinition) => l.kind === 'wfs-geojson');
    for (const layer of wfsLayers) {
      expect(layer.wfsParams).toBeTruthy();
      expect(typeof layer.wfsParams?.typeName).toBe('string');
      expect(layer.wfsParams?.typeName?.trim().length).toBeGreaterThan(0);
    }
  });
});
