import type { BBox } from '@/utils/overpass';
import { getOwmApiKey } from '@/config/mapWebLayers';

type LeafletMap = any;

export type WeatherTempLabelsOverlayOptions = {
  /** Дебаунс на moveend/zoomend. */
  debounceMs?: number;
  /** Максимум подписей на карте. */
  maxLabels?: number;
  /** Размер сетки выборки: число колонок и строк. */
  gridCols?: number;
  gridRows?: number;
};

const defaultOpts: Required<WeatherTempLabelsOverlayOptions> = {
  debounceMs: 600,
  maxLabels: 12,
  gridCols: 4,
  gridRows: 3,
};

/** Ответ бесплатного OWM /data/2.5/weather?lat&lon. */
interface OwmCurrentWeather {
  name?: string;
  coord?: { lat?: number; lon?: number };
  main?: { temp?: number };
}

interface WeatherPoint {
  lat: number;
  lon: number;
  temp: number;
  name: string;
}

const formatTemp = (temp: number): string => {
  if (!Number.isFinite(temp)) return '';
  const rounded = Math.round(temp);
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  // Для отрицательных используем минус U+2212; Math.round(-0) -> 0, знак не ставим.
  const abs = Math.abs(rounded);
  return `${sign}${abs}°`;
};

/** Цвет подписи по температуре (тёплый/холодный) для читаемости поверх heat-map. */
const tempColor = (temp: number): string => {
  if (temp <= -10) return '#1d4ed8';
  if (temp <= 0) return '#2563eb';
  if (temp <= 10) return '#0e7490';
  if (temp <= 20) return '#15803d';
  if (temp <= 28) return '#b45309';
  return '#b91c1c';
};

