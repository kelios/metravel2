/**
 * #1847 — оригинальный трек в WebView native-карты.
 *
 * Многотрековый GPX/KML (три кольца похода Mullerthal Trail в одном файле)
 * приезжал сюда одним плоским списком координат и рисовался одной ломаной:
 * между концом одного кольца и началом следующего появлялась прямая длиной
 * 8,6 км, которой в файле нет. Тест исполняет РЕАЛЬНЫЙ код из сгенерированного
 * HTML (тот же приём, что в `nativeMapHtml.routePoints.test.ts`) и держит два
 * инварианта: каждый трек — своя полилиния, и ни одна линия не соединяет
 * соседние треки между собой.
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
  accentDark: '#c25100',
} as any;

const html = buildNativeMapHtml({
  themeColors: themeColorsStub,
  markerShadowColor: 'rgba(0,0,0,0.2)',
});

const sliceRouteRenderCode = (): string => {
  const start = html.indexOf('const ROUTE_COLOR =');
  const end = html.indexOf('// ───────────────────────── Оверлеи (web-parity)', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
};

interface FakeShape {
  kind: string;
  coordinates: unknown;
  options: Record<string, unknown>;
}

const createHarness = () => {
  const makeLayer = () => {
    const layer = {
      added: [] as FakeShape[],
      clearLayers() {
        layer.added.length = 0;
      },
    };
    return layer;
  };

  const markersLayer = makeLayer();
  const clustersLayer = makeLayer();
  const routeLayer = makeLayer();
  const extended: unknown[] = [];

  const bounds = {
    extend: (point: unknown) => {
      extended.push(point);
      return bounds;
    },
    isValid: () => true,
    getCenter: () => [49.8, 6.36],
  };

  const makeShape = (kind: string, coordinates: unknown, options: Record<string, unknown> = {}) => {
    const shape: Record<string, unknown> = {
      kind,
      coordinates,
      options,
      on: () => shape,
      bindPopup: () => shape,
      addTo: (layer: { added: unknown[] }) => {
        layer.added.push(shape);
        return shape;
      },
      getBounds: () => bounds,
      getLatLng: () => ({ lat: 0, lng: 0 }),
    };
    return shape;
  };

  const L = {
    latLngBounds: () => bounds,
    divIcon: (options: unknown) => options,
    polyline: (coordinates: unknown, options: Record<string, unknown>) =>
      makeShape('polyline', coordinates, options),
    circle: (coordinates: unknown) => makeShape('circle', coordinates),
    circleMarker: (coordinates: unknown) => makeShape('circleMarker', coordinates),
    DomEvent: { stopPropagation: () => undefined },
    marker: (position: [number, number], options: Record<string, unknown> = {}) =>
      makeShape('marker', position, options),
  };

  // #1851 — кадр проверяется по вызовам, а не по «не упало»: без точек маршрута
  // подгонка обязана идти по границам оригинала, и её не должен перебивать
  // setView одиночной точки.
  const fitBoundsCalls: unknown[] = [];
  const setViewCalls: unknown[] = [];

  const map: Record<string, unknown> = {
    fitBounds: (target: unknown) => {
      fitBoundsCalls.push(target);
    },
    setView: (target: unknown) => {
      setViewCalls.push(target);
    },
    getZoom: () => 10,
    __userCenter: null,
  };

  const windowStub: Record<string, unknown> = {
    __metravelScheduleInvalidate: () => undefined,
    requestAnimationFrame: (callback: () => void) => {
      callback();
      return 1;
    },
    ReactNativeWebView: { postMessage: () => undefined },
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
    '__metravelPostViewport',
    `var __metravelDidInitialRadiusPosition = false;
     ${sliceRouteRenderCode()}
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
    () => undefined,
  ) as (payload: unknown) => void;

  const polylines = () => routeLayer.added.filter((shape) => shape.kind === 'polyline');

  return { renderPoints, polylines, extended, fitBoundsCalls, setViewCalls, bounds };
};

// Два кольца похода: Route 2 стоит в Эхтернахе, Route 3 — в Мюллертале.
const ECHTERNACH_RING = [
  [49.8136, 6.4212],
  [49.8201, 6.4288],
  [49.8136, 6.4212],
];
const MUELLERTHAL_RING = [
  [49.7909, 6.3065],
  [49.7982, 6.3141],
  [49.7909, 6.3065],
];

const payload = (
  originalTrackSegments: number[][][],
  overrides: Record<string, unknown> = {},
) => ({
  points: [],
  clusters: [],
  routePoints: [
    [49.8136, 6.4212],
    [49.7909, 6.3065],
  ],
  routeLine: [
    [49.8136, 6.4212],
    [49.7909, 6.3065],
  ],
  originalTrackSegments,
  mode: 'route',
  center: { lat: 49.8, lng: 6.36 },
  usesServerClusters: false,
  pointsOnly: true,
  routePointsInteractive: false,
  ...overrides,
});

// Обычный порядок при импорте похода: файл уже загружен, точки маршрута ещё нет.
const withoutRoutePoints = (originalTrackSegments: number[][][]) =>
  payload(originalTrackSegments, { routePoints: [], routeLine: [] });

describe('#1847 native-карта — многотрековый оригинал', () => {
  it('рисует по полилинии на каждый трек файла, не соединяя их между собой', () => {
    const harness = createHarness();

    harness.renderPoints(payload([ECHTERNACH_RING, MUELLERTHAL_RING]));

    // Линия маршрута плюс по линии на каждое кольцо.
    const lines = harness.polylines();
    expect(lines).toHaveLength(3);
    expect(lines[1].coordinates).toEqual(ECHTERNACH_RING);
    expect(lines[2].coordinates).toEqual(MUELLERTHAL_RING);
    // Ни одна линия оригинала не содержит точки соседнего кольца — той самой
    // прямой Эхтернах–Мюллерталь на карте больше нет.
    expect(lines[1].coordinates).not.toContainEqual(MUELLERTHAL_RING[0]);
    expect(lines[2].coordinates).not.toContainEqual(ECHTERNACH_RING[0]);
    // Стиль слоя общий для всех сегментов — легенда по-прежнему одна.
    expect(lines[1].options.color).toBe(lines[2].options.color);
    expect(lines[1].options.weight).toBe(3);
  });

  it('досаживает кадр на границы всех сегментов, а не только первого', () => {
    const harness = createHarness();

    harness.renderPoints(payload([ECHTERNACH_RING, MUELLERTHAL_RING]));

    expect(harness.extended).toContainEqual(ECHTERNACH_RING[1]);
    expect(harness.extended).toContainEqual(MUELLERTHAL_RING[1]);
  });

  it('пропускает вырожденный сегмент и не роняет остальные', () => {
    const harness = createHarness();

    harness.renderPoints(payload([[[49.8136, 6.4212]], MUELLERTHAL_RING]));

    const lines = harness.polylines();
    expect(lines).toHaveLength(2);
    expect(lines[1].coordinates).toEqual(MUELLERTHAL_RING);
  });

  it('без оригинала оставляет только линию маршрута', () => {
    const harness = createHarness();

    harness.renderPoints(payload([]));

    expect(harness.polylines()).toHaveLength(1);
  });
});

/**
 * #1851 — весь route-блок висел под `routePoints.length >= 1`, и оригинальный
 * трек, попавший внутрь него в #1496, наследовал гейт чужой линии. Файл грузят
 * раньше, чем расставляют точки: слой оставался пустым, а легенда на RN-стороне
 * гейтится независимо и трек обещала.
 */
