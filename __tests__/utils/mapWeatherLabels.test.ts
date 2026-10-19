/**
 * #2661 — общий контроллер слоя «Погода»: ячейки фиксированной сетки, кэш по
 * ячейке, патч вместо снимка. Регрессия: прежний слой слал 12 запросов к OWM и
 * пересоздавал все подписи на каждый moveend.
 */
import {
  createWeatherLabelsController,
  createWeatherTempCache,
  formatWeatherTemp,
  planWeatherCells,
  resolveWeatherCellZoom,
  WEATHER_LABELS_CONFIG,
  type WeatherLabelsPatch,
  type WeatherViewport,
} from '@/utils/mapWeatherLabels';

const PHONE = { widthPx: 390, heightPx: 844 };
const PHONE_INSETS = { top: 110, right: 28, bottom: 250, left: 28 };

const worldPx = (zoom: number) => 256 * 2 ** zoom;
const toWorld = (lat: number, lon: number, zoom: number) => {
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * worldPx(zoom),
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * worldPx(zoom),
  };
};
const fromWorld = (x: number, y: number, zoom: number) => ({
  lon: (x / worldPx(zoom)) * 360 - 180,
  lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / worldPx(zoom)))) * 180) / Math.PI,
});

/** Вид карты с центром в точке, сдвинутый на (dx, dy) пикселей. */
const viewAt = (
  zoom: number,
  { dx = 0, dy = 0, size = PHONE, insets = PHONE_INSETS } = {},
): WeatherViewport => {
  const c = toWorld(53.9, 27.56, zoom);
  const cx = c.x + dx;
  const cy = c.y + dy;
  const nw = fromWorld(cx - size.widthPx / 2, cy - size.heightPx / 2, zoom);
  const se = fromWorld(cx + size.widthPx / 2, cy + size.heightPx / 2, zoom);
  return {
    bbox: { north: nw.lat, west: nw.lon, south: se.lat, east: se.lon },
    zoom,
    widthPx: size.widthPx,
    heightPx: size.heightPx,
    insets,
  };
};

const flush = () => new Promise((resolve) => setTimeout(resolve, WEATHER_LABELS_CONFIG.flushDelayMs + 20));

const makeHarness = (options: { status?: number; minZoom?: number } = {}) => {
  let time = 1_000_000;
  const patches: WeatherLabelsPatch[] = [];
  const fetchImpl = jest.fn(async (url: string) => {
    const lat = Number(/lat=([-\d.]+)/.exec(url)?.[1]);
    return {
      ok: !options.status,
      status: options.status ?? 200,
      json: async () => ({ main: { temp: Math.round(lat) - 45 } }),
    };
  });
  const controller = createWeatherLabelsController({
    getApiKey: () => 'test-key',
    minZoom: options.minZoom ?? 6,
    onPatch: (patch) => patches.push(patch),
    fetchImpl,
    now: () => time,
    cache: createWeatherTempCache(),
  });
  const visible = () => {
    const keys = new Set<string>();
    patches.forEach((patch) => {
      patch.removeKeys.forEach((key) => keys.delete(key));
      patch.add.forEach((label) => keys.add(label.key));
    });
    return keys;
  };
  return {
    controller,
    fetchImpl,
    patches,
    visible,
    advance: (ms: number) => {
      time += ms;
    },
  };
};

describe('formatWeatherTemp', () => {
  it('formats sign, unicode minus and rounding to zero', () => {
    expect(formatWeatherTemp(8.6)).toBe('+9°');
    expect(formatWeatherTemp(-3.2)).toBe('−3°');
    expect(formatWeatherTemp(-0.4)).toBe('0°');
    expect(formatWeatherTemp(Number.NaN)).toBe('');
  });
});

