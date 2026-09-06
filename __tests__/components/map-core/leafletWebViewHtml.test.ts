// #990 — юнит-тесты единого native-Leaflet-HTML-билдера и регресс-инварианты
// трёх движков после консолидации (behavior-preserving).
import {
  buildLeafletWebViewHtml,
  buildInvalidateSchedulerScript,
  ESCAPE_HTML_FN_SCRIPT,
  LEAFLET_ATTRIBUTION_LINK_BRIDGE_SCRIPT,
  LEAFLET_WEBVIEW_RESET_CSS,
} from '@/components/map-core/leafletWebViewHtml';
import {
  buildNativeMapHtml,
  toNativeOverlayLayerDefinitions,
} from '@/components/MapPage/Map/nativeMapHtml';
import { USER_LOCATION_MARKER_SIZE } from '@/components/MapPage/Map/mapMarkerStyles';
import { buildNativeWeatherTempLabelsScript } from '@/components/MapPage/Map/nativeWeatherTempLabelsScript';
import {
  NATIVE_BASE_MIN_ZOOM_GLOBAL,
  NATIVE_BASE_MIN_ZOOM_SCRIPT,
  buildNativeTileBridgeScript,
} from '@/components/MapPage/Map/nativeTileBridgeScript';
import {
  WEB_MAP_OVERLAY_LAYERS,
  getThemedBaseAttribution,
  getThemedBaseMaxZoom,
} from '@/config/mapWebLayers';
import { buildTravelMapNativeHtml } from '@/components/MapPage/Map/travelMapNativeHtml';
import { buildQuestNativeMapHtml } from '@/components/quests/questNativeMapHtml';

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

const flushPromiseQueue = async () => {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
};

const createNativeUserLocationHarness = (html: string) => {
  const userLocationStart = html.indexOf(
    "const USER_LOCATION_PANE = 'metravel-user-location'",
  );
  const userLocationEnd = html.indexOf('// #843', userLocationStart);
  const centerStart = html.indexOf('map.__realUserLocation = null;');
  const centerEnd = html.indexOf('// Базовая подложка', centerStart);
  expect(userLocationStart).toBeGreaterThan(-1);
  expect(userLocationEnd).toBeGreaterThan(userLocationStart);
  expect(centerStart).toBeGreaterThan(-1);
  expect(centerEnd).toBeGreaterThan(centerStart);

  const layers: Array<{ kind: 'accuracy' | 'marker'; coordinates: [number, number] }> = [];
  const state = { throwOnMarkerAdd: false, throwOnClear: false };
  const userLayer = {
    addTo: jest.fn(() => userLayer),
    clearLayers: jest.fn(() => {
      if (state.throwOnClear) {
        state.throwOnClear = false;
        throw new Error('clear failed');
      }
      layers.splice(0, layers.length);
    }),
  };
  const markerOptions: Array<Record<string, unknown>> = [];
  const userLocationPane = { style: {} as Record<string, string> };
  const map = {
    __realUserLocation: null as [number, number] | null,
    createPane: jest.fn(() => userLocationPane),
    getZoom: jest.fn(() => 12),
    setView: jest.fn(),
  };
  const L = {
    layerGroup: jest.fn(() => userLayer),
    divIcon: jest.fn((options: Record<string, unknown>) => options),
    circle: jest.fn((coordinates: [number, number]) => ({
      addTo: jest.fn(() => {
        layers.push({ kind: 'accuracy', coordinates });
      }),
    })),
    marker: jest.fn((coordinates: [number, number], options: Record<string, unknown>) => {
      markerOptions.push(options);
      return {
        bindPopup: jest.fn(),
        addTo: jest.fn(() => {
          if (state.throwOnMarkerAdd) throw new Error('marker add failed');
          layers.push({ kind: 'marker', coordinates });
        }),
      };
    }),
  };
  const windowObject: Record<string, unknown> = {};
  const compile = new Function(
    'L',
    'map',
    'window',
    `var __metravelProgrammaticMoveUntil = 0;
     ${html.slice(userLocationStart, userLocationEnd)}
     ${html.slice(centerStart, centerEnd)}
     return {
       render: window.__metravelRenderUserLocation,
       clear: window.__metravelClearUserLocation,
       center: window.__metravelMapCenterOnUser
     };`,
  );

  return {
    ...compile(L, map, windowObject),
    layers,
    map,
    markerOptions,
    state,
    userLocationPane,
  } as {
    render: (lat: unknown, lng: unknown) => boolean;
    clear: () => void;
    center: (lat?: unknown, lng?: unknown) => boolean;
    layers: typeof layers;
    map: typeof map;
    markerOptions: typeof markerOptions;
    state: typeof state;
    userLocationPane: typeof userLocationPane;
  };
};

