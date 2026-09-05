/**
 * #1773 — регрессия порционной отрисовки маркеров native-карты.
 *
 * «Мои точки» на iPhone открывались пустым холстом: `__metravelRenderPoints`
 * прилетал ~11 раз подряд и каждый раз синхронно строил 869 маркеров, поэтому
 * уже доставленные тайлы не успевали отрисоваться. Тест исполняет РЕАЛЬНЫЙ код
 * рендера точек, вырезанный из сгенерированного HTML (тот же приём, что в
 * `leafletWebViewHtml.test.ts`), и проверяет три инварианта фикса:
 *   1. набор ≥800 точек доезжает до слоя маркеров ЦЕЛИКОМ, но порциями;
 *   2. повторный вызов с тем же набором точек слой не пересобирает;
 *   3. смена набора отменяет хвост незавершённой порционной отрисовки.
 */
import { buildNativeMapHtml } from '@/components/MapPage/Map/nativeMapHtml';

const themeColorsStub = {
  surface: '#ffffff',
  text: '#111111',
  textOnDark: '#ffffff',
  primary: '#0a84ff',
  primaryDark: '#0060df',
  success: '#34c759',
  warning: '#f0a020',
  warningDark: '#b87513',
  textOnPrimary: '#ffffff',
  accent: '#ff6a00',
} as any;

const html = buildNativeMapHtml({
  themeColors: themeColorsStub,
  markerShadowColor: 'rgba(0,0,0,0.2)',
});

const sliceRenderPoints = (): string => {
  const start = html.indexOf('window.__metravelRenderPoints = function(payload) {');
  const end = html.indexOf('// ───────────────────────── Оверлеи (web-parity)', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
};

interface FakeLayer {
  added: unknown[];
  clearCalls: number;
}

const createHarness = () => {
  const frames: Array<() => void> = [];
  const makeLayer = (): FakeLayer & { clearLayers: () => void } => {
    const layer = {
      added: [] as unknown[],
      clearCalls: 0,
      clearLayers() {
        layer.clearCalls += 1;
        layer.added.length = 0;
      },
    };
    return layer;
  };

  const markersLayer = makeLayer();
  const clustersLayer = makeLayer();
  const routeLayer = makeLayer();

  const makeGeometry = (kind: string, coordinates: unknown) => {
    const shape = {
      kind,
      coordinates,
      on: () => shape,
      bindPopup: () => shape,
      addTo: (layer: FakeLayer) => {
        layer.added.push(shape);
        return shape;
      },
      getBounds: () => bounds,
    };
    return shape;
  };

  const bounds = {
    extendCalls: 0,
    extend() {
      bounds.extendCalls += 1;
      return bounds;
    },
    isValid: () => true,
    getCenter: () => [53.9, 27.5],
  };

  const L = {
    latLngBounds: () => bounds,
    marker: (coordinates: unknown) => makeGeometry('marker', coordinates),
    circle: (coordinates: unknown) => makeGeometry('circle', coordinates),
    polyline: (coordinates: unknown) => makeGeometry('polyline', coordinates),
    circleMarker: (coordinates: unknown) => makeGeometry('circleMarker', coordinates),
    DomEvent: { stopPropagation: () => undefined },
  };

  const map = {
    fitBounds: () => undefined,
    setView: () => undefined,
    getZoom: () => 10,
    __userCenter: null as unknown,
  };

  const windowStub: Record<string, unknown> = {
    __metravelScheduleInvalidate: () => undefined,
    requestAnimationFrame: (callback: () => void) => {
      frames.push(callback);
      return frames.length;
    },
  };

  const renderPoints = new Function(
    'L',
    'map',
    'window',
    'markersLayer',
    'clustersLayer',
    'routeLayer',
    'markerIcon',
    'makeClusterIcon',
    'ROUTE_COLOR',
    'ROUTE_WARNING',
    'ROUTE_SURFACE',
    'ROUTE_START',
    'ORIGINAL_TRACK_COLOR',
    '__metravelPostViewport',
    `var __metravelDidInitialRadiusPosition = false;
     ${sliceRenderPoints()}
     return window.__metravelRenderPoints;`,
  )(
    L,
    map,
    windowStub,
    markersLayer,
    clustersLayer,
    routeLayer,
    {},
    () => ({}),
    '#1',
    '#2',
    '#3',
    '#4',
    '#5',
    () => undefined,
  ) as (payload: unknown) => void;

  return {
    renderPoints,
    markersLayer,
    /** Прокручивает ровно N кадров порционной отрисовки. */
    runFrames: (count: number) => {
      for (let index = 0; index < count; index += 1) {
        const frame = frames.shift();
        if (!frame) return;
        frame();
      }
    },
    drainFrames: () => {
      let guard = 0;
      while (frames.length > 0 && guard < 200) {
        frames.shift()!();
        guard += 1;
      }
    },
    pendingFrames: () => frames.length,
  };
};

const makePoints = (count: number, seed = 0) =>
  Array.from({ length: count }, (_, index) => ({
    id: seed + index + 1,
    placeKey: `p-${seed + index + 1}`,
    coord: `${(53.5 + index * 0.001).toFixed(4)},${(27.2 + index * 0.001).toFixed(4)}`,
    categoryName: 'Attraction',
  }));

const payloadFor = (points: unknown[]) => ({
  points,
  clusters: [],
  routePoints: [],
  routeLine: [],
  originalTrack: [],
  mode: 'radius',
  center: { lat: 53.9, lng: 27.5 },
  usesServerClusters: false,
  pointsOnly: false,
});

describe('#1773 __metravelRenderPoints — порционная отрисовка маркеров', () => {
  it('доводит набор в 840 точек до слоя маркеров целиком, но не одним кадром', () => {
    const harness = createHarness();

    harness.renderPoints(payloadFor(makePoints(840)));
    // Первый кадр ещё не выполнялся: поток отдан тайлам, слой пуст.
    expect(harness.markersLayer.added).toHaveLength(0);
    expect(harness.pendingFrames()).toBe(1);

    harness.runFrames(1);
    expect(harness.markersLayer.added).toHaveLength(100);

    harness.drainFrames();
    expect(harness.markersLayer.added).toHaveLength(840);
  });

  it('не пересобирает слой на повторном вызове с тем же набором точек', () => {
    const harness = createHarness();
    const points = makePoints(840);

    harness.renderPoints(payloadFor(points));
    harness.drainFrames();
    const clearsAfterFirst = harness.markersLayer.clearCalls;
    const firstMarker = harness.markersLayer.added[0];

    harness.renderPoints(payloadFor(points));
    harness.drainFrames();

    expect(harness.markersLayer.clearCalls).toBe(clearsAfterFirst);
    expect(harness.markersLayer.added).toHaveLength(840);
    expect(harness.markersLayer.added[0]).toBe(firstMarker);
  });

  it('отменяет хвост прошлой отрисовки, когда набор точек сменился', () => {
    const harness = createHarness();

    harness.renderPoints(payloadFor(makePoints(840)));
    harness.runFrames(2);
    expect(harness.markersLayer.added).toHaveLength(200);

    harness.renderPoints(payloadFor(makePoints(10, 5000)));
    harness.drainFrames();

    // Ни одного маркера из отменённого набора: слой ровно по новому набору.
    expect(harness.markersLayer.added).toHaveLength(10);
  });
});