export const attachWeatherTempLabelsOverlay = (
  L: any,
  map: LeafletMap,
  opts?: WeatherTempLabelsOverlayOptions,
) => {
  const options = { ...defaultOpts, ...(opts || {}) };

  const layerGroup = L.layerGroup();

  let abort: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastKey: string | null = null;
  let isLoading = false;
  let nextAllowedAt = 0;
  let backoffMs = 0;
  let started = false;

  const makeBBox = (): BBox | null => {
    try {
      const b = map.getBounds?.();
      if (!b) return null;
      const sw = b.getSouthWest?.();
      const ne = b.getNorthEast?.();
      if (!sw || !ne) return null;
      if (
        !Number.isFinite(sw.lat) ||
        !Number.isFinite(sw.lng) ||
        !Number.isFinite(ne.lat) ||
        !Number.isFinite(ne.lng)
      ) {
        return null;
      }
      return { south: sw.lat, west: sw.lng, north: ne.lat, east: ne.lng };
    } catch {
      return null;
    }
  };

  const keyFromBBox = (bbox: BBox, zoom: number) => {
    const r = (n: number) => Math.round(n * 100) / 100;
    return `${r(bbox.south)}|${r(bbox.west)}|${r(bbox.north)}|${r(bbox.east)}|${zoom}`;
  };

  /**
   * Узлы сетки выборки по видимым bounds: равномерно cols×rows с инсетом от краёв,
   * чтобы подписи не лезли за экран.
   */
  const gridPoints = (bbox: BBox): Array<{ lat: number; lon: number }> => {
    const cols = Math.max(1, Math.floor(options.gridCols));
    const rows = Math.max(1, Math.floor(options.gridRows));

    const insetLat = (bbox.north - bbox.south) * 0.12;
    const insetLon = (bbox.east - bbox.west) * 0.12;
    const south = bbox.south + insetLat;
    const north = bbox.north - insetLat;
    const west = bbox.west + insetLon;
    const east = bbox.east - insetLon;

    const points: Array<{ lat: number; lon: number }> = [];
    for (let ri = 0; ri < rows; ri += 1) {
      const tLat = rows === 1 ? 0.5 : ri / (rows - 1);
      const lat = south + (north - south) * tLat;
      for (let ci = 0; ci < cols; ci += 1) {
        const tLon = cols === 1 ? 0.5 : ci / (cols - 1);
        const lon = west + (east - west) * tLon;
        if (Number.isFinite(lat) && Number.isFinite(lon)) points.push({ lat, lon });
      }
    }
    return points;
  };

  const makeIcon = (text: string, color: string) => {
    const html =
      `<span style="` +
      `display:inline-block;` +
      `padding:1px 6px;` +
      `border-radius:9px;` +
      `font-size:13px;` +
      `font-weight:800;` +
      `line-height:1.25;` +
      `white-space:nowrap;` +
      `color:${color};` +
      `background:rgba(255,255,255,0.88);` +
      `border:1px solid rgba(0,0,0,0.18);` +
      `box-shadow:0 1px 2px rgba(0,0,0,0.35);` +
      `text-shadow:0 1px 0 rgba(255,255,255,0.9);` +
      `">${text}</span>`;

    return L.divIcon({
      className: 'metravel-temp-label',
      html,
      iconSize: undefined,
      iconAnchor: [0, 0],
    });
  };

  const renderPoints = (points: WeatherPoint[]) => {
    layerGroup.clearLayers();

    for (const p of points) {
      const text = formatTemp(p.temp);
      if (!text) continue;

      try {
        const marker = L.marker([p.lat, p.lon], {
          icon: makeIcon(text, tempColor(p.temp)),
          interactive: false,
          keyboard: false,
        });
        if (typeof marker.setZIndexOffset === 'function') marker.setZIndexOffset(1000);
        marker.addTo(layerGroup);
      } catch {
        // Пропускаем некорректные координаты — на основную карту не влияет.
      }
    }
  };

  /** Дедуп по name (если есть) либо по округлённым координатам ответа. */
  const dedupKey = (p: WeatherPoint): string => {
    if (p.name) return `n:${p.name.toLowerCase()}`;
    const r = (n: number) => Math.round(n * 50) / 50;
    return `c:${r(p.lat)}|${r(p.lon)}`;
  };

  const fetchPoint = async (
    lat: number,
    lon: number,
    apiKey: string,
    signal: AbortSignal,
  ): Promise<WeatherPoint | null> => {
    const url =
      `https://api.openweathermap.org/data/2.5/weather` +
      `?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&units=metric&appid=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, { signal });
    if (!res.ok) {
      throw new Error(`OWM weather ${res.status}`);
    }
    const data = (await res.json()) as OwmCurrentWeather;
    const rLat = data?.coord?.lat;
    const rLon = data?.coord?.lon;
    const temp = data?.main?.temp;
    if (!Number.isFinite(rLat) || !Number.isFinite(rLon) || !Number.isFinite(temp)) return null;

    return {
      lat: rLat as number,
      lon: rLon as number,
      temp: temp as number,
      name: typeof data?.name === 'string' ? data.name : '',
    };
  };

  const load = async () => {
    if (!map || !L) return;
    if (isLoading) return;

    const apiKey = getOwmApiKey();
    if (!apiKey) return;

    const now = Date.now();
    if (now < nextAllowedAt) return;

    const bbox = makeBBox();
    if (!bbox) return;

    const zoom = Math.round(Number(map.getZoom?.() ?? 7));

    const key = keyFromBBox(bbox, zoom);
    if (key === lastKey) return;
    lastKey = key;

    abort?.abort();
    abort = new AbortController();
    const signal = abort.signal;
    isLoading = true;

    try {
      const nodes = gridPoints(bbox);
      const results = await Promise.all(
        nodes.map((n) =>
          fetchPoint(n.lat, n.lon, apiKey, signal).catch((e: unknown) => {
            if (e instanceof Error && e.name === 'AbortError') throw e;
            const msg = e instanceof Error ? e.message : String(e);
            // 401/403 — нет доступа к ключу/эндпоинту: тихий выход, не спамим.
            if (msg.includes('401') || msg.includes('403') || msg.includes('429')) throw e;
            return null;
          }),
        ),
      );

      const seen = new Set<string>();
      const points: WeatherPoint[] = [];
      for (const p of results) {
        if (!p) continue;
        const k = dedupKey(p);
        if (seen.has(k)) continue;
        seen.add(k);
        points.push(p);
        if (points.length >= options.maxLabels) break;
      }

      renderPoints(points);

      backoffMs = 0;
      nextAllowedAt = Date.now() + 800;
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;

      const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
      const isRateLimited = msg.includes('429') || msg.includes('too many requests');
      const isAuth = msg.includes('401') || msg.includes('403');
      if (isRateLimited) {
        backoffMs = backoffMs ? Math.min(backoffMs * 2, 30000) : 2000;
        nextAllowedAt = Date.now() + backoffMs;
      } else if (isAuth) {
        // Ключ без доступа: длинная пауза, чтобы не молотить впустую.
        nextAllowedAt = Date.now() + 60000;
      } else {
        nextAllowedAt = Date.now() + 1500;
      }
      // Сбрасываем ключ, чтобы повторить тот же bbox после паузы.
      lastKey = null;
      console.warn('[Weather Temp Labels] Failed to load OWM data:', msg);
    } finally {
      isLoading = false;
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    const now = Date.now();
    const delay = Math.max(options.debounceMs, Math.max(0, nextAllowedAt - now));
    timer = setTimeout(load, delay);
  };

  const onMoveEnd = () => schedule();

  const start = () => {
    if (started) return;
    started = true;

    try {
      if (typeof map.whenReady === 'function') {
        map.whenReady(() => {
          if (!started) return;
          try {
            map.on('moveend', onMoveEnd);
          } catch {
            // noop
          }
          schedule();
        });
      } else {
        map.on('moveend', onMoveEnd);
        schedule();
      }
    } catch {
      // noop
    }
  };

  const stop = () => {
    if (!started) return;
    started = false;

    try {
      map.off?.('moveend', onMoveEnd);
    } catch {
      // noop
    }
    abort?.abort();
    abort = null;
    if (timer) clearTimeout(timer);
    timer = null;
    lastKey = null;
    layerGroup.clearLayers();
  };

  return {
    layer: layerGroup,
    start,
    stop,
  };
};