describe('#1851 native-карта — оригинал без точек маршрута', () => {
  it('рисует все сегменты файла, когда точек маршрута ещё нет', () => {
    const harness = createHarness();

    harness.renderPoints(withoutRoutePoints([ECHTERNACH_RING, MUELLERTHAL_RING]));

    const lines = harness.polylines();
    // Линии маршрута нет — рисовать её не от чего; оба кольца файла на месте.
    expect(lines).toHaveLength(2);
    expect(lines[0].coordinates).toEqual(ECHTERNACH_RING);
    expect(lines[1].coordinates).toEqual(MUELLERTHAL_RING);
  });

  it('наводит кадр на границы оригинала, а не оставляет карту на дефолтном центре', () => {
    const harness = createHarness();

    harness.renderPoints(withoutRoutePoints([ECHTERNACH_RING, MUELLERTHAL_RING]));

    expect(harness.fitBoundsCalls).toEqual([harness.bounds]);
    // Центровка одиночной точки маршрута сюда не заходит: её setView с зумом 14
    // перебил бы подгонку по треку.
    expect(harness.setViewCalls).toHaveLength(0);
    expect(harness.extended).toContainEqual(ECHTERNACH_RING[1]);
    expect(harness.extended).toContainEqual(MUELLERTHAL_RING[1]);
  });

  it('без точек маршрута и без оригинала в route-слой ничего не кладёт', () => {
    const harness = createHarness();

    harness.renderPoints(withoutRoutePoints([]));

    expect(harness.polylines()).toHaveLength(0);
  });
});
