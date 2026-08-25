/**
 * #1561 — регрессия native tile lifecycle базовой подложки.
 *
 * Тест гоняет РЕАЛЬНЫЙ Leaflet 1.9.4 (тот же вендорный движок, что инлайнится в
 * WebView) через реальный zoom-цикл на размерах iPhone 13 mini и считает
 * requested/loaded/failed тайлы. Мок «успешного колбэка» дефект не ловил:
 * ломалась именно доставка ответа до конкретного DOM-тайла на низком зуме.
 */
import * as L from 'leaflet';

import {
  NATIVE_BASE_MIN_ZOOM_CEILING,
  NATIVE_BASE_MIN_ZOOM_FALLBACK,
  NATIVE_BASE_MIN_ZOOM_SCRIPT,
  buildNativeTileBridgeScript,
  resolveBaseMinZoom,
} from '@/components/MapPage/Map/nativeTileBridgeScript';
import {
  TILE_FETCH_RETRY_DELAYS_MS,
  fetchTileWithRetry,
} from '@/components/MapPage/Map/tileFetchRetry';
import { LEAFLET_INLINE_VERSION, LEAFLET_JS } from '@/utils/leafletInlineAsset';

// iPhone 13 mini (модель, на которой владелец воспроизвёл серую подложку).
const VIEWPORT_WIDTH = 375;
const VIEWPORT_HEIGHT = 812;

const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

interface TileRequest {
  type: string;
  z: number;
  x: number;
  y: number;
  key: string;
}

interface TileStats {
  requested: number;
  loaded: number;
  failed: number;
  dropped: number;
  pending: number;
}

type BridgeWindow = typeof window & {
  ReactNativeWebView?: { postMessage: (raw: string) => void };
  __metravelBaseMinZoom?: number;
  __metravelResolveBaseMinZoom?: (width: number, height: number) => number;
  __metravelSetTile?: (key: string, dataUrl: string) => void;
  __metravelGetTileStats?: () => TileStats;
  __metravelBaseTileLayer?: L.GridLayer;
};

const setViewport = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
};

interface SizedContainer {
  el: HTMLElement;
  /** Контейнер WebView может вырасти ПОСЛЕ монтирования карты (RN-layout, поворот). */
  setSize: (width: number, height: number) => void;
}

const createSizedContainer = (width: number, height: number): SizedContainer => {
  const el = document.createElement('div');
  const size = { width, height };
  const defineSize = (prop: string, read: () => number) => {
    Object.defineProperty(el, prop, { get: read, configurable: true });
  };
  defineSize('clientWidth', () => size.width);
  defineSize('clientHeight', () => size.height);
  defineSize('offsetWidth', () => size.width);
  defineSize('offsetHeight', () => size.height);
  el.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      width: size.width,
      height: size.height,
      top: 0,
      left: 0,
      right: size.width,
      bottom: size.height,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(el);
  return {
    el,
    setSize: (nextWidth: number, nextHeight: number) => {
      size.width = nextWidth;
      size.height = nextHeight;
    },
  };
};

interface Harness {
  map: L.Map;
  layer: L.GridLayer;
  container: HTMLElement;
  /** Все TILE_REQ, пришедшие из моста с момента последнего `drain`. */
  requests: TileRequest[];
  /** Отвечает на накопленные запросы: `fail` — пустой ответ (провал сети). */
  drain: (options?: { fail?: (req: TileRequest) => boolean }) => void;
  stats: () => TileStats;
  /** Видимые (`leaflet-tile-loaded`) и вечно скрытые DOM-тайлы подложки. */
  domTiles: () => { total: number; visible: number; hidden: number; withoutSrc: number };
  /** Контейнер получил новый размер (RN-layout/поворот) → F-17-каскад invalidateSize. */
  resize: (width: number, height: number) => void;
  destroy: () => void;
}

interface MountOptions {
  /** Размер контейнера карты. */
  width?: number;
  height?: number;
  /** Размеры окна WebView на момент преамбулы (могут отставать от контейнера). */
  windowWidth?: number;
  windowHeight?: number;
}

