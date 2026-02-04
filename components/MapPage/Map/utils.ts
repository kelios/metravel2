// components/MapPage/map/utils.ts
import { CoordinateConverter } from '@/utils/coordinateConverter';

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
    const out = chosen ? [chosen.lng, chosen.lat] : null;
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
  const out = chosen ? [chosen.lng, chosen.lat] : null;
  setCache(cacheKey, out);
  return out;
};

export const generateUniqueId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