describe('weather cell grid', () => {
  it('picks a grid that keeps a phone screen within the label cap', () => {
    expect(resolveWeatherCellZoom(10, 334, 484)).toBe(11);
    expect(resolveWeatherCellZoom(10, 1400, 800)).toBe(9);
  });

  it('places every label outside the toolbar and bottom sheet zones', () => {
    const view = viewAt(10);
    const cells = planWeatherCells(view);
    expect(cells.length).toBeGreaterThan(4);
    expect(cells.length).toBeLessThanOrEqual(WEATHER_LABELS_CONFIG.maxCells);
    const origin = toWorld(view.bbox.north, view.bbox.west, view.zoom);
    cells.forEach((cell) => {
      const p = toWorld(cell.lat, cell.lon, view.zoom);
      const x = p.x - origin.x;
      const y = p.y - origin.y;
      expect(y).toBeGreaterThanOrEqual(PHONE_INSETS.top - 0.5);
      expect(y).toBeLessThanOrEqual(PHONE.heightPx - PHONE_INSETS.bottom + 0.5);
      expect(x).toBeGreaterThanOrEqual(PHONE_INSETS.left - 0.5);
      expect(x).toBeLessThanOrEqual(PHONE.widthPx - PHONE_INSETS.right + 0.5);
    });
  });

  it('keeps cell keys stable while panning', () => {
    const before = new Set(planWeatherCells(viewAt(10)).map((cell) => cell.key));
    const after = planWeatherCells(viewAt(10, { dx: 10, dy: 10 })).map((cell) => cell.key);
    expect(after.filter((key) => before.has(key)).length).toBeGreaterThanOrEqual(after.length - 4);
  });
});

