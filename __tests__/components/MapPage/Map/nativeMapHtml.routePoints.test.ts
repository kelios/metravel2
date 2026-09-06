/**
 * #1781 — точки маршрута планировщика на native-карте.
 *
 * Экран поездки на iPhone рисует маршрут в WebView, и до этой задачи точки там
 * были `L.circleMarker` без единого обработчика: тянуть маркер было нечем, а тап
 * по нему проваливался в карту и добавлял НОВУЮ точку поверх выбранной. Тест
 * исполняет РЕАЛЬНЫЙ код из сгенерированного HTML (тот же приём, что в
 * `nativeMapHtml.renderPoints.test.ts`) и держит четыре инварианта:
 *   1. у владельца точка маршрута — перетаскиваемый маркер;
 *   2. дроп и тап уходят в RN отдельными сообщениями моста, тап не всплывает;
 *   3. у гостя маркеры остаются неинтерактивными;
 *   4. после ручного перетаскивания кадр больше не подгоняется под маршрут.
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

/**
 * Берём весь блок от цветов маршрута до оверлеев: так в тест попадают и
 * настоящая фабрика иконки точки, и настоящий `__metravelRenderPoints`.
 */
const sliceRouteRenderCode = (): string => {
  const start = html.indexOf('const ROUTE_COLOR =');
  const end = html.indexOf('// ───────────────────────── Оверлеи (web-parity)', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
};

type Handler = (event?: unknown) => void;

interface FakeMarker {
  position: [number, number];
  options: Record<string, unknown>;
  handlers: Record<string, Handler>;
}

const createHarness = () => {
  const posted: Array<Record<string, unknown>> = [];
  const routeMarkers: FakeMarker[] = [];
  const stopPropagationCalls: unknown[] = [];
  const fitBoundsCalls: unknown[] = [];
  const setViewCalls: unknown[] = [];

  const makeLayer = () => {
    const layer = {
      added: [] as unknown[],
      clearLayers() {
        layer.added.length = 0;
      },
    };
    return layer;
  };

  const markersLayer = makeLayer();
  const clustersLayer = makeLayer();
  const routeLayer = makeLayer();

  const bounds = {
    extend: () => bounds,
    isValid: () => true,
    getCenter: () => [53.9, 27.5],
  };

  const makeShape = (kind: string, coordinates: unknown) => {
    const shape: Record<string, unknown> = {
      kind,
      coordinates,
      on: () => shape,
      bindPopup: () => shape,
      addTo: (layer: { added: unknown[] }) => {
        layer.added.push(shape);
        return shape;
      },
      getBounds: () => bounds,
    };
    return shape;
  };

  const L = {
    latLngBounds: () => bounds,
    divIcon: (options: unknown) => options,
    polyline: (coordinates: unknown) => makeShape('polyline', coordinates),
    circle: (coordinates: unknown) => makeShape('circle', coordinates),
    circleMarker: (coordinates: unknown) => makeShape('circleMarker', coordinates),
    DomEvent: {
      stopPropagation: (event: unknown) => {
        stopPropagationCalls.push(event);
      },
    },
    marker: (position: [number, number], options: Record<string, unknown> = {}) => {
      const marker: FakeMarker & Record<string, unknown> = {
        position,
        options,
        handlers: {},
        on(name: string, handler: Handler) {
          marker.handlers[name] = handler;
          return marker;
        },
        addTo(layer: { added: unknown[] }) {
          layer.added.push(marker);
          if (layer === routeLayer) routeMarkers.push(marker);
          return marker;
        },
        getLatLng: () => ({ lat: position[0], lng: position[1] }),
      };
      return marker;
    },
  };

  const map: Record<string, unknown> = {
    fitBounds: (value: unknown) => {
      fitBoundsCalls.push(value);
    },
    setView: (value: unknown) => {
      setViewCalls.push(value);
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
    ReactNativeWebView: {
      postMessage: (raw: string) => {
        posted.push(JSON.parse(raw));
      },
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

  return { renderPoints, routeMarkers, posted, stopPropagationCalls, fitBoundsCalls, map };
};

const routePayload = (interactive: boolean) => ({
  points: [],
  clusters: [],
  routePoints: [
    [53.9, 27.56],
    [53.91, 27.6],
  ],
  routeLine: [
    [53.9, 27.56],
    [53.905, 27.58],
    [53.91, 27.6],
  ],
  originalTrack: [],
  mode: 'route',
  center: { lat: 53.9, lng: 27.5 },
  usesServerClusters: false,
  pointsOnly: true,
  routePointsInteractive: interactive,
});

describe('#1781 native-карта — точки маршрута правятся с карты', () => {
  it('делает точки владельца перетаскиваемыми маркерами', () => {
    const harness = createHarness();
    harness.renderPoints(routePayload(true));

    expect(harness.routeMarkers).toHaveLength(2);
    harness.routeMarkers.forEach((marker) => {
      expect(marker.options.draggable).toBe(true);
      expect(marker.options.interactive).toBe(true);
      expect(Object.keys(marker.handlers).sort()).toEqual(['click', 'dragend', 'dragstart']);
    });
  });

  it('отдаёт дроп и тап отдельными сообщениями, гася всплытие тапа', () => {
    const harness = createHarness();
    harness.renderPoints(routePayload(true));

    const second = harness.routeMarkers[1];
    second.handlers.dragend({ target: { getLatLng: () => ({ lat: 53.95, lng: 27.7 }) } });
    second.handlers.click({ originalEvent: { type: 'click' } });

    expect(harness.posted).toEqual([
      { type: 'ROUTE_POINT_MOVED', index: 1, lat: 53.95, lng: 27.7 },
      { type: 'ROUTE_POINT_TAP', index: 1 },
    ]);
    // Без этого MAP_CLICK добавил бы новую точку поверх выбранной.
    expect(harness.stopPropagationCalls).toHaveLength(1);
  });

  it('не отправляет дроп с нефинитной позицией', () => {
    const harness = createHarness();
    harness.renderPoints(routePayload(true));

    harness.routeMarkers[0].handlers.dragend({
      target: { getLatLng: () => ({ lat: Number.NaN, lng: 27.6 }) },
    });

    expect(harness.posted).toHaveLength(0);
  });

  it('оставляет точки гостя неинтерактивными', () => {
    const harness = createHarness();
    harness.renderPoints(routePayload(false));

    expect(harness.routeMarkers).toHaveLength(2);
    harness.routeMarkers.forEach((marker) => {
      expect(marker.options.draggable).toBe(false);
      expect(marker.options.interactive).toBe(false);
      expect(Object.keys(marker.handlers)).toHaveLength(0);
    });
  });

  it('после начала перетаскивания больше не подгоняет кадр под маршрут', () => {
    const harness = createHarness();
    harness.renderPoints(routePayload(true));
    expect(harness.fitBoundsCalls).toHaveLength(1);

    harness.routeMarkers[0].handlers.dragstart();
    harness.renderPoints({ ...routePayload(true), routeLine: [[53.8, 27.4], [53.95, 27.7]] });

    expect(harness.map.__metravelRouteFitLocked).toBe(true);
    expect(harness.fitBoundsCalls).toHaveLength(1);
  });

  it('снимает защёлку кадра, когда маршрут заменён целиком', () => {
    const harness = createHarness();
    harness.renderPoints(routePayload(true));
    harness.routeMarkers[0].handlers.dragstart();
    harness.routeMarkers[0].handlers.dragend({
      target: { getLatLng: () => ({ lat: 53.95, lng: 27.7 }) },
    });
    // Тот же маршрут со сдвинутой точкой кадр не трогает.
    harness.renderPoints({
      ...routePayload(true),
      routePoints: [[53.95, 27.7], [53.91, 27.6]],
    });
    expect(harness.fitBoundsCalls).toHaveLength(1);

    // Импортированный трек не оставляет ни одной прежней точки: без снятия
    // защёлки он остался бы за пределами кадра до пересоздания карты.
    harness.renderPoints({
      ...routePayload(true),
      routePoints: [[50.07, 14.43], [49.19, 16.6]],
      routeLine: [[50.07, 14.43], [49.19, 16.6]],
    });

    expect(harness.map.__metravelRouteFitLocked).toBe(false);
    expect(harness.fitBoundsCalls).toHaveLength(2);
  });

  it('не снимает защёлку, когда перетащили единственную точку маршрута', () => {
    const harness = createHarness();
    const single = {
      ...routePayload(true),
      routePoints: [[53.9, 27.56]],
      routeLine: [],
    };
    harness.renderPoints(single);
    harness.routeMarkers[0].handlers.dragstart();
    // Сырая позиция дропа против округлённой до шести знаков в маршруте:
    // ключ защёлки обязан пережить это огрубление.
    harness.routeMarkers[0].handlers.dragend({
      target: { getLatLng: () => ({ lat: 53.90123456789012, lng: 27.56789123456789 }) },
    });
    harness.renderPoints({ ...single, routePoints: [[53.901235, 27.567891]] });

    expect(harness.map.__metravelRouteFitLocked).toBe(true);
  });

  it('нумерует ключи защёлки по полному набору, включая нерисуемые точки', () => {
    const harness = createHarness();
    const withBroken = {
      ...routePayload(true),
      routePoints: [[Number.NaN, 27.4], [53.9, 27.56], [53.91, 27.6]],
    };
    harness.renderPoints(withBroken);
    // Битая точка маркера не даёт, но индекс в наборе занимает: перетащен
    // средний маркер — это index 1, а не 0.
    harness.routeMarkers[0].handlers.dragstart();
    harness.routeMarkers[0].handlers.dragend({
      target: { getLatLng: () => ({ lat: 53.95, lng: 27.7 }) },
    });

    expect(harness.map.__metravelRouteFitLockedKeys).toEqual([
      '',
      '53.950000,27.700000',
      '53.910000,27.600000',
    ]);
  });
});
