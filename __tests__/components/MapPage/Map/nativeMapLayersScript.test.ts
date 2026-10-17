/**
 * #2453 — каналы данных native-карты в WebView: патч по ключу вместо снимка.
 *
 * Исполняется РЕАЛЬНЫЙ скрипт `buildNativeMapLayersScript()` на фейковом Leaflet
 * (слои считают addTo/removeLayer/clearLayers), без маршрутной ветки.
 */
import { buildNativeMapLayersScript } from '@/components/MapPage/Map/nativeMapLayersScript';

interface FakeLayer {
  added: unknown[];
  removed: unknown[];
  clearCalls: number;
  addLayer: (layer: unknown) => void;
  removeLayer: (layer: unknown) => void;
  clearLayers: () => void;
}

const makeLayer = (): FakeLayer => {
  const layer: FakeLayer = {
    added: [],
    removed: [],
    clearCalls: 0,
    addLayer: (item) => layer.added.push(item),
    removeLayer: (item) => {
      layer.removed.push(item);
      layer.added = layer.added.filter((entry) => entry !== item);
    },
    clearLayers: () => {
      layer.clearCalls += 1;
      layer.added = [];
    },
  };
  return layer;
};

type Channels = {
  __metravelSetMarkers: (patch: unknown) => void;
  __metravelSetClusters: (patch: unknown) => void;
  __metravelSetCenter: (center: unknown) => void;
  __metravelSetRoute: (route: unknown) => void;
  __metravelRenderPoints: (payload: unknown) => void;
};

const createHarness = () => {
  const frames: Array<() => void> = [];
  const invalidate = jest.fn();
  const fitBounds = jest.fn();
  const setView = jest.fn();
  const markersLayer = makeLayer();
  const clustersLayer = makeLayer();
  const routeLayer = makeLayer();
  const makeShape = (coordinates: unknown) => {
    const shape = {
      coordinates,
      on: () => shape,
      addTo: (layer: FakeLayer) => {
        layer.addLayer(shape);
        return shape;
      },
    };
    return shape;
  };
  const bounds = { points: 0, extend: () => { bounds.points += 1; return bounds; }, isValid: () => bounds.points > 0 };
  const L = {
    latLngBounds: () => {
      bounds.points = 0;
      return bounds;
    },
    marker: (coordinates: unknown) => makeShape(coordinates),
    circle: (coordinates: unknown) => makeShape(coordinates),
    DomEvent: { stopPropagation: () => undefined },
  };
  const map = { fitBounds, setView, getZoom: () => 10, __userCenter: [53.9, 27.5] as unknown };
  const win: Record<string, unknown> = {
    __metravelScheduleInvalidate: invalidate,
    requestAnimationFrame: (callback: () => void) => {
      frames.push(callback);
      return frames.length;
    },
  };
  new Function(
    'L', 'map', 'window', 'markersLayer', 'clustersLayer', 'routeLayer', 'markerIcon',
    'makeClusterIcon', 'disposeRoutePointClusterGroup',
    buildNativeMapLayersScript(),
  )(L, map, win, markersLayer, clustersLayer, routeLayer, {}, () => ({}), () => undefined);
  return {
    channels: win as unknown as Channels,
    markersLayer,
    clustersLayer,
    routeLayer,
    invalidate,
    fitBounds,
    setView,
    map,
    drainFrames: () => {
      while (frames.length) frames.shift()!();
    },
  };
};

const point = (key: string, coord: string, categoryName = 'Attraction') => ({
  placeKey: key,
  id: key,
  coord,
  categoryName,
  sourceCount: 1,
});

const cluster = (key: string, lat: number) => ({
  key,
  center: [lat, 27.6],
  count: 5,
  bounds: [[lat - 0.1, 27.5], [lat + 0.1, 27.7]],
});