describe('createWeatherLabelsController', () => {
  it('fetches each visible cell once and pans without refetching or recreating labels', async () => {
    const h = makeHarness();
    h.controller.update(viewAt(10));
    await flush();
    await flush();
    const initialKeys = new Set(h.visible());
    expect(initialKeys.size).toBeGreaterThan(4);
    expect(h.fetchImpl).toHaveBeenCalledTimes(initialKeys.size);

    // Сдвиг на треть ширины: только новые ячейки, прежние подписи не пересоздаются.
    const patchesBefore = h.patches.length;
    h.controller.update(viewAt(10, { dx: PHONE.widthPx / 3 }));
    await flush();
    await flush();
    const added = h.patches.slice(patchesBefore).flatMap((patch) => patch.add.map((label) => label.key));
    expect(added.every((key) => !initialKeys.has(key))).toBe(true);
    expect(h.fetchImpl.mock.calls.length - initialKeys.size).toBe(added.length);
    expect(added.length).toBeLessThan(initialKeys.size);

    // Возврат на исходную область: всё из кэша, ни одного запроса.
    const calls = h.fetchImpl.mock.calls.length;
    h.controller.update(viewAt(10));
    expect(h.fetchImpl).toHaveBeenCalledTimes(calls);
    expect(h.visible()).toEqual(initialKeys);
  });

  it('repeating the same view yields no patch and no request', async () => {
    const h = makeHarness();
    h.controller.update(viewAt(10));
    await flush();
    await flush();
    const patches = h.patches.length;
    const calls = h.fetchImpl.mock.calls.length;
    h.controller.update(viewAt(10));
    expect(h.patches.length).toBe(patches);
    expect(h.fetchImpl).toHaveBeenCalledTimes(calls);
  });

  it('refetches a cell only after its TTL expires', async () => {
    const h = makeHarness();
    h.controller.update(viewAt(10));
    await flush();
    await flush();
    const calls = h.fetchImpl.mock.calls.length;
    h.controller.update(viewAt(12));
    h.advance(WEATHER_LABELS_CONFIG.ttlMs + 1);
    h.controller.update(viewAt(10));
    await flush();
    expect(h.fetchImpl.mock.calls.length).toBeGreaterThan(calls);
  });

  it('refreshes a label that stayed in view past its TTL in place', async () => {
    const h = makeHarness();
    h.controller.update(viewAt(10));
    await flush();
    await flush();
    const keys = h.visible();
    const calls = h.fetchImpl.mock.calls.length;
    const patchesBefore = h.patches.length;
    h.advance(WEATHER_LABELS_CONFIG.ttlMs + 1);
    h.controller.update(viewAt(10));
    await flush();
    await flush();
    expect(h.fetchImpl).toHaveBeenCalledTimes(calls + keys.size);
    const refresh = h.patches.slice(patchesBefore);
    const removed = refresh.flatMap((patch) => patch.removeKeys);
    expect(new Set(removed)).toEqual(keys);
    expect(new Set(refresh.flatMap((patch) => patch.add.map((label) => label.key)))).toEqual(keys);
    expect(h.visible()).toEqual(keys);
  });

  it('requests a normalized longitude past the antimeridian and keys world copies apart', async () => {
    const h = makeHarness();
    const view = viewAt(10);
    const east = { ...view, bbox: { ...view.bbox, west: view.bbox.west + 360, east: view.bbox.east + 360 } };
    h.controller.update(east);
    await flush();
    await flush();
    h.fetchImpl.mock.calls.forEach(([url]) => {
      const lon = Number(/lon=([-\d.]+)/.exec(url)?.[1]);
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
    });
    const eastKeys = planWeatherCells(east).map((cell) => cell.key);
    const homeKeys = new Set(planWeatherCells(view).map((cell) => cell.key));
    expect(eastKeys.some((key) => homeKeys.has(key))).toBe(false);
  });

  it('clears all labels below minZoom without requests', async () => {
    const h = makeHarness();
    h.controller.update(viewAt(10));
    await flush();
    await flush();
    const calls = h.fetchImpl.mock.calls.length;
    h.controller.update(viewAt(5));
    expect(h.visible().size).toBe(0);
    expect(h.fetchImpl).toHaveBeenCalledTimes(calls);
  });

  it('pauses the queue after 429 instead of hammering the provider', async () => {
    const h = makeHarness({ status: 429 });
    h.controller.update(viewAt(10));
    await flush();
    const calls = h.fetchImpl.mock.calls.length;
    expect(calls).toBeLessThanOrEqual(WEATHER_LABELS_CONFIG.maxConcurrent);
    h.controller.update(viewAt(10, { dx: 40 }));
    await flush();
    expect(h.fetchImpl).toHaveBeenCalledTimes(calls);
    h.controller.stop();
  });

  it('resync re-emits visible labels from cache for a reloaded renderer', async () => {
    const h = makeHarness();
    h.controller.update(viewAt(10));
    await flush();
    await flush();
    const keys = h.visible();
    const calls = h.fetchImpl.mock.calls.length;
    h.controller.resync();
    const last = h.patches[h.patches.length - 1];
    expect(new Set(last.add.map((label) => label.key))).toEqual(keys);
    expect(h.fetchImpl).toHaveBeenCalledTimes(calls);
  });

  it('works again after stop (layer toggled off and on)', async () => {
    const h = makeHarness();
    h.controller.update(viewAt(10));
    h.controller.stop();
    await flush();
    expect(h.patches.every((patch) => patch.add.length === 0)).toBe(true);
    h.controller.update(viewAt(10));
    await flush();
    await flush();
    expect(h.visible().size).toBeGreaterThan(4);
  });

  it('drops a response for a cell that left the view during loading (WebView without AbortController)', async () => {
    const pending: Array<(value: unknown) => void> = [];
    const patches: WeatherLabelsPatch[] = [];
    const controller = createWeatherLabelsController({
      getApiKey: () => 'test-key',
      minZoom: 6,
      onPatch: (patch) => patches.push(patch),
      fetchImpl: () => new Promise((resolve) => pending.push(resolve)) as never,
      cache: createWeatherTempCache(),
    });
    const OriginalAbortController = global.AbortController;
    // @ts-expect-error — среда WebView без AbortController
    delete global.AbortController;
    try {
      controller.update(viewAt(10));
      const firstBatch = pending.splice(0);
      expect(firstBatch.length).toBe(WEATHER_LABELS_CONFIG.maxConcurrent);
      controller.update(viewAt(10, { dx: 4000 }));
      firstBatch.forEach((resolve) => resolve({ ok: true, status: 200, json: async () => ({ main: { temp: 5 } }) }));
      await flush();
      expect(patches.flatMap((patch) => patch.add)).toHaveLength(0);
    } finally {
      global.AbortController = OriginalAbortController;
      controller.stop();
    }
  });
});