const mountBridge = ({
  width = VIEWPORT_WIDTH,
  height = VIEWPORT_HEIGHT,
  windowWidth = width,
  windowHeight = height,
}: MountOptions = {}): Harness => {
  const win = window as BridgeWindow;
  const requests: TileRequest[] = [];
  win.ReactNativeWebView = {
    postMessage: (raw: string) => {
      const parsed = JSON.parse(raw) as TileRequest;
      if (parsed.type === 'TILE_REQ') requests.push(parsed);
    },
  };

  // Преамбула считает нижний зум из window.innerWidth/innerHeight — ровно как в
  // WebView, поэтому исполняем её тем же кодом, а не подставляем число руками.
  setViewport(windowWidth, windowHeight);
  new Function(NATIVE_BASE_MIN_ZOOM_SCRIPT)();

  const { el: container, setSize } = createSizedContainer(width, height);
  const map = L.map(container, {
    zoomControl: false,
    preferCanvas: true,
    fadeAnimation: false,
    zoomAnimation: false,
    markerZoomAnimation: false,
    minZoom: win.__metravelBaseMinZoom,
  }).setView([53.8828449, 27.7273595], 10);

  const script = buildNativeTileBridgeScript({
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  });
  new Function('L', 'map', script)(L, map);

  const drain: Harness['drain'] = ({ fail } = {}) => {
    const batch = requests.splice(0, requests.length);
    for (const req of batch) {
      const shouldFail = fail ? fail(req) : false;
      win.__metravelSetTile?.(req.key, shouldFail ? '' : TRANSPARENT_PNG);
    }
    // jsdom не декодирует data-URL, поэтому событие `load` на <img> не приходит
    // само. Дожимаем его вручную: нас интересует lifecycle Leaflet, а не декодер.
    document.querySelectorAll<HTMLImageElement>('.leaflet-tile-pane img').forEach((img) => {
      if (img.getAttribute('src') && !img.classList.contains('leaflet-tile-loaded')) {
        img.dispatchEvent(new Event('load'));
      }
    });
  };

  return {
    map,
    layer: (window as BridgeWindow).__metravelBaseTileLayer as L.GridLayer,
    container,
    requests,
    drain,
    stats: () => (window as BridgeWindow).__metravelGetTileStats?.() as TileStats,
    domTiles: () => {
      const els = Array.from(
        document.querySelectorAll<HTMLImageElement>('.leaflet-tile-pane img.leaflet-tile'),
      );
      const visible = els.filter((el) => el.classList.contains('leaflet-tile-loaded')).length;
      return {
        total: els.length,
        visible,
        hidden: els.length - visible,
        withoutSrc: els.filter((el) => !el.getAttribute('src')).length,
      };
    },
    resize: (nextWidth: number, nextHeight: number) => {
      setSize(nextWidth, nextHeight);
      // Тот же вызов, что делает общий каскад __metravelScheduleInvalidate.
      map.invalidateSize({ animate: false, pan: false });
    },
    destroy: () => {
      map.remove();
      container.remove();
    },
  };
};

