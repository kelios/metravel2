/**
 * #2661 — слой «Погода» (числовые подписи OpenWeatherMap) для web и native.
 *
 * Один модуль на обе платформы: ячейки погоды — тайлы фиксированной сетки
 * (`k/x/y`), поэтому ключ ячейки не меняется при сдвиге карты; температура
 * ячейки кэшируется на TTL; контроллер отдаёт патч `{add, removeKeys}` вместо
 * снимка. Web-рендерер (`utils/mapWebOverlays/weatherTempLabelsOverlay.ts`)
 * применяет патч к Leaflet напрямую, native (`useNativeWeatherLabels`) —
 * инжектом в WebView (`__metravelSetWeatherLabels`).
 *
 * Модуль чистый: без DOM, Leaflet и React Native.
 */

export interface WeatherBBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface WeatherLabelInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface WeatherViewport {
  bbox: WeatherBBox;
  zoom: number;
  widthPx: number;
  heightPx: number;
  /** Зоны поверх карты (кнопки, шторка), куда подпись ставить нельзя. */
  insets: WeatherLabelInsets;
}

export interface WeatherCell {
  key: string;
  lat: number;
  lon: number;
}

export interface WeatherLabel extends WeatherCell {
  html: string;
}

export interface WeatherLabelsPatch {
  add: WeatherLabel[];
  removeKeys: string[];
}

/** Отдельная панель Leaflet под маркерами (markerPane = 600) и над оверлеями (400). */
export const WEATHER_LABELS_PANE = 'metravelWeatherLabels';
export const WEATHER_LABELS_PANE_Z_INDEX = 450;

export const WEATHER_LABELS_CONFIG = {
  /** Потолок подписей на экране: столько же запросов на холодную область. */
  maxCells: 16,
  /** Ячейка не мельче этого размера на экране. */
  minCellPx: 96,
  /** Температура ячейки свежа 20 минут: возврат на область — без запросов. */
  ttlMs: 20 * 60 * 1000,
  maxConcurrent: 4,
  cacheLimit: 400,
  /** Пауза перед повторной попыткой ячейки после сетевой ошибки. */
  failureRetryMs: 15 * 1000,
  /** Пачка ответов собирается в один патч (на native — один инжект). */
  flushDelayMs: 40,
} as const;

/** Половина подписи и запас от края экрана: подпись центрируется на ячейке. */
const LABEL_MARGIN_X = 28;
const LABEL_MARGIN_Y = 14;
/** Полоса «Искать в этой области» над шторкой. */
const BOTTOM_ACTION_RESERVE = 56;

export const resolveWeatherLabelInsets = ({
  toolbarBottomPx,
  bottomOverlayPx,
}: {
  toolbarBottomPx: number;
  bottomOverlayPx: number;
}): WeatherLabelInsets => ({
  top: Math.max(0, toolbarBottomPx) + LABEL_MARGIN_Y,
  right: LABEL_MARGIN_X,
  bottom: Math.max(0, bottomOverlayPx) + BOTTOM_ACTION_RESERVE + LABEL_MARGIN_Y,
  left: LABEL_MARGIN_X,
});