describe('#2453 nativeMapLayersScript — keyed channels', () => {
  it('patches markers by key: removing one point removes only its marker, no clearLayers', () => {
    const h = createHarness();
    h.channels.__metravelSetMarkers({
      add: [point('a', '53.9,27.5'), point('b', '53.8,27.6'), point('c', '53.7,27.7')],
      removeKeys: [],
      reset: true,
    });
    h.drainFrames();
    expect(h.markersLayer.added).toHaveLength(3);
    const clearsBefore = h.markersLayer.clearCalls;
    const kept = h.markersLayer.added.slice(0, 2);

    h.channels.__metravelSetMarkers({ add: [], removeKeys: ['c'] });
    h.drainFrames();
    expect(h.markersLayer.removed).toHaveLength(1);
    expect(h.markersLayer.clearCalls).toBe(clearsBefore);
    expect(h.markersLayer.added).toEqual(kept);
  });

  it('one added point creates exactly one marker; existing markers keep their identity', () => {
    const h = createHarness();
    h.channels.__metravelSetMarkers({ add: [point('a', '53.9,27.5')], removeKeys: [], reset: true });
    h.drainFrames();
    const first = h.markersLayer.added[0];
    h.channels.__metravelSetMarkers({ add: [point('b', '53.8,27.6')], removeKeys: [] });
    h.drainFrames();
    expect(h.markersLayer.added).toHaveLength(2);
    expect(h.markersLayer.added[0]).toBe(first);
  });

  it('the snapshot form diffs inside the WebView: the same set again changes nothing', () => {
    const h = createHarness();
    const snapshot = { points: [point('a', '53.9,27.5'), point('b', '53.8,27.6')], clusters: [], mode: 'radius' };
    h.channels.__metravelRenderPoints(snapshot);
    h.drainFrames();
    const markers = [...h.markersLayer.added];
    h.channels.__metravelRenderPoints({ ...snapshot, points: snapshot.points.map((item) => ({ ...item })) });
    h.drainFrames();
    expect(h.markersLayer.added).toEqual(markers);
    expect(h.markersLayer.removed).toHaveLength(0);
  });

  it('a camping zone circle is removed together with its marker', () => {
    const h = createHarness();
    h.channels.__metravelSetMarkers({
      add: [point('camp', '53.9,27.5', 'Кемпинг'), point('b', '53.8,27.6')],
      removeKeys: [],
      reset: true,
    });
    h.drainFrames();
    expect(h.markersLayer.added).toHaveLength(3);
    h.channels.__metravelSetMarkers({ add: [], removeKeys: ['camp'] });
    expect(h.markersLayer.removed).toHaveLength(2);
    expect(h.markersLayer.added).toHaveLength(1);
  });

  it('patches clusters by geometric key: an unchanged cluster is not recreated', () => {
    const h = createHarness();
    h.channels.__metravelSetClusters({ add: [cluster('k1', 53.9), cluster('k2', 53.5)], removeKeys: [], reset: true });
    const survivor = h.clustersLayer.added[1];
    const clearsAfterReset = h.clustersLayer.clearCalls;
    h.channels.__metravelSetClusters({ add: [cluster('k3', 53.1)], removeKeys: ['k1'] });
    expect(h.clustersLayer.added).toHaveLength(2);
    expect(h.clustersLayer.added).toContain(survivor);
    expect(h.clustersLayer.removed).toHaveLength(1);
    expect(h.clustersLayer.clearCalls).toBe(clearsAfterReset);
  });

  it('positions once on the first markers push and never re-fits radius mode afterwards', () => {
    const h = createHarness();
    h.channels.__metravelSetCenter({ lat: 52.1, lng: 23.7 });
    h.channels.__metravelSetRoute({ mode: 'radius' });
    expect(h.fitBounds).not.toHaveBeenCalled();
    expect(h.setView).not.toHaveBeenCalled();

    h.channels.__metravelSetMarkers({ add: [point('a', '53.9,27.5')], removeKeys: [], reset: true });
    expect(h.fitBounds).toHaveBeenCalledTimes(1);
    h.channels.__metravelSetMarkers({ add: [point('b', '53.8,27.6')], removeKeys: [] });
    h.channels.__metravelSetCenter({ lat: 50.06, lng: 19.94 });
    expect(h.fitBounds).toHaveBeenCalledTimes(1);
    expect(h.map.__userCenter).toEqual([50.06, 19.94]);
  });

  it('no data channel schedules invalidateSize', () => {
    const h = createHarness();
    h.channels.__metravelSetCenter({ lat: 52.1, lng: 23.7 });
    h.channels.__metravelSetRoute({ mode: 'radius' });
    h.channels.__metravelSetClusters({ add: [cluster('k1', 53.9)], removeKeys: [], reset: true });
    h.channels.__metravelSetMarkers({ add: [point('a', '53.9,27.5')], removeKeys: [], reset: true });
    h.channels.__metravelRenderPoints({ points: [], clusters: [], mode: 'radius' });
    h.drainFrames();
    expect(h.invalidate).not.toHaveBeenCalled();
  });
});