describe('#1561 native base-tile lifecycle', () => {
  let harness: Harness | null = null;

  beforeEach(() => {
    setViewport(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  });

  afterEach(() => {
    harness?.destroy();
    harness = null;
    document.body.innerHTML = '';
    const win = window as BridgeWindow;
    delete win.ReactNativeWebView;
    delete win.__metravelSetTile;
    delete win.__metravelGetTileStats;
    delete win.__metravelBaseMinZoom;
    delete win.__metravelResolveBaseMinZoom;
    delete win.__metravelBaseTileLayer;
  });

  // Мост переопределяет приватный `_removeTile` и полагается на то, что
  // `createTile` получает обёрнутые координаты. В WebView едет ИНЛАЙНОВЫЙ
  // минифицированный Leaflet, а не пакет из node_modules, поэтому апгрейд движка
  // или смена минификатора должны падать здесь, а не серой картой на устройстве.
  describe('инлайновый движок WebView', () => {
    it('той же версии, что и leaflet в тестах, и сохраняет приватные точки опоры', () => {
      // Пустой `{}` как window движку не подходит: Browser-детект Leaflet читает
      // `window.screen.deviceXDPI`. Наследуемся от настоящего window, но
      // собственный `L` (его ставит эпилог дистрибутива) остаётся на подставке и
      // не течёт в глобалы теста.
      const engine = Object.create(window) as Window & { L?: typeof L };
      new Function('window', 'document', LEAFLET_JS)(engine, document);

      expect(LEAFLET_INLINE_VERSION).toBe(L.version);
      expect(engine.L?.version).toBe(L.version);
      expect(typeof engine.L?.GridLayer?.prototype?._removeTile).toBe('function');
      expect(typeof engine.L?.GridLayer?.prototype?._wrapCoords).toBe('function');
    });
  });

  describe('resolveBaseMinZoom', () => {
    it('держит мир не уже экрана на реальных вьюпортах', () => {
      // z2 = 1024 px мира ≥ 812 px высоты iPhone 13 mini; z1 = 512 px — уже.
      expect(resolveBaseMinZoom(375, 812)).toBe(2);
      expect(resolveBaseMinZoom(430, 932)).toBe(2);
      // Планшет в ландшафте: 1366 px требует уже z3 (2048 px мира).
      expect(resolveBaseMinZoom(1366, 1024)).toBe(3);
      // Поворот устройства границу не двигает — берём max(w, h).
      expect(resolveBaseMinZoom(812, 375)).toBe(resolveBaseMinZoom(375, 812));
    });

    it('не проваливается на мусорных размерах и не улетает вверх', () => {
      expect(resolveBaseMinZoom(0, 0)).toBe(NATIVE_BASE_MIN_ZOOM_FALLBACK);
      expect(resolveBaseMinZoom(Number.NaN, Number.NaN)).toBe(NATIVE_BASE_MIN_ZOOM_FALLBACK);
      expect(resolveBaseMinZoom(1e9, 1e9)).toBe(NATIVE_BASE_MIN_ZOOM_CEILING);
    });

    // Формула живёт в двух видах: TS-функция (тесты/RN) и инлайн-JS для WebView.
    // Разъехавшись, они дадут «зелёный» юнит при сломанной подложке на устройстве.
    it.each([
      [375, 812],
      [390, 844],
      [430, 932],
      [375, 400],
      [768, 1024],
      [1366, 1024],
      [0, 0],
      [4000, 4000],
    ])('инлайн-резолвер WebView совпадает с resolveBaseMinZoom на %ix%i', (width, height) => {
      const win = window as BridgeWindow;
      setViewport(width, height);
      new Function(NATIVE_BASE_MIN_ZOOM_SCRIPT)();

      expect(win.__metravelBaseMinZoom).toBe(resolveBaseMinZoom(width, height));
      expect(win.__metravelResolveBaseMinZoom?.(width, height)).toBe(
        resolveBaseMinZoom(width, height),
      );
    });
  });

  it('на нижней границе зума мир перекрывает вьюпорт целиком', () => {
    harness = mountBridge();
    const minZoom = harness.map.getMinZoom();
    expect(minZoom).toBe(resolveBaseMinZoom(VIEWPORT_WIDTH, VIEWPORT_HEIGHT));

    const worldPx = 256 * 2 ** minZoom;
    expect(worldPx).toBeGreaterThanOrEqual(Math.max(VIEWPORT_WIDTH, VIEWPORT_HEIGHT));

    // Кнопка «−» ниже границы не пускает: сплошного серого поля из-за
    // отсутствующих тайлов возникнуть не может. Жмём заведомо больше раз, чем
    // есть уровней от стартового зума до нижней границы.
    const startZoom = harness.map.getZoom();
    for (let i = 0; i < startZoom + 4; i += 1) harness.map.zoomOut();
    expect(harness.map.getZoom()).toBe(minZoom);
  });

  it('последовательные отдаления до минимума не оставляют ни одного тайла без ответа', () => {
    harness = mountBridge();
    harness.drain();

    const minZoom = harness.map.getMinZoom();
    const seenKeys = new Set<string>();
    const perZoom: Array<{ zoom: number; requested: number; hidden: number }> = [];

    for (let zoom = harness.map.getZoom() - 1; zoom >= minZoom; zoom -= 1) {
      harness.map.setZoom(zoom);
      const requestedHere = harness.requests.length;

      // Ключ обязан быть уникальным на DOM-тайл: на низком зуме Leaflet отдаёт
      // в createTile повторяющиеся обёрнутые z/x/y для разных копий мира.
      for (const req of harness.requests) {
        expect(seenKeys.has(req.key)).toBe(false);
        seenKeys.add(req.key);
      }

      harness.drain();
      const tiles = harness.domTiles();
      perZoom.push({ zoom, requested: requestedHere, hidden: tiles.hidden });

      expect(requestedHere).toBeGreaterThan(0);
      expect(tiles.withoutSrc).toBe(0);
      expect(tiles.hidden).toBe(0);
      expect(tiles.visible).toBe(tiles.total);
    }

    // Дошли до нижней границы и на каждом уровне реально запрашивали тайлы.
    expect(perZoom.at(-1)?.zoom).toBe(minZoom);
    expect(perZoom.length).toBeGreaterThanOrEqual(3);

    const stats = harness.stats();
    expect(stats.failed).toBe(0);
    expect(stats.pending).toBe(0);
    expect(stats.loaded).toBe(stats.requested - stats.dropped);
  });

  it('на вьюпорте шире мира обёрнутые координаты не склеивают разные DOM-тайлы', () => {
    // Единственный кадр, где дефект ключа вообще наблюдаем: вьюпорт шире одного
    // мира. Он достижим на fallback-границе (WebView не отдал размеры окна) —
    // на 1366 px ландшафта мир z2 всего 1024 px, и Leaflet повторяет обёрнутые
    // z/x/y для соседних копий мира. Замер на этом кадре: ключ `z/x/y` склеивал
    // 8 из 24 тайлов, и склеенные <img> навсегда оставались без src.
    harness = mountBridge({ width: 1366, height: 1024, windowWidth: 0, windowHeight: 0 });
    expect(harness.map.getMinZoom()).toBe(NATIVE_BASE_MIN_ZOOM_FALLBACK);
    harness.drain();

    const uniqueKeys = new Set<string>();
    let wrappedCollisions = 0;

    for (let zoom = harness.map.getZoom() - 1; zoom >= harness.map.getMinZoom(); zoom -= 1) {
      harness.map.setZoom(zoom);

      const coordKeys = new Set<string>();
      for (const req of harness.requests) {
        const coordKey = `${req.z}/${req.x}/${req.y}`;
        if (coordKeys.has(coordKey)) wrappedCollisions += 1;
        coordKeys.add(coordKey);
        expect(uniqueKeys.has(req.key)).toBe(false);
        uniqueKeys.add(req.key);
      }

      harness.drain();
      expect(harness.domTiles().withoutSrc).toBe(0);
      expect(harness.domTiles().hidden).toBe(0);
    }

    // Кейс обязан реально проходить через повтор обёрнутых координат, иначе он
    // ничего не проверяет и молча выродится в дубль соседнего теста.
    expect(wrappedCollisions).toBeGreaterThan(0);
    expect(harness.stats().pending).toBe(0);
  });

  it('нижняя граница едет за вьюпортом, когда контейнер вырос после монтирования', () => {
    // Карта смонтирована на ещё не разложенной вкладке: WebView отдал маленький
    // вьюпорт (тот же F-17-сценарий, ради которого в движке живёт каскад
    // invalidateSize). Одноразовая граница z1 (мир 512 px) для финальных 812 px
    // недостаточна — мир снова уже экрана.
    harness = mountBridge({ width: 375, height: 400 });
    const staleMinZoom = harness.map.getMinZoom();
    expect(staleMinZoom).toBe(resolveBaseMinZoom(375, 400));
    expect(256 * 2 ** staleMinZoom).toBeLessThan(VIEWPORT_HEIGHT);

    harness.map.setZoom(staleMinZoom);
    harness.drain();

    harness.resize(VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

    const minZoom = harness.map.getMinZoom();
    expect(minZoom).toBe(resolveBaseMinZoom(VIEWPORT_WIDTH, VIEWPORT_HEIGHT));
    expect(256 * 2 ** minZoom).toBeGreaterThanOrEqual(VIEWPORT_HEIGHT);
    // Текущий зум был ниже новой границы — карта обязана подтянуться, иначе
    // пользователь остаётся ровно в том серым поле, из-за которого заведён #1561.
    expect(harness.map.getZoom()).toBe(minZoom);

    harness.drain();
    expect(harness.domTiles().hidden).toBe(0);
    expect(harness.stats().pending).toBe(0);
  });

  it('возврат к исходному зуму снова заполняет подложку', () => {
    harness = mountBridge();
    harness.drain();
    const startZoom = harness.map.getZoom();

    harness.map.setZoom(harness.map.getMinZoom());
    harness.drain();
    harness.map.setZoom(startZoom);
    harness.drain();

    const tiles = harness.domTiles();
    expect(tiles.total).toBeGreaterThan(0);
    expect(tiles.hidden).toBe(0);
    expect(harness.stats().pending).toBe(0);
  });

  it('провал сети виден как ошибка тайла, а не как успешно загруженная серая клетка', () => {
    harness = mountBridge();
    const tileErrors: string[] = [];
    // `tileerror` — событие СЛОЯ, на карту оно не всплывает.
    harness.layer.on('tileerror', () => {
      tileErrors.push('err');
    });

    harness.drain({ fail: () => true });

    const stats = harness.stats();
    expect(stats.failed).toBeGreaterThan(0);
    expect(stats.loaded).toBe(0);
    // Наблюдаемое состояние ошибки: Leaflet стреляет tileerror, и пустой тайл
    // НЕ получает класс `leaflet-tile-loaded`.
    expect(tileErrors.length).toBe(stats.failed);
    expect(harness.domTiles().visible).toBe(0);

    // Следующий цикл (пан/зум) пересоздаёт тайлы и снова их запрашивает —
    // провал не консервируется навсегда.
    harness.map.setZoom(harness.map.getZoom() - 1);
    expect(harness.requests.length).toBeGreaterThan(0);
    harness.drain();
    expect(harness.domTiles().hidden).toBe(0);
  });

  describe('окно ретраев провайдера (fetchTileWithRetry)', () => {
    const collectWaits = () => {
      const waits: number[] = [];
      return {
        waits,
        wait: async (ms: number) => {
          waits.push(ms);
        },
      };
    };

    it('добирает тайл повторной попыткой после провала сети', async () => {
      const { waits, wait } = collectWaits();
      let calls = 0;
      const ok = await fetchTileWithRetry({
        download: async () => {
          calls += 1;
          // 429 из nginx-зоны при бурсте зума (#807), затем нормальный ответ.
          return calls < 3 ? null : 15_000;
        },
        isOnline: () => true,
        wait,
      });

      expect(ok).toBe(true);
      expect(calls).toBe(3);
      expect(waits).toEqual([...TILE_FETCH_RETRY_DELAYS_MS]);
    });

    it('сдаётся ровно после документированного окна, а не молча навсегда', async () => {
      const { waits, wait } = collectWaits();
      let calls = 0;
      const ok = await fetchTileWithRetry({
        download: async () => {
          calls += 1;
          return null;
        },
        isOnline: () => true,
        wait,
      });

      expect(ok).toBe(false);
      expect(calls).toBe(TILE_FETCH_RETRY_DELAYS_MS.length + 1);
      expect(waits).toEqual([...TILE_FETCH_RETRY_DELAYS_MS]);
    });

    it('не ретраит, если между попытками устройство ушло в офлайн', async () => {
      const { waits, wait } = collectWaits();
      let calls = 0;
      const ok = await fetchTileWithRetry({
        download: async () => {
          calls += 1;
          return null;
        },
        isOnline: () => false,
        wait,
      });

      expect(ok).toBe(false);
      expect(calls).toBe(1);
      expect(waits).toEqual([]);
    });
  });

  it('ответ на уже снятый тайл не оставляет висящую запись в pending', () => {
    harness = mountBridge();
    harness.drain();

    // Уводим карту далеко: прежние тайлы снимаются до ответа RN.
    harness.map.setView([-33.86, 151.2], harness.map.getZoom());
    const stale = harness.requests.splice(0, harness.requests.length);
    harness.map.setView([53.88, 27.72], harness.map.getZoom());

    const win = window as BridgeWindow;
    for (const req of stale) win.__metravelSetTile?.(req.key, TRANSPARENT_PNG);

    harness.drain();
    const stats = harness.stats();
    expect(stats.dropped).toBeGreaterThan(0);
    expect(stats.pending).toBe(0);
    expect(harness.domTiles().hidden).toBe(0);
  });
});
