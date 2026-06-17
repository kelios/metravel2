import type { WebMapLayerDefinition } from '../../config/mapWebLayers';
import {
  WEB_MAP_BASE_LAYERS,
  WEB_MAP_OVERLAY_LAYERS,
  getExclusiveGroupSiblings,
  WEATHER_TEMP_LAYER_ID,
  WEATHER_TEMP_LABELS_LAYER_ID,
} from '../../config/mapWebLayers';

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

  it('default web base tile layer declares maxZoom for marker clustering', () => {
    const defaultBaseLayer =
      WEB_MAP_BASE_LAYERS.find((l: WebMapLayerDefinition) => Boolean(l.defaultEnabled)) ||
      WEB_MAP_BASE_LAYERS[0];

    expect(defaultBaseLayer).toBeTruthy();
    expect(defaultBaseLayer?.kind).toBe('tile');
    expect(defaultBaseLayer?.maxZoom).toBe(19);
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

describe('getExclusiveGroupSiblings', () => {
  it('экспортируемые константы совпадают с реальными id в конфиге', () => {
    expect(WEATHER_TEMP_LAYER_ID).toBe('weather-temp');
    expect(WEATHER_TEMP_LABELS_LAYER_ID).toBe('weather-temp-labels');
    expect(WEB_MAP_OVERLAY_LAYERS.some((l) => l.id === WEATHER_TEMP_LAYER_ID)).toBe(true);
    expect(WEB_MAP_OVERLAY_LAYERS.some((l) => l.id === WEATHER_TEMP_LABELS_LAYER_ID)).toBe(true);
  });

  it('для weather-temp возвращает weather-clouds и weather-precip (в любом порядке)', () => {
    const siblings = getExclusiveGroupSiblings('weather-temp');
    expect(siblings).toHaveLength(2);
    expect(siblings).toContain('weather-clouds');
    expect(siblings).toContain('weather-precip');
    // сам слой не должен быть среди братьев
    expect(siblings).not.toContain('weather-temp');
  });

  it('для weather-clouds возвращает weather-temp и weather-precip', () => {
    const siblings = getExclusiveGroupSiblings('weather-clouds');
    expect(siblings).toHaveLength(2);
    expect(siblings).toContain('weather-temp');
    expect(siblings).toContain('weather-precip');
  });

  it('для weather-precip возвращает weather-temp и weather-clouds', () => {
    const siblings = getExclusiveGroupSiblings('weather-precip');
    expect(siblings).toHaveLength(2);
    expect(siblings).toContain('weather-temp');
    expect(siblings).toContain('weather-clouds');
  });

  it('для слоя без exclusiveGroup возвращает пустой массив', () => {
    // nature-water не имеет exclusiveGroup
    expect(getExclusiveGroupSiblings('nature-water')).toEqual([]);
  });

  it('для weather-temp-labels (не в группе) возвращает пустой массив', () => {
    // подписи °C намеренно НЕ входят в heatmap-группу
    expect(getExclusiveGroupSiblings('weather-temp-labels')).toEqual([]);
  });

  it('для несуществующего id возвращает пустой массив', () => {
    expect(getExclusiveGroupSiblings('nonexistent-layer-xyz')).toEqual([]);
  });
});
