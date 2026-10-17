/**
 * #2452 — онлайн-режим базовой подложки native-карты: WebView грузит тайлы сам,
 * мост к дисковому кэшу RN — только запасной путь.
 *
 * Тот же РЕАЛЬНЫЙ Leaflet 1.9.4, что и в lifecycle-тесте #1561, но слой собран
 * с шаблоном URL. Проверяются контрольные точки карточки:
 *   * в онлайне `createTile` не шлёт TILE_REQ (тайл = `<img src=шаблон>`);
 *   * после сетевой ошибки тайла — ровно один TILE_REQ {fallback:true};
 *   * батч `__metravelSetTiles` дорисовывает тайл из моста;
 *   * офлайн → онлайн — ровно один redraw (#1665), онлайн → офлайн — без redraw;
 *   * тайл, снятый до ответа моста, отменяется сообщением TILE_CANCEL;
 *   * после догрузки вьюпорта уходит одно MAP_TILES_STATE.
 */
import * as L from 'leaflet';

import {
  NATIVE_BASE_MIN_ZOOM_SCRIPT,
  buildNativeTileBridgeScript,
} from '@/components/MapPage/Map/nativeTileBridgeScript';

const TEMPLATE = 'https://metravel.by/proxy/tiles/osm/{z}/{x}/{y}.png';
const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

type Message = Record<string, unknown> & { type: string };

type BridgeWindow = typeof window & {
  ReactNativeWebView?: { postMessage: (raw: string) => void };
  __metravelBaseMinZoom?: number;
  __metravelResolveBaseMinZoom?: unknown;
  __metravelSetTile?: unknown;
  __metravelSetTiles?: (items: Array<[string, string]>) => void;
  __metravelSetTileNetwork?: (online: boolean, forceRedraw?: boolean) => boolean;
  __metravelGetTileStats?: () => Record<string, number>;
  __metravelBaseTileLayer?: L.GridLayer;
  __metravelCaptureTiles?: (keys: string[], gen: number) => void;
  __metravelCancelTileCapture?: () => void;
  __metravelCreateCaptureCanvas?: () => unknown;
};

const createContainer = (width: number, height: number): HTMLElement => {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientWidth', { get: () => width, configurable: true });
  Object.defineProperty(el, 'clientHeight', { get: () => height, configurable: true });
  document.body.appendChild(el);
  return el;
};

const mount = () => {
  const win = window as BridgeWindow;
  const messages: Message[] = [];
  win.ReactNativeWebView = {
    postMessage: (raw: string) => {
      messages.push(JSON.parse(raw) as Message);
    },
  };
  Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 812, configurable: true });
  new Function(NATIVE_BASE_MIN_ZOOM_SCRIPT)();
  const container = createContainer(375, 812);
  const map = L.map(container, {
    zoomControl: false,
    fadeAnimation: false,
    zoomAnimation: false,
    markerZoomAnimation: false,
    minZoom: win.__metravelBaseMinZoom,
  }).setView([53.9, 27.56], 10);
  new Function('L', 'map', buildNativeTileBridgeScript({
    attribution: '© OpenStreetMap',
    maxZoom: 19,
    tileUrlTemplate: TEMPLATE,
  }))(L, map);

  const tileImgs = () =>
    Array.from(document.querySelectorAll<HTMLImageElement>('.leaflet-tile-pane img.leaflet-tile'));
  const ofType = (type: string) => messages.filter((message) => message.type === type);
  return {
    map,
    container,
    messages,
    ofType,
    tileImgs,
    layer: win.__metravelBaseTileLayer as L.GridLayer,
    stats: () => win.__metravelGetTileStats?.() as Record<string, number>,
    setNetwork: (online: boolean, force?: boolean) => win.__metravelSetTileNetwork?.(online, force),
    setTiles: (items: Array<[string, string]>) => win.__metravelSetTiles?.(items),
  };
};

