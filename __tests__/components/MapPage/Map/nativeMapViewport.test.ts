/**
 * #2453 — одно дебаунснутое сообщение вьюпорта на жест (вместо MAP_VIEWPORT
 * сразу + MAP_MOVED через 300 мс + MAP_VIEWPORT после каждого рендера).
 * Исполняется РЕАЛЬНЫЙ фрагмент сгенерированного HTML на фейковой карте.
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
} as never;

const html = buildNativeMapHtml({ themeColors: themeColorsStub, markerShadowColor: 'rgba(0,0,0,0.2)' });

const sliceViewportScript = (): string => {
  const start = html.indexOf('var __metravelViewportTimer = null;');
  const end = html.indexOf('window.__metravelMapZoomIn = function()', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return html.slice(start, end);
};

const createHarness = () => {
  const handlers: Record<string, Array<() => void>> = {};
  const view = { lat: 53.9, lng: 27.56, zoom: 10 };
  const map = {
    on: (name: string, handler: () => void) => {
      (handlers[name] = handlers[name] || []).push(handler);
    },
    getCenter: () => ({ lat: view.lat, lng: view.lng }),
    getZoom: () => view.zoom,
    getBounds: () => ({
      getSouthWest: () => ({ lat: view.lat - 0.1, lng: view.lng - 0.1 }),
      getNorthEast: () => ({ lat: view.lat + 0.1, lng: view.lng + 0.1 }),
    }),
  };
  const posted: Array<Record<string, unknown>> = [];
  const win = {
    ReactNativeWebView: { postMessage: (raw: string) => posted.push(JSON.parse(raw)) },
  };
  const api = new Function('map', 'window', `${sliceViewportScript()}
    return { post: __metravelPostViewport };`)(map, win) as { post: (reason: string) => void };
  const fire = (name: string) => (handlers[name] || []).forEach((handler) => handler());
  return { view, posted, fire, post: api.post };
};

describe('#2453 native viewport message', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('a zoom gesture (zoomstart → zoomend → moveend) produces exactly one MAP_VIEWPORT after 300 ms', () => {
    const h = createHarness();
    h.fire('zoomstart');
    h.view.zoom = 11;
    h.fire('zoomend');
    h.fire('moveend');
    expect(h.posted).toHaveLength(0);
    jest.advanceTimersByTime(299);
    expect(h.posted).toHaveLength(0);
    jest.advanceTimersByTime(1);
    expect(h.posted).toHaveLength(1);
    expect(h.posted[0]).toMatchObject({ type: 'MAP_VIEWPORT', zoom: 11, byUser: true, centerMoved: true });
  });

  it('an unchanged view is not re-sent, and a zoom-only change does not claim a moved centre', () => {
    const h = createHarness();
    h.fire('moveend');
    jest.advanceTimersByTime(300);
    expect(h.posted).toHaveLength(1);

    h.fire('moveend');
    jest.advanceTimersByTime(300);
    expect(h.posted).toHaveLength(1);

    h.view.zoom = 12;
    h.fire('zoomend');
    jest.advanceTimersByTime(300);
    expect(h.posted).toHaveLength(2);
    expect(h.posted[1]).toMatchObject({ zoom: 12, centerMoved: false });
  });

  it('the start-up viewport is sent immediately and does not count as a move', () => {
    const h = createHarness();
    h.post('init');
    expect(h.posted).toEqual([
      expect.objectContaining({ type: 'MAP_VIEWPORT', centerMoved: false, byUser: false }),
    ]);
  });
});