const createWeatherControllerFactory = ({
  L,
  map,
  overlayBBox,
  bboxKey,
  fetchImpl,
  AbortControllerImpl,
}: {
  L: unknown;
  map: unknown;
  overlayBBox: () => unknown;
  bboxKey: (bounds: unknown) => string;
  fetchImpl: typeof fetch;
  AbortControllerImpl?: typeof AbortController;
}) => {
  const compile = new Function(
    'L',
    'map',
    'overlayBBox',
    'bboxKey',
    'fetch',
    'AbortController',
    `${buildNativeWeatherTempLabelsScript()}
     OWM_API_KEY = 'test-key';
     return makeWeatherTempLabelsController;`,
  );

  return compile(
    L,
    map,
    overlayBBox,
    bboxKey,
    fetchImpl,
    AbortControllerImpl,
  ) as (layerGroup: unknown, definition: { minZoom: number }) => {
    start: () => void;
    stop: () => void;
  };
};

describe('buildLeafletWebViewHtml (shared skeleton)', () => {
  it('emits a complete document with inline Leaflet + reset + map container', () => {
    const html = buildLeafletWebViewHtml({ bodyScript: '/*BODY_MARKER*/' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<div id="map"></div>');
    // Общий reset присутствует всегда
    expect(html).toContain('#map { width: 100%; height: 100%; }');
    expect(html).toContain(LEAFLET_WEBVIEW_RESET_CSS);
    // bodyScript инлайнится дословно
    expect(html).toContain('/*BODY_MARKER*/');
    expect(html).toContain(LEAFLET_ATTRIBUTION_LINK_BRIDGE_SCRIPT);
    expect(html).toContain("closest('.leaflet-control-attribution a[href]')");
    expect(html).toContain("type: 'OPEN_URL'");
    // Внутри одного <script> тела карты
    expect(html.indexOf('/*BODY_MARKER*/')).toBeGreaterThan(html.indexOf('<div id="map">'));
  });

  it('includes engine headStyles after the reset block', () => {
    const html = buildLeafletWebViewHtml({
      headStyles: '.qmark { border: none; }',
      bodyScript: 'noop;',
    });
    expect(html).toContain('.qmark { border: none; }');
    // headStyles идёт после reset (внутри общего <style>)
    expect(html.indexOf('.qmark')).toBeGreaterThan(html.indexOf('#map { width: 100%'));
  });

  it('omits an extra newline when no headStyles are given', () => {
    const html = buildLeafletWebViewHtml({ bodyScript: 'noop;' });
    expect(html).not.toContain('.qmark');
  });
});

describe('buildInvalidateSchedulerScript', () => {
  it('window-prop mode declares the scheduler on window under the given name', () => {
    const script = buildInvalidateSchedulerScript({
      schedulerName: '__metravelScheduleInvalidate',
      helperName: '__metravelInvalidateMapSize',
      mode: 'window-prop',
    });
    expect(script).toContain('window.__metravelScheduleInvalidate = function(stage) {');
    expect(script).toContain('function __metravelInvalidateMapSize(stage) {');
    // Общая retry-каскад-задержка
    expect(script).toContain('[80, 240, 600].forEach');
    expect(script).toContain('map.invalidateSize({ animate: false, pan: false })');
    // Регистрация (init + listeners) через window-qualified имя
    expect(script).toContain("window.__metravelScheduleInvalidate('init')");
    expect(script).toContain("window.addEventListener('resize'");
    expect(script).toContain("window.addEventListener('orientationchange'");
    expect(script).toContain("document.addEventListener('visibilitychange'");
  });

  it('function-decl mode declares a local function and can skip registration', () => {
    const script = buildInvalidateSchedulerScript({
      schedulerName: 'scheduleMapRefresh',
      helperName: 'refreshMapLayout',
      mode: 'function-decl',
      emitRegistration: false,
    });
    expect(script).toContain('function scheduleMapRefresh(stage) {');
    expect(script).toContain('function refreshMapLayout(stage) {');
    expect(script).toContain('[80, 240, 600].forEach');
    // Не window-prop
    expect(script).not.toContain('window.scheduleMapRefresh = function');
    // Регистрация подавлена
    expect(script).not.toContain("scheduleMapRefresh('init')");
  });
});

describe('ESCAPE_HTML_FN_SCRIPT', () => {
  it('escapes all five XSS-critical characters', () => {
    expect(ESCAPE_HTML_FN_SCRIPT).toContain('function escapeHtml(value) {');
    expect(ESCAPE_HTML_FN_SCRIPT).toContain("replace(/&/g, '&amp;')");
    expect(ESCAPE_HTML_FN_SCRIPT).toContain("replace(/</g, '&lt;')");
    expect(ESCAPE_HTML_FN_SCRIPT).toContain("replace(/>/g, '&gt;')");
    expect(ESCAPE_HTML_FN_SCRIPT).toContain("replace(/\"/g, '&quot;')");
    expect(ESCAPE_HTML_FN_SCRIPT).toContain("replace(/'/g, '&#39;')");
  });
});

describe('buildNativeMapHtml — engine regression invariants', () => {
  const html = buildNativeMapHtml({ themeColors: themeColorsStub, markerShadowColor: 'rgba(0,0,0,0.2)' });

  it('preserves all RN-called global names', () => {
    expect(html).toContain('window.__metravelRenderPoints = function');
    expect(html).toContain('window.__metravelSetOverlay = function');
    expect(html).toContain('window.__metravelRenderUserLocation = function');
    expect(html).toContain('window.__metravelClearUserLocation = function');
    expect(html).toContain('window.__metravelMapZoomIn = function');
    expect(html).toContain('window.__metravelMapZoomOut = function');
    expect(html).toContain('window.__metravelMapCenterOnUser = function');
    expect(html).toContain('window.__metravelSetTile = function');
  });

  it('keeps the native user marker visible above POIs and commits location atomically', () => {
    expect(html).toContain("const USER_LOCATION_PANE = 'metravel-user-location'");
    expect(html).toContain("userLocationPane.style.zIndex = '625'");
    expect(html).toContain("userLocationPane.style.pointerEvents = 'none'");
    expect(html).toContain("className: 'metravel-pin-marker metravel-pin-marker-user'");
    // #1780 — размер маркера объявлен один раз в mapMarkerStyles и общий с web,
    // поэтому проверяем контракт, а не переписанное число.
    expect(html).toContain(
      `iconSize: [${USER_LOCATION_MARKER_SIZE}, ${USER_LOCATION_MARKER_SIZE}]`,
    );
    expect(html).toContain('pane: USER_LOCATION_PANE');
    expect(html).toContain('interactive: false');
    expect(html).toContain('const dot = L.marker([lat, lng]');
    expect(html).not.toContain('const dot = L.circleMarker([lat, lng]');

    const addMarkerIndex = html.indexOf('dot.addTo(userLayer)');
    const commitLocationIndex = html.indexOf('map.__realUserLocation = [lat, lng]');
    expect(addMarkerIndex).toBeGreaterThan(-1);
    expect(commitLocationIndex).toBeGreaterThan(addMarkerIndex);
    expect(html).toContain(
      'userLayer.clearLayers();\n              map.__realUserLocation = null;\n              return false;',
    );
    expect(html).toContain('map.__realUserLocation = null;\n            return false;');
  });

  it('replaces the user layer without duplicates and never centers after a failed render', () => {
    const harness = createNativeUserLocationHarness(html);

    expect(harness.userLocationPane.style).toEqual({
      zIndex: '625',
      pointerEvents: 'none',
    });
    expect(harness.center(50.0680351, 19.849518)).toBe(true);
    expect(harness.layers).toEqual([
      { kind: 'accuracy', coordinates: [50.0680351, 19.849518] },
      { kind: 'marker', coordinates: [50.0680351, 19.849518] },
    ]);
    expect(harness.markerOptions[0]).toMatchObject({
      pane: 'metravel-user-location',
      interactive: false,
    });
    expect(harness.map.setView).toHaveBeenCalledWith([50.0680351, 19.849518], 13);

    expect(harness.render(52.2297, 21.0122)).toBe(true);
    expect(harness.layers).toEqual([
      { kind: 'accuracy', coordinates: [52.2297, 21.0122] },
      { kind: 'marker', coordinates: [52.2297, 21.0122] },
    ]);

    harness.state.throwOnMarkerAdd = true;
    harness.map.setView.mockClear();
    expect(harness.center(53.9, 27.56)).toBe(false);
    expect(harness.layers).toEqual([]);
    expect(harness.map.__realUserLocation).toBeNull();
    expect(harness.map.setView).not.toHaveBeenCalled();
  });

  it('clears the center target even if Leaflet layer cleanup fails', () => {
    const harness = createNativeUserLocationHarness(html);
    expect(harness.render(50.0680351, 19.849518)).toBe(true);

    harness.state.throwOnClear = true;
    expect(() => harness.clear()).not.toThrow();
    expect(harness.map.__realUserLocation).toBeNull();
  });

  it('preserves bridge message protocols', () => {
    expect(html).toContain("type: 'TILE_REQ'");
    expect(html).toContain("type: 'SELECT_PLACE'");
    expect(html).toContain("type: 'MAP_CLICK'");
    expect(html).toContain("type: 'READY'");
    expect(html).toContain('MAP_MOVED');
    expect(html).toContain('MAP_VIEWPORT');
  });

  it('keeps the shared invalidate scheduler + retry cascade', () => {
    expect(html).toContain('window.__metravelScheduleInvalidate = function');
    expect(html).toContain('function __metravelInvalidateMapSize(stage) {');
    expect(html).toContain('[80, 240, 600].forEach');
  });

  // #1561 — движок собирается из `nativeTileBridgeScript`, а lifecycle-регрессия
  // (`__tests__/components/MapPage/Map/nativeTileBridge.lifecycle.test.ts`) монтирует
  // мост своим `L.map({ minZoom })`. Значит она останется зелёной, даже если из
  // реального HTML пропадёт преамбула или `minZoom`, — а на устройстве вернётся
  // серая подложка. Здесь закреплена именно ПРОДОВАЯ проводка фикса.
  it('wires the #1561 base-tile floor and unique tile keys into the shipped HTML', () => {
    const preambleIndex = html.indexOf(NATIVE_BASE_MIN_ZOOM_SCRIPT);
    const mapInitIndex = html.indexOf("L.map('map'");

    expect(preambleIndex).toBeGreaterThan(-1);
    expect(mapInitIndex).toBeGreaterThan(-1);
    // Нижний зум обязан быть посчитан ДО инициализации карты.
    expect(preambleIndex).toBeLessThan(mapInitIndex);
    expect(html).toContain(`minZoom: window.${NATIVE_BASE_MIN_ZOOM_GLOBAL}`);
    expect(html).toContain(
      buildNativeTileBridgeScript({
        attribution: getThemedBaseAttribution(),
        maxZoom: getThemedBaseMaxZoom(),
      }),
    );
    // Ключ pending уникален на DOM-тайл, снятый тайл чистит свою запись, а пустой
    // ответ RN виден как ошибка тайла, а не как «загруженная» серая клетка.
    expect(html).toContain("'#' + __metravelTileSeq");
    expect(html).toContain('_removeTile: function(key) {');
    expect(html).toContain("done(new Error('tile-unavailable'), img)");
    // Граница едет за вьюпортом после layout/поворота.
    expect(html).toContain('map.setMinZoom(next)');
  });

  it('keeps escapeHtml and camping-zone logic', () => {
    expect(html).toContain('function escapeHtml(value) {');
    expect(html).toContain('TileBridge');
  });

  it('keeps numeric weather labels in the native overlay contract', () => {
    const definitions = toNativeOverlayLayerDefinitions(WEB_MAP_OVERLAY_LAYERS);
    const definition = definitions.find(({ id }) => id === 'weather-temp-labels');

    expect(definition).toMatchObject({
      id: 'weather-temp-labels',
      kind: 'weather-temp-labels',
      minZoom: 6,
    });
    expect(definitions.map(({ id }) => id)).toEqual(
      WEB_MAP_OVERLAY_LAYERS.map(({ id }) => id),
    );
    expect(html).toContain("def.kind === 'weather-temp-labels'");
    expect(html).toContain("className: 'metravel-temp-label'");
    expect(html).toContain('api.openweathermap.org/data/2.5/weather');
    expect(() => new Function(buildNativeWeatherTempLabelsScript())).not.toThrow();
  });

  it('keeps visible licence attribution for the base map and enabled overlays', () => {
    const definitions = toNativeOverlayLayerDefinitions(WEB_MAP_OVERLAY_LAYERS);
    const serializedDefinitions = JSON.stringify(definitions);

    expect(definitions.every(({ attribution }) => Boolean(attribution))).toBe(true);
    expect(html).toContain('openstreetmap.org/copyright');
    expect(serializedDefinitions).toContain('Weather data provided by OpenWeather');
    expect(serializedDefinitions).toContain('https://openweathermap.org/');
    expect(serializedDefinitions).toContain('data:image/png;base64,');
    expect(serializedDefinitions).toContain('alt=\\"OpenWeather logo\\"');
    expect(html).toContain('map.attributionControl.addAttribution(def.attribution)');
    expect(html).toContain('map.attributionControl.removeAttribution(def.attribution)');
  });

  it('discards an obsolete OWM response when the viewport moves during loading', async () => {
    jest.useFakeTimers();
    try {
      type PendingResponse = {
        resolve: (response: unknown) => void;
      };
      const pending: PendingResponse[] = [];
      const fetchImpl = jest.fn(
        () =>
          new Promise((resolve) => {
            pending.push({ resolve });
          }),
      ) as unknown as typeof fetch;
      let moveEnd: (() => void) | undefined;
      let boundsKey = 'first';
      const map = {
        getZoom: jest.fn(() => 8),
        on: jest.fn((event: string, handler: () => void) => {
          if (event === 'moveend') moveEnd = handler;
        }),
        off: jest.fn(),
      };
      const L = {
        divIcon: jest.fn((options) => options),
        marker: jest.fn(() => ({
          setZIndexOffset: jest.fn(),
          addTo: jest.fn(),
        })),
      };
      const layerGroup = { clearLayers: jest.fn() };
      const makeController = createWeatherControllerFactory({
        L,
        map,
        overlayBBox: () => ({ south: 0, west: 0, north: 1, east: 1 }),
        bboxKey: () => boundsKey,
        fetchImpl,
        // Exercise the cleanup fallback used by WebViews without AbortController.
        AbortControllerImpl: undefined,
      });
      const controller = makeController(layerGroup, { minZoom: 6 });

      controller.start();
      jest.advanceTimersByTime(600);
      expect(pending).toHaveLength(12);

      boundsKey = 'second';
      moveEnd?.();
      jest.advanceTimersByTime(600);
      expect(pending).toHaveLength(24);

      pending.slice(0, 12).forEach(({ resolve }, index) => {
        resolve({
          ok: true,
          json: async () => ({
            coord: { lat: 10 + index, lon: 20 + index },
            main: { temp: index },
            name: `old-${index}`,
          }),
        });
      });
      await flushPromiseQueue();
      expect(L.marker).not.toHaveBeenCalled();

      pending.slice(12).forEach(({ resolve }, index) => {
        resolve({
          ok: true,
          json: async () => ({
            coord: { lat: 30 + index, lon: 40 + index },
            main: { temp: index },
            name: `current-${index}`,
          }),
        });
      });
      await flushPromiseQueue();
      expect(L.marker).toHaveBeenCalledTimes(12);

      controller.stop();
      expect(map.off).toHaveBeenCalledWith('moveend', expect.any(Function));
    } finally {
      jest.useRealTimers();
    }
  });

  it('retries OWM rate limits only after the controller backoff', async () => {
    jest.useFakeTimers();
    try {
      const fetchImpl = jest.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => ({}),
      })) as unknown as typeof fetch;
      const map = {
        getZoom: jest.fn(() => 8),
        on: jest.fn(),
        off: jest.fn(),
      };
      const L = {
        divIcon: jest.fn(),
        marker: jest.fn(),
      };
      const makeController = createWeatherControllerFactory({
        L,
        map,
        overlayBBox: () => ({ south: 0, west: 0, north: 1, east: 1 }),
        bboxKey: () => 'stable',
        fetchImpl,
        AbortControllerImpl: undefined,
      });
      const controller = makeController({ clearLayers: jest.fn() }, { minZoom: 6 });

      controller.start();
      jest.advanceTimersByTime(600);
      await flushPromiseQueue();
      expect(fetchImpl).toHaveBeenCalledTimes(12);

      jest.advanceTimersByTime(1999);
      expect(fetchImpl).toHaveBeenCalledTimes(12);
      jest.advanceTimersByTime(1);
      expect(fetchImpl).toHaveBeenCalledTimes(24);

      controller.stop();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('buildQuestNativeMapHtml — engine regression invariants', () => {
  const html = buildQuestNativeMapHtml({
    points: [{ lat: 53.9, lng: 27.56 }] as any,
    routeLineTrack: [
      [27.56, 53.9],
      [27.57, 53.91],
    ],
    routeIsRouted: true,
    groupedPoints: [{ lat: 53.9, lng: 27.56, indexes: [1], titles: ['A'] }] as any,
    colors: themeColorsStub,
    interactive: false,
    questNavProviders: [{ app: 'google' as any, label: 'Google' }],
  });

  it('preserves quest global names', () => {
    expect(html).toContain('window.__qmZoomIn = function');
    expect(html).toContain('window.__qmZoomOut = function');
    expect(html).toContain('window.setActiveStep = function');
    expect(html).toContain('window.__qmExportPng = function');
  });

  it('preserves quest bridge protocols', () => {
    expect(html).toContain("type: 'quest-map-status'");
    expect(html).toContain("type: 'quest-map-nav'");
    expect(html).toContain("type: 'quest-map-png'");
  });

  it('preserves the interactive gate for ScrollView-preview maps', () => {
    expect(html).toContain('var mapInteractive = false;');
    expect(html).toContain('dragging: mapInteractive');
    expect(html).toContain('touchZoom: mapInteractive');
    expect(html).toContain('scrollWheelZoom: mapInteractive');
    expect(html).toContain('doubleClickZoom: mapInteractive');
    expect(html).toContain('boxZoom: mapInteractive');
    expect(html).toContain('keyboard: mapInteractive');
    expect(html).toContain('tap: mapInteractive');
  });

  it('keeps the shared scheduler (local function) + PNG renderer + extra map listener', () => {
    expect(html).toContain('function scheduleMapRefresh(stage) {');
    expect(html).toContain('function refreshMapLayout(stage) {');
    expect(html).toContain('[80, 240, 600].forEach');
    // PNG-renderer script injected (off-DOM canvas exporter helpers present)
    expect(html).toContain('function __qmPostPng');
    expect(html).toContain('metravel.by/proxy/tiles/osm/');
    expect(html).not.toContain('cartocdn');
    expect(html).not.toContain('CARTO');
    // Quest-specific extra registration preserved in body
    expect(html).toContain("map.on('moveend zoomend', function() { scheduleMapRefresh('map-change'); });");
  });

  it('uses the direct native tile provider (no TileBridge offline mux)', () => {
    expect(html).toContain('L.tileLayer(');
    expect(html).not.toContain('TileBridge');
    expect(html).toContain('openstreetmap.org/copyright');
  });
});

describe('buildTravelMapNativeHtml — engine regression invariants', () => {
  const html = buildTravelMapNativeHtml({
    points: [{ coord: '53.9,27.56', address: 'A' }],
    routes: [{ coords: [[53.9, 27.56], [53.91, 27.57]] }],
    highlightCoord: '53.9,27.56',
    center: [53.9, 27.56],
    initialZoom: 11,
    surfaceColor: '#ffffff',
    routeColor: '#e07840',
    birdMarkerHtml: '<div>BIRD_TIP</div>',
  });

  it('preserves bridge message protocols', () => {
    expect(html).toContain("type: 'OPEN_URL'");
    expect(html).toContain("type: 'POINT_SELECT'");
    expect(html).toContain("type: 'CLEAR_SELECTED_POINT'");
  });

  it('preserves the RESIZE message handler and bird divIcon', () => {
    expect(html).toContain("parsed.type === 'RESIZE'");
    expect(html).toContain("document.addEventListener('message', handleResizeMessage)");
    expect(html).toContain('metravel-marker');
    expect(html).toContain('<div>BIRD_TIP</div>');
  });

  it('uses the lighter whenReady fit (not the [80,240,600] scheduler)', () => {
    expect(html).toContain('map.whenReady(function()');
    expect(html).not.toContain('[80, 240, 600].forEach');
    expect(html).toContain('L.tileLayer(');
    expect(html).toContain('openstreetmap.org/copyright');
  });
});