describe('#2452 native base tiles — WebView owns the online load', () => {
  let harness: ReturnType<typeof mount> | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    harness?.map.remove();
    harness?.container.remove();
    harness = null;
    jest.useRealTimers();
    document.body.innerHTML = '';
    const win = window as BridgeWindow;
    delete win.ReactNativeWebView;
    delete win.__metravelSetTile;
    delete win.__metravelSetTiles;
    delete win.__metravelSetTileNetwork;
    delete win.__metravelGetTileStats;
    delete win.__metravelBaseMinZoom;
    delete win.__metravelResolveBaseMinZoom;
    delete win.__metravelBaseTileLayer;
    delete win.__metravelCaptureTiles;
    delete win.__metravelCancelTileCapture;
    delete win.__metravelCreateCaptureCanvas;
  });

  it('online createTile loads the tile URL directly and never sends TILE_REQ', () => {
    harness = mount();
    const imgs = harness.tileImgs();
    expect(imgs.length).toBeGreaterThan(0);
    expect(harness.ofType('TILE_REQ')).toHaveLength(0);
    for (const img of imgs) {
      expect(img.getAttribute('src')).toMatch(/^https:\/\/metravel\.by\/proxy\/tiles\/osm\/10\/\d+\/\d+\.png$/);
    }
    imgs.forEach((img) => img.dispatchEvent(new Event('load')));
    expect(harness.stats().netLoaded).toBe(imgs.length);
    expect(harness.tileImgs().every((img) => img.classList.contains('leaflet-tile-loaded'))).toBe(true);
  });

  it('a network error asks the RN disk cache exactly once and the batch answer draws the tile', () => {
    harness = mount();
    const [failed] = harness.tileImgs();
    const tileErrors: unknown[] = [];
    harness.layer.on('tileerror', (event) => tileErrors.push(event));

    failed.dispatchEvent(new Event('error'));
    const requests = harness.ofType('TILE_REQ');
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ fallback: true, z: 10 });
    expect(String(requests[0].key)).toMatch(/^10\/\d+\/\d+#\d+$/);
    // Ошибка сети ещё не терминальна: tileerror ждёт ответа моста.
    expect(tileErrors).toHaveLength(0);

    // Повторное событие error на том же <img> второго запроса не создаёт.
    failed.dispatchEvent(new Event('error'));
    expect(harness.ofType('TILE_REQ')).toHaveLength(1);

    harness.setTiles([[String(requests[0].key), TRANSPARENT_PNG]]);
    expect(failed.getAttribute('src')).toBe(TRANSPARENT_PNG);
    failed.dispatchEvent(new Event('load'));
    expect(failed.classList.contains('leaflet-tile-loaded')).toBe(true);
    expect(harness.stats()).toMatchObject({ fallbacks: 1, loaded: 1, netErrors: 1, pending: 0 });
  });

  it('an empty bridge answer after a network error is an observable tileerror', () => {
    harness = mount();
    const [failed] = harness.tileImgs();
    const tileErrors: unknown[] = [];
    harness.layer.on('tileerror', (event) => tileErrors.push(event));
    failed.dispatchEvent(new Event('error'));
    const [request] = harness.ofType('TILE_REQ');
    harness.setTiles([[String(request.key), '']]);
    expect(tileErrors).toHaveLength(1);
    expect(failed.classList.contains('leaflet-tile-loaded')).toBe(false);
  });

  it('offline switches new tiles to the bridge without redraw; offline → online redraws exactly once', () => {
    harness = mount();
    harness.tileImgs().forEach((img) => img.dispatchEvent(new Event('load')));
    const redrawSpy = jest.spyOn(harness.layer, 'redraw');

    // Онлайн → офлайн: уже загруженные тайлы остаются, redraw нет.
    expect(harness.setNetwork(false)).toBe(false);
    expect(redrawSpy).not.toHaveBeenCalled();
    harness.map.setView([-33.86, 151.2], 10);
    const offlineRequests = harness.ofType('TILE_REQ');
    expect(offlineRequests.length).toBeGreaterThan(0);
    expect(offlineRequests.every((request) => request.fallback === undefined)).toBe(true);
    // Офлайн-промах: пустые ответы → серые клетки.
    harness.setTiles(offlineRequests.map((request) => [String(request.key), ''] as [string, string]));
    harness.messages.length = 0;

    // Офлайн → онлайн: один redraw, тайлы снова грузятся по сети без жеста.
    expect(harness.setNetwork(true)).toBe(true);
    expect(redrawSpy).toHaveBeenCalledTimes(1);
    expect(harness.stats().redraws).toBe(1);
    expect(harness.ofType('TILE_REQ')).toHaveLength(0);
    expect(harness.tileImgs().length).toBeGreaterThan(0);
    expect(harness.tileImgs().every((img) => (img.getAttribute('src') ?? '').startsWith('https://'))).toBe(true);

    // Повтор той же команды — не второй redraw.
    expect(harness.setNetwork(true)).toBe(false);
    expect(redrawSpy).toHaveBeenCalledTimes(1);
    // Принудительный redraw после перехода до готовности страницы.
    expect(harness.setNetwork(true, true)).toBe(true);
    expect(redrawSpy).toHaveBeenCalledTimes(2);
  });

  it('a tile removed before the bridge answered is cancelled with one TILE_CANCEL per frame', () => {
    harness = mount();
    harness.setNetwork(false);
    harness.map.setView([-33.86, 151.2], 10);
    const pendingKeys = harness.ofType('TILE_REQ').map((request) => String(request.key));
    expect(pendingKeys.length).toBeGreaterThan(1);

    harness.map.setView([53.9, 27.56], 10);
    jest.runOnlyPendingTimers();

    const cancels = harness.ofType('TILE_CANCEL');
    expect(cancels).toHaveLength(1);
    expect(cancels[0].keys).toEqual(expect.arrayContaining(pendingKeys));
    expect(harness.stats().pending).toBe(harness.ofType('TILE_REQ').length - pendingKeys.length);
  });

  it('reports one MAP_TILES_STATE after the viewport finished loading', () => {
    harness = mount();
    harness.tileImgs().forEach((img) => img.dispatchEvent(new Event('load')));
    const states = harness.ofType('MAP_TILES_STATE');
    expect(states).toHaveLength(1);
    expect(states[0]).toMatchObject({ online: true, pending: 0, netErrors: 0 });
    expect(Number(states[0].netLoaded)).toBe(harness.tileImgs().length);
  });

  describe('tile capture into the RN disk cache (no second download)', () => {
    const coordKeyOf = (img: HTMLImageElement) =>
      (img as HTMLImageElement & { __metravelCoordKey?: string }).__metravelCoordKey as string;

    const installCanvas = (toDataURL: () => string) => {
      const drawn: unknown[] = [];
      (window as BridgeWindow).__metravelCreateCaptureCanvas = () => ({
        width: 0,
        height: 0,
        getContext: () => ({ clearRect: () => undefined, drawImage: (img: unknown) => drawn.push(img) }),
        toDataURL,
      });
      return drawn;
    };
    const capture = (keys: string[], gen = 7) => (window as BridgeWindow).__metravelCaptureTiles?.(keys, gen);

    it('network tiles are CORS images so a loaded one can be drawn into canvas', () => {
      harness = mount();
      expect(harness.tileImgs().every((img) => img.crossOrigin === 'anonymous')).toBe(true);
    });

    it('captures only tiles that actually loaded, in batches of at most 8', () => {
      harness = mount();
      const drawn = installCanvas(() => TRANSPARENT_PNG);
      const imgs = harness.tileImgs();
      expect(imgs.length).toBeGreaterThan(9);
      const keys = imgs.map(coordKeyOf);

      // До load ни один тайл не снимается.
      capture(keys);
      jest.runOnlyPendingTimers();
      expect(harness.ofType('TILE_CAPTURE')).toHaveLength(0);
      expect(drawn).toHaveLength(0);

      imgs.forEach((img) => img.dispatchEvent(new Event('load')));
      capture(keys);
      for (let i = 0; i < 10; i += 1) jest.runOnlyPendingTimers();
      const batches = harness.ofType('TILE_CAPTURE');
      expect(batches.length).toBe(Math.ceil(keys.length / 8));
      const captured = batches.flatMap((batch) => batch.tiles as Array<[string, string]>);
      expect(batches.every((batch) => (batch.tiles as unknown[]).length <= 8 && batch.gen === 7)).toBe(true);
      expect(captured.map(([key]) => key).sort()).toEqual([...keys].sort());
      expect(captured.every(([, dataUrl]) => dataUrl === TRANSPARENT_PNG)).toBe(true);
      // Захват — не сеть: новых запросов тайлов не появилось.
      expect(harness.ofType('TILE_REQ')).toHaveLength(0);
    });

    it('map movement cancels an unfinished capture', () => {
      harness = mount();
      installCanvas(() => TRANSPARENT_PNG);
      const imgs = harness.tileImgs();
      imgs.forEach((img) => img.dispatchEvent(new Event('load')));
      capture(imgs.map(coordKeyOf));
      jest.runOnlyPendingTimers();
      expect(harness.ofType('TILE_CAPTURE')).toHaveLength(1);

      harness.map.fire('movestart');
      for (let i = 0; i < 10; i += 1) jest.runOnlyPendingTimers();
      expect(harness.ofType('TILE_CAPTURE')).toHaveLength(1);
    });

    it('a tainted canvas (SecurityError) disables capture once instead of failing over to downloads', () => {
      harness = mount();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      installCanvas(() => {
        const error = new Error('tainted');
        error.name = 'SecurityError';
        throw error;
      });
      const imgs = harness.tileImgs();
      imgs.forEach((img) => img.dispatchEvent(new Event('load')));
      capture(imgs.map(coordKeyOf));
      for (let i = 0; i < 10; i += 1) jest.runOnlyPendingTimers();
      capture(imgs.map(coordKeyOf));
      for (let i = 0; i < 10; i += 1) jest.runOnlyPendingTimers();

      expect(harness.ofType('TILE_CAPTURE_DISABLED')).toHaveLength(1);
      expect(harness.ofType('TILE_CAPTURE')).toHaveLength(0);
      expect(harness.ofType('TILE_REQ')).toHaveLength(0);
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it('MAP_TILES_STATE carries the loaded viewport for the capture plan', () => {
      harness = mount();
      harness.tileImgs().forEach((img) => img.dispatchEvent(new Event('load')));
      const [state] = harness.ofType('MAP_TILES_STATE');
      expect(state).toMatchObject({ zoom: 10 });
      expect(state.bbox).toEqual(expect.objectContaining({
        south: expect.any(Number), west: expect.any(Number), north: expect.any(Number), east: expect.any(Number),
      }));
    });
  });
});
