// components/MapPage/Map/nativeTileFallbackQueue.ts
//
// #2452 — RN-сторона мостового пути тайлов базовой подложки native-карты.
//
// В онлайне тайлы грузит сам WebView (`L.GridLayer` с прямым `<img src>`:
// параллельно, с HTTP-кэшем и отменой). Мост остаётся только запасным путём:
//   * `TILE_REQ {fallback:true}` после сетевой ошибки тайла в WebView;
//   * `TILE_REQ` в офлайне, когда слой целиком переключён на мост.
// Здесь живут три чистых механизма без зависимостей от RN/Expo, чтобы их
// проверял unit-тест:
//   1. очередь запасных запросов — LIFO (последний жест важнее), с
//      ограничением параллельности, отменой по ключам и отбрасыванием тайлов
//      прежнего зума (раньше FIFO без отмены: после быстрого зума нужные тайлы
//      ждали докачки мёртвых);
//   2. батч-инжектор — ответы уходят в WebView одним `__metravelSetTiles([...])`
//      не чаще раза в кадр, без regex-прохода `serializeForInlineScript` по
//      base64 (ключ и data-URL состоят из [0-9/#] и base64-алфавита);
//   3. план захвата: какие тайлы догруженного вьюпорта отсутствуют в дисковом
//      кэше — их WebView снимает из уже загруженных картинок (сети нет), RN
//      только пишет файлы.

export interface NativeTileFallbackRequest {
  key: string;
  z: number;
  x: number;
  y: number;
}

export interface NativeTileFallbackQueueOptions {
  /** Сколько запросов обрабатывается одновременно (чтение диска / ретрай сети). */
  concurrency: number;
  /** Data-URL тайла или пустая строка, если тайл получить нельзя. */
  resolve: (request: NativeTileFallbackRequest) => Promise<string>;
  /** Ответ уходит в WebView (через батч-инжектор). */
  deliver: (key: string, dataUrl: string) => void;
}

export interface NativeTileFallbackQueue {
  enqueue: (request: NativeTileFallbackRequest) => void;
  /** WebView снял тайлы с карты — их ответы больше не нужны. */
  cancel: (keys: readonly string[]) => void;
  /** Страница WebView перезагружена: все ключи прежнего документа мертвы. */
  clear: () => void;
  size: () => number;
  active: () => number;
}

export const createNativeTileFallbackQueue = ({
  concurrency,
  resolve,
  deliver,
}: NativeTileFallbackQueueOptions): NativeTileFallbackQueue => {
  let stack: NativeTileFallbackRequest[] = [];
  let active = 0;
  let latestZoom: number | null = null;
  const inFlight = new Set<string>();
  const cancelledInFlight = new Set<string>();
  const limit = Math.max(1, Math.floor(concurrency) || 1);

  const pump = () => {
    while (active < limit && stack.length > 0) {
      // LIFO: последний запрос относится к последнему жесту пользователя.
      const request = stack.pop() as NativeTileFallbackRequest;
      active += 1;
      inFlight.add(request.key);
      let settled = false;
      const finish = (dataUrl: string) => {
        if (settled) return;
        settled = true;
        active = Math.max(0, active - 1);
        inFlight.delete(request.key);
        if (cancelledInFlight.has(request.key)) {
          cancelledInFlight.delete(request.key);
        } else {
          deliver(request.key, dataUrl);
        }
        pump();
      };
      resolve(request).then(
        (dataUrl) => finish(typeof dataUrl === 'string' ? dataUrl : ''),
        () => finish(''),
      );
    }
  };

  return {
    enqueue: (request) => {
      if (latestZoom !== null && request.z !== latestZoom) {
        // Пользователь сменил зум: тайлы прежнего уровня WebView уже снимает с
        // карты. Отвечаем им пустым ответом сразу (WebView посчитает его
        // `dropped`), а не держим их впереди нужных.
        const stale = stack.filter((item) => item.z !== request.z);
        if (stale.length > 0) {
          stack = stack.filter((item) => item.z === request.z);
          stale.forEach((item) => deliver(item.key, ''));
        }
      }
      latestZoom = request.z;
      stack.push(request);
      pump();
    },
    cancel: (keys) => {
      if (!keys.length) return;
      const set = new Set(keys);
      stack = stack.filter((item) => !set.has(item.key));
      keys.forEach((key) => {
        if (inFlight.has(key)) cancelledInFlight.add(key);
      });
    },
    clear: () => {
      stack = [];
      latestZoom = null;
      inFlight.forEach((key) => cancelledInFlight.add(key));
    },
    size: () => stack.length,
    active: () => active,
  };
};

