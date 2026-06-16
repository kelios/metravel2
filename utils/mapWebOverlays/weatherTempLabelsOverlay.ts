import type { BBox } from '@/utils/overpass';
import { bboxAreaKm2 } from '@/utils/overpass';
import { getOwmApiKey } from '@/config/mapWebLayers';

type LeafletMap = any;

export type WeatherTempLabelsOverlayOptions = {
  /** Защитный лимит площади bbox (км²); больше — bbox сжимается к центру. */
  maxAreaKm2?: number;
  /** Дебаунс на moveend/zoomend. */
  debounceMs?: number;
  /** Максимум подписей на карте (OWM cnt, максимум по API ~50). */
  maxLabels?: number;
};

const defaultOpts: Required<WeatherTempLabelsOverlayOptions> = {
  maxAreaKm2: 90000, // ~300x300 км — OWM box/city покрывает крупные области
  debounceMs: 600,
  maxLabels: 50,
};

interface OwmBoxCity {
  id: number;
  name: string;
  coord: { lat: number; lon: number };
  main: { temp: number };
}

interface OwmBoxResponse {
  list?: OwmBoxCity[];
}

const formatTemp = (temp: number): string => {
  if (!Number.isFinite(temp)) return '';
  const rounded = Math.round(temp);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}°`;
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
  let timer: any = null;
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

  const shrinkBBoxToMaxArea = (bbox: BBox, maxAreaKm2: number): BBox => {
    const area = bboxAreaKm2(bbox);
    if (!(area > maxAreaKm2)) return bbox;

    const factor = Math.sqrt(maxAreaKm2 / area);
    const centerLat = (bbox.north + bbox.south) / 2;
    const centerLng = (bbox.east + bbox.west) / 2;
    const halfLat = Math.abs(bbox.north - bbox.south) / 2;
    const halfLng = Math.abs(bbox.east - bbox.west) / 2;

    return {
      south: centerLat - halfLat * factor,
      west: centerLng - halfLng * factor,
      north: centerLat + halfLat * factor,
      east: centerLng + halfLng * factor,
    };
  };

  const keyFromBBox = (bbox: BBox, zoom: number) => {
    const r = (n: number) => Math.round(n * 100) / 100;
    return `${r(bbox.south)}|${r(bbox.west)}|${r(bbox.north)}|${r(bbox.east)}|${zoom}`;
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

  const renderCities = (cities: OwmBoxCity[]) => {
    layerGroup.clearLayers();

    for (const c of cities) {
      const lat = c?.coord?.lat;
      const lon = c?.coord?.lon;
      const temp = c?.main?.temp;
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(temp)) continue;

      const text = formatTemp(temp);
      if (!text) continue;

      try {
        const marker = L.marker([lat, lon], {
          icon: makeIcon(text, tempColor(temp)),
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

  const load = async () => {
    if (!map || !L) return;
    if (isLoading) return;

    const apiKey = getOwmApiKey();
    if (!apiKey) return;

    const now = Date.now();
    if (now < nextAllowedAt) return;

    const rawBBox = makeBBox();
    if (!rawBBox) return;

    const zoom = Math.round(Number(map.getZoom?.() ?? 7));
    const bbox = shrinkBBoxToMaxArea(rawBBox, options.maxAreaKm2);

    const key = keyFromBBox(bbox, zoom);
    if (key === lastKey) return;
    lastKey = key;

    abort?.abort();
    abort = new AbortController();
    isLoading = true;

    try {
      // OWM box/city: bbox={lonLeft},{latBottom},{lonRight},{latTop},{zoom}
      const bboxParam = [bbox.west, bbox.south, bbox.east, bbox.north, zoom].join(',');
      const url =
        `https://api.openweathermap.org/data/2.5/box/city` +
        `?bbox=${bboxParam}&units=metric&appid=${encodeURIComponent(apiKey)}`;

      const res = await fetch(url, { signal: abort.signal });
      if (!res.ok) {
        throw new Error(`OWM box/city ${res.status}`);
      }
      const data = (await res.json()) as OwmBoxResponse;
      const cities = Array.isArray(data?.list) ? data.list.slice(0, options.maxLabels) : [];
      renderCities(cities);

      backoffMs = 0;
      nextAllowedAt = Date.now() + 800;
    } catch (e: any) {
      if (e?.name === 'AbortError') return;

      const msg = String(e?.message || '').toLowerCase();
      const isRateLimited = msg.includes('429') || msg.includes('too many requests');
      if (isRateLimited) {
        backoffMs = backoffMs ? Math.min(backoffMs * 2, 30000) : 2000;
        nextAllowedAt = Date.now() + backoffMs;
      } else {
        nextAllowedAt = Date.now() + 1500;
      }
      // Сбрасываем ключ, чтобы повторить тот же bbox после бэкоффа.
      lastKey = null;
      console.warn('[Weather Temp Labels] Failed to load OWM data:', e?.message || e);
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
