// components/MapPage/map/utils.ts
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { getMapPointIdentityKey } from '@/api/mapPlaces';

const parseCache = new Map<string, [number, number] | null>();
const MAX_PARSE_CACHE = 6000;

const makeCacheKey = (raw: string, hintCenter?: { lat: number; lng: number } | null) => {
  if (!hintCenter || !CoordinateConverter.isValid(hintCenter)) return raw;
  // Round hintCenter to keep cache hit-rate high while still being correct when user moves far away.
  const hLat = Number(hintCenter.lat);
  const hLng = Number(hintCenter.lng);
  const tag =
    Number.isFinite(hLat) && Number.isFinite(hLng)
      ? `${hLat.toFixed(3)},${hLng.toFixed(3)}`
      : 'no-hint';
  return `${raw}|${tag}`;
};

const setCache = (key: string, value: [number, number] | null) => {
  if (parseCache.size >= MAX_PARSE_CACHE) {
    // Drop oldest entries (in insertion order).
    const toDelete = Math.max(500, Math.floor(MAX_PARSE_CACHE * 0.2));
    const it = parseCache.keys();
    for (let i = 0; i < toDelete; i++) {
      const k = it.next().value;
      if (!k) break;
      parseCache.delete(k);
    }
  }
  parseCache.set(key, value);
};

export const strToLatLng = (
  s: string,
  hintCenter?: { lat: number; lng: number } | null
): [number, number] | null => {
  const raw = typeof s === 'string' ? s.trim() : '';
  if (!raw) return null;

  const cleaned = raw.replace(/;/g, ',').replace(/\s+/g, '');
  const cacheKey = makeCacheKey(cleaned, hintCenter);
  if (parseCache.has(cacheKey)) {
    return parseCache.get(cacheKey) ?? null;
  }

  const base = CoordinateConverter.fromLooseString(cleaned);
  const baseValid = base && CoordinateConverter.isValid(base) ? base : null;

  let swappedValid: { lat: number; lng: number } | null = null;
  const parts = cleaned.split(',');
  if (parts.length === 2) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const swapped = { lat: b, lng: a };
      if (CoordinateConverter.isValid(swapped)) swappedValid = swapped;
    }
  }

  if (!baseValid && !swappedValid) return null;
  if (!hintCenter || !CoordinateConverter.isValid(hintCenter)) {
    const chosen = baseValid ?? swappedValid;
    const out: [number, number] | null = chosen ? [chosen.lng, chosen.lat] : null;
    setCache(cacheKey, out);
    return out;
  }

  if (baseValid && swappedValid) {
    const dBase = CoordinateConverter.distance(hintCenter, baseValid);
    const dSwapped = CoordinateConverter.distance(hintCenter, swappedValid);
    const chosen = dSwapped < dBase ? swappedValid : baseValid;
    const out: [number, number] = [chosen.lng, chosen.lat];
    setCache(cacheKey, out);
    return out;
  }

  const chosen = baseValid ?? swappedValid;
  const out: [number, number] | null = chosen ? [chosen.lng, chosen.lat] : null;
  setCache(cacheKey, out);
  return out;
};

export const generateUniqueId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Stable identity of a map point for React keys / imperative marker diffing.
 * Определение переехало в `@/api/mapPlaces` (#1571): тот же ключ служит
 * legacy-fallback для placeKey; здесь остаётся ре-экспорт для прежних импортёров.
 */
export { getMapPointIdentityKey };

/**
 * Everything a marker/popup actually renders. Used both to decide whether a cached
 * points array may keep its identity and whether an already-mounted marker still
 * shows current data.
 */
export const getMapPointContentKey = (point: {
  id?: unknown;
  coord?: unknown;
  address?: unknown;
  categoryName?: unknown;
  travelImageThumbUrl?: unknown;
  urlTravel?: unknown;
}): string => {
  // categoryName is polymorphic across payloads (string | object | array), so stringify
  // defensively instead of typing it — the key only needs to change when it changes.
  const part = (value: unknown): string => {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
      return JSON.stringify(value) ?? '';
    } catch {
      return '';
    }
  };

  return [
    getMapPointIdentityKey(point),
    part(point?.address),
    part(point?.categoryName),
    part(point?.travelImageThumbUrl),
    part(point?.urlTravel),
  ].join('|');
};