export const formatWeatherTemp = (temp: number): string => {
  if (!Number.isFinite(temp)) return '';
  const rounded = Math.round(temp);
  // Минус U+2212; Math.round(-0.4) → -0 → без знака.
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${sign}${Math.abs(rounded)}°`;
};

/** Цвет подписи по температуре — читаемость поверх heat-map. */
export const weatherTempColor = (temp: number): string => {
  if (temp <= -10) return '#1d4ed8';
  if (temp <= 0) return '#2563eb';
  if (temp <= 10) return '#0e7490';
  if (temp <= 20) return '#15803d';
  if (temp <= 28) return '#b45309';
  return '#b91c1c';
};

/** HTML подписи; центрирована на точке ячейки (translate -50%). */
export const buildWeatherLabelHtml = (temp: number): string =>
  '<span style="display:inline-block;transform:translate(-50%,-50%);padding:1px 6px;border-radius:9px;' +
  'font-size:13px;font-weight:800;line-height:1.25;white-space:nowrap;' +
  `color:${weatherTempColor(temp)};` +
  'background:rgba(255,255,255,0.88);border:1px solid rgba(0,0,0,0.18);' +
  'box-shadow:0 1px 2px rgba(0,0,0,0.35);text-shadow:0 1px 0 rgba(255,255,255,0.9);">' +
  `${formatWeatherTemp(temp)}</span>`;

// Мировые координаты Web Mercator в долях [0, 1].
const lonToWorldX = (lon: number) => (lon + 180) / 360;
const latToWorldY = (lat: number) => {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
};
const worldXToLon = (x: number) => x * 360 - 180;
const worldYToLat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

const roundCoord = (value: number) => Math.round(value * 1e5) / 1e5;

/**
 * Зум сетки ячеек: самая мелкая сетка, у которой на безопасной области экрана
 * помещается не больше `maxCells` ячеек. Зависит только от зума карты и размера
 * контейнера, поэтому стабилен при сдвиге.
 */
export const resolveWeatherCellZoom = (
  mapZoom: number,
  safeWidthPx: number,
  safeHeightPx: number,
): number => {
  const zoom = Math.round(mapZoom);
  for (let delta = 3; delta >= -4; delta -= 1) {
    const cellPx = 256 * 2 ** -delta;
    if (cellPx < WEATHER_LABELS_CONFIG.minCellPx) continue;
    const estimate = Math.ceil(safeWidthPx / cellPx) * Math.ceil(safeHeightPx / cellPx);
    if (estimate <= WEATHER_LABELS_CONFIG.maxCells) return Math.max(0, zoom + delta);
  }
  return Math.max(0, zoom - 4);
};

/** Ячейки, центр которых виден вне зон кнопок и шторки. */
export const planWeatherCells = (view: WeatherViewport): WeatherCell[] => {
  const { bbox, widthPx, heightPx, insets } = view;
  const safeWidth = widthPx - insets.left - insets.right;
  const safeHeight = heightPx - insets.top - insets.bottom;
  if (
    !Number.isFinite(view.zoom) ||
    !Number.isFinite(safeWidth) ||
    !Number.isFinite(safeHeight) ||
    safeWidth <= 0 ||
    safeHeight <= 0
  ) {
    return [];
  }

  const x0 = lonToWorldX(Math.min(bbox.west, bbox.east));
  const x1 = lonToWorldX(Math.max(bbox.west, bbox.east));
  const y0 = latToWorldY(Math.max(bbox.north, bbox.south));
  const y1 = latToWorldY(Math.min(bbox.north, bbox.south));
  if (![x0, x1, y0, y1].every(Number.isFinite) || x1 <= x0 || y1 <= y0) return [];

  // Безопасный прямоугольник: линейная интерполяция в мировых координатах
  // совпадает с пиксельной (Mercator линеен по экрану).
  const safeX0 = x0 + ((x1 - x0) * insets.left) / widthPx;
  const safeX1 = x1 - ((x1 - x0) * insets.right) / widthPx;
  const safeY0 = y0 + ((y1 - y0) * insets.top) / heightPx;
  const safeY1 = y1 - ((y1 - y0) * insets.bottom) / heightPx;

  const cellZoom = resolveWeatherCellZoom(view.zoom, safeWidth, safeHeight);
  const n = 2 ** cellZoom;
  const centerX = (safeX0 + safeX1) / 2;
  const centerY = (safeY0 + safeY1) / 2;
  const cells: Array<WeatherCell & { distance: number }> = [];

  for (let ix = Math.floor(safeX0 * n); ix <= Math.floor(safeX1 * n); ix += 1) {
    const cx = (ix + 0.5) / n;
    if (cx < safeX0 || cx > safeX1) continue;
    for (let iy = Math.max(0, Math.floor(safeY0 * n)); iy <= Math.min(n - 1, Math.floor(safeY1 * n)); iy += 1) {
      const cy = (iy + 0.5) / n;
      if (cy < safeY0 || cy > safeY1) continue;
      // `ix` не сворачивается: за антимеридианом Leaflet отдаёт lon > 180, и
      // подпись должна стоять на текущей копии мира. Долготу для OWM
      // нормализует `buildOwmCurrentWeatherUrl`.
      cells.push({
        key: `${cellZoom}/${ix}/${iy}`,
        lat: roundCoord(worldYToLat(cy)),
        lon: roundCoord(worldXToLon(cx)),
        distance: (cx - centerX) ** 2 + (cy - centerY) ** 2,
      });
    }
  }

  return cells
    .sort((a, b) => a.distance - b.distance)
    .slice(0, WEATHER_LABELS_CONFIG.maxCells)
    .map(({ key, lat, lon }) => ({ key, lat, lon }));
};

export interface WeatherTempCache {
  get(key: string): { temp: number; at: number } | undefined;
  set(key: string, value: { temp: number; at: number }): void;
  clear(): void;
}

/** LRU по порядку вставки Map; общий на все экземпляры слоя (переживает выключение). */
export const createWeatherTempCache = (limit: number = WEATHER_LABELS_CONFIG.cacheLimit): WeatherTempCache => {
  const entries = new Map<string, { temp: number; at: number }>();
  return {
    get: (key) => entries.get(key),
    set: (key, value) => {
      entries.delete(key);
      entries.set(key, value);
      while (entries.size > limit) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    clear: () => entries.clear(),
  };
};

const sharedWeatherTempCache = createWeatherTempCache();

/** OWM принимает долготу только в [-180, 180]: копии мира Leaflet сворачиваются. */
const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

export const buildOwmCurrentWeatherUrl = (lat: number, lon: number, apiKey: string): string =>
  'https://api.openweathermap.org/data/2.5/weather' +
  `?lat=${lat.toFixed(4)}&lon=${wrapLon(lon).toFixed(4)}&units=metric&appid=${encodeURIComponent(apiKey)}`;

type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export interface WeatherLabelsControllerDeps {
  getApiKey: () => string;
  minZoom: number;
  onPatch: (patch: WeatherLabelsPatch) => void;
  fetchImpl?: FetchLike;
  now?: () => number;
  cache?: WeatherTempCache;
  onError?: (message: string) => void;
}

export interface WeatherLabelsController {
  /** Новый вид карты (после stop() контроллер снова рабочий): снять ушедшие ячейки, показать известные, догрузить недостающие. */
  update(view: WeatherViewport): void;
  /** Рендерер пересоздан (перезагрузка WebView): заново отдать все видимые подписи. */
  resync(): void;
  stop(): void;
}

class OwmHttpError extends Error {
  constructor(readonly status: number) {
    super(`OWM weather ${status}`);
  }
}

const isAbortError = (error: unknown) =>
  Boolean(error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError');

export const createWeatherLabelsController = ({
  getApiKey,
  minZoom,
  onPatch,
  fetchImpl = (url, init) => fetch(url, init),
  now = Date.now,
  cache = sharedWeatherTempCache,
  onError,
}: WeatherLabelsControllerDeps): WeatherLabelsController => {
  const config = WEATHER_LABELS_CONFIG;
  let wanted = new Map<string, WeatherCell>();
  const rendered = new Set<string>();
  const inflight = new Map<string, AbortController | null>();
  const failedUntil = new Map<string, number>();
  let queue: string[] = [];
  let pendingAdds: WeatherLabel[] = [];
  /** Ключи из `pendingAdds`, чья подпись уже на экране и обновляется после TTL. */
  const pendingReplace = new Set<string>();
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let pumpTimer: ReturnType<typeof setTimeout> | null = null;
  let pausedUntil = 0;
  let backoffMs = 0;
  let lastView: WeatherViewport | null = null;
  /** Растёт на stop(): ответы прежнего поколения не трогают состояние. */
  let generation = 0;

  const freshTemp = (key: string): number | null => {
    const entry = cache.get(key);
    if (!entry || now() - entry.at > config.ttlMs) return null;
    return entry.temp;
  };

  const toLabel = (cell: WeatherCell, temp: number): WeatherLabel => ({
    ...cell,
    html: buildWeatherLabelHtml(temp),
  });

  const flush = () => {
    flushTimer = null;
    const add = pendingAdds;
    pendingAdds = [];
    const removeKeys = add.filter((label) => pendingReplace.has(label.key)).map((label) => label.key);
    pendingReplace.clear();
    if (add.length > 0) onPatch({ add, removeKeys });
  };

  const scheduleFlush = () => {
    if (flushTimer) return;
    flushTimer = setTimeout(flush, config.flushDelayMs);
  };

  const fetchCell = (cell: WeatherCell, apiKey: string) => {
    const startedIn = generation;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    inflight.set(cell.key, controller);
    fetchImpl(buildOwmCurrentWeatherUrl(cell.lat, cell.lon, apiKey), controller ? { signal: controller.signal } : {})
      .then((res) => {
        if (!res.ok) throw new OwmHttpError(res.status);
        return res.json();
      })
      .then((data) => {
        const temp = Number((data as { main?: { temp?: unknown } } | null)?.main?.temp);
        if (!Number.isFinite(temp)) throw new Error('OWM weather: no temperature');
        backoffMs = 0;
        cache.set(cell.key, { temp, at: now() });
        if (startedIn !== generation || !wanted.has(cell.key)) return;
        if (rendered.has(cell.key)) pendingReplace.add(cell.key);
        else rendered.add(cell.key);
        pendingAdds.push(toLabel(cell, temp));
        scheduleFlush();
      })
      .catch((error: unknown) => {
        if (isAbortError(error) || startedIn !== generation) return;
        const status = error instanceof OwmHttpError ? error.status : 0;
        if (status === 429) {
          backoffMs = backoffMs ? Math.min(backoffMs * 2, 30_000) : 2_000;
          pausedUntil = now() + backoffMs;
          queue.unshift(cell.key);
        } else if (status === 401 || status === 403) {
          // Ключ без доступа: длинная пауза, не молотим впустую.
          pausedUntil = now() + 60_000;
          queue.unshift(cell.key);
        } else {
          failedUntil.set(cell.key, now() + config.failureRetryMs);
        }
        onError?.(error instanceof Error ? error.message : String(error));
      })
      .then(() => {
        if (startedIn !== generation) return;
        if (inflight.get(cell.key) === controller) inflight.delete(cell.key);
        pump();
      });
  };

  function pump() {
    const apiKey = getApiKey();
    if (!apiKey) return;
    const wait = pausedUntil - now();
    if (wait > 0) {
      if (!pumpTimer) {
        pumpTimer = setTimeout(() => {
          pumpTimer = null;
          pump();
        }, wait);
      }
      return;
    }
    while (inflight.size < config.maxConcurrent && queue.length > 0) {
      const key = queue.shift() as string;
      const cell = wanted.get(key);
      if (!cell || inflight.has(key) || freshTemp(key) != null) continue;
      fetchCell(cell, apiKey);
    }
  }

  const update = (view: WeatherViewport) => {
    lastView = view;
    const cells = Math.round(view.zoom) < minZoom ? [] : planWeatherCells(view);
    const nextWanted = new Map(cells.map((cell) => [cell.key, cell]));

    const removeKeys: string[] = [];
    rendered.forEach((key) => {
      if (!nextWanted.has(key)) removeKeys.push(key);
    });
    removeKeys.forEach((key) => rendered.delete(key));
    if (removeKeys.length > 0) {
      const removed = new Set(removeKeys);
      pendingAdds = pendingAdds.filter((label) => !removed.has(label.key));
    }

    inflight.forEach((controller, key) => {
      if (nextWanted.has(key)) return;
      try {
        controller?.abort();
      } catch {
        // noop
      }
      inflight.delete(key);
    });

    wanted = nextWanted;
    const add: WeatherLabel[] = [];
    const missing: string[] = [];
    const time = now();
    cells.forEach((cell) => {
      const temp = freshTemp(cell.key);
      if (temp != null) {
        if (rendered.has(cell.key)) return;
        rendered.add(cell.key);
        add.push(toLabel(cell, temp));
        return;
      }
      // Нет свежей температуры: подпись старше TTL остаётся на экране до ответа.
      if (inflight.has(cell.key)) return;
      if ((failedUntil.get(cell.key) ?? 0) > time) return;
      missing.push(cell.key);
    });
    queue = missing;

    if (add.length > 0 || removeKeys.length > 0) onPatch({ add, removeKeys });
    pump();
  };

  const clearTimers = () => {
    if (flushTimer) clearTimeout(flushTimer);
    if (pumpTimer) clearTimeout(pumpTimer);
    flushTimer = null;
    pumpTimer = null;
  };

  return {
    update,
    resync: () => {
      rendered.clear();
      pendingAdds = [];
      pendingReplace.clear();
      if (lastView) update(lastView);
    },
    stop: () => {
      generation += 1;
      clearTimers();
      inflight.forEach((controller) => {
        try {
          controller?.abort();
        } catch {
          // noop
        }
      });
      inflight.clear();
      queue = [];
      pendingAdds = [];
      pendingReplace.clear();
      wanted = new Map();
      rendered.clear();
      failedUntil.clear();
      pausedUntil = 0;
      backoffMs = 0;
      lastView = null;
    },
  };
};
