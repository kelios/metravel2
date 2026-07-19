// #990 — юнит-тесты единого native-Leaflet-HTML-билдера и регресс-инварианты
// трёх движков после консолидации (behavior-preserving).
import {
  buildLeafletWebViewHtml,
  buildInvalidateSchedulerScript,
  ESCAPE_HTML_FN_SCRIPT,
  LEAFLET_WEBVIEW_RESET_CSS,
} from '@/components/map-core/leafletWebViewHtml';
import { buildNativeMapHtml } from '@/components/MapPage/Map/nativeMapHtml';
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

  it('keeps escapeHtml and camping-zone logic', () => {
    expect(html).toContain('function escapeHtml(value) {');
    expect(html).toContain('TileBridge');
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
    expect(html).toContain('basemaps.cartocdn.com');
    // Quest-specific extra registration preserved in body
    expect(html).toContain("map.on('moveend zoomend', function() { scheduleMapRefresh('map-change'); });");
  });

  it('uses the direct native tile provider (no TileBridge offline mux)', () => {
    expect(html).toContain('L.tileLayer(');
    expect(html).not.toContain('TileBridge');
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
  });
});