export interface NativeTileBatchInjectorOptions {
  inject: (script: string) => void;
  /** Планировщик кадра (`requestAnimationFrame` в RN, таймер в тестах). */
  schedule: (flush: () => void) => void;
}

export interface NativeTileBatchInjector {
  push: (key: string, dataUrl: string) => void;
  flush: () => void;
  clear: () => void;
}

/** Ключ тайла моста: `z/x/y#seq` (см. nativeTileBridgeScript.ts). */
const TILE_KEY_PATTERN = /^\d{1,2}\/-?\d{1,9}\/-?\d{1,9}#\d{1,12}$/;
/** Data-URL с диска: только PNG base64, без символов, требующих экранирования. */
const TILE_DATA_URL_PATTERN = /^data:image\/png;base64,[A-Za-z0-9+/=]*$/;

export const isSafeTileBridgeKey = (key: string): boolean => TILE_KEY_PATTERN.test(key);

export const createNativeTileBatchInjector = ({
  inject,
  schedule,
}: NativeTileBatchInjectorOptions): NativeTileBatchInjector => {
  let batch: Array<[string, string]> = [];
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    if (batch.length === 0) return;
    const items = batch;
    batch = [];
    // JSON.stringify без regex-прохода: ключ проверен паттерном, data-URL —
    // только base64-алфавит, поэтому `</script>`/U+2028 в строке быть не может.
    inject(`window.__metravelSetTiles && window.__metravelSetTiles(${JSON.stringify(items)})`);
  };

  return {
    push: (key, dataUrl) => {
      if (!isSafeTileBridgeKey(key)) return;
      batch.push([key, dataUrl && TILE_DATA_URL_PATTERN.test(dataUrl) ? dataUrl : '']);
      if (scheduled) return;
      scheduled = true;
      schedule(flush);
    },
    flush,
    clear: () => {
      batch = [];
    },
  };
};

export interface NativeTileCoord {
  z: number;
  x: number;
  y: number;
}

export interface NativeTileCapturePlanOptions {
  /** Тайлы догруженного вьюпорта (`listViewportTiles`). */
  tiles: readonly NativeTileCoord[];
  hasFresh: (tile: NativeTileCoord) => Promise<boolean>;
}

/**
 * Координатные ключи `z/x/y` тайлов вьюпорта, которых нет в дисковом кэше.
 * По ним WebView снимает УЖЕ загруженные картинки — сети здесь нет вовсе.
 */
export const planNativeTileCapture = async ({
  tiles,
  hasFresh,
}: NativeTileCapturePlanOptions): Promise<string[]> => {
  const fresh = await Promise.all(tiles.map((tile) => hasFresh(tile).catch(() => false)));
  return tiles.filter((_tile, index) => !fresh[index]).map(({ z, x, y }) => `${z}/${x}/${y}`);
};

const CAPTURE_KEY_PATTERN = /^(\d{1,2})\/(\d{1,9})\/(\d{1,9})$/;
const MAX_CAPTURE_ZOOM = 22;

export interface NativeTileCaptureEntry extends NativeTileCoord {
  dataUrl: string;
}

/** Пара `[z/x/y, dataUrl]` из TILE_CAPTURE → координаты и PNG, иначе null. */
export const parseNativeTileCaptureEntry = (entry: unknown): NativeTileCaptureEntry | null => {
  if (!Array.isArray(entry) || entry.length < 2) return null;
  const [key, dataUrl] = entry;
  if (typeof key !== 'string' || typeof dataUrl !== 'string') return null;
  const match = CAPTURE_KEY_PATTERN.exec(key);
  if (!match || !TILE_DATA_URL_PATTERN.test(dataUrl)) return null;
  const z = Number(match[1]);
  const x = Number(match[2]);
  const y = Number(match[3]);
  // Only real Web Mercator tiles reach the disk cache (no junk z/x dirs).
  const scale = 2 ** z;
  if (z > MAX_CAPTURE_ZOOM || x >= scale || y >= scale) return null;
  return { z, x, y, dataUrl };
};
