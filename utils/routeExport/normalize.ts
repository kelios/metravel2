import type { LngLat } from './types';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const normalizeLngLat = (p: unknown): LngLat | null => {
  if (!Array.isArray(p) || p.length < 2) return null;
  const lng = Number(p[0]);
  const lat = Number(p[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lng, lat];
};

export const roundCoord = (n: number, precision = 6) => {
  const f = Math.pow(10, precision);
  return Math.round(n * f) / f;
};

export const normalizeTrack = (track: unknown, opts?: { maxPoints?: number; precision?: number }) => {
  const precision = opts?.precision ?? 6;
  const maxPoints = opts?.maxPoints ?? 20000;

  const input = Array.isArray(track) ? track : [];
  const out: LngLat[] = [];

  let last: LngLat | null = null;
  for (const p of input) {
    const ll = normalizeLngLat(p);
    if (!ll) continue;

    const rounded: LngLat = [roundCoord(ll[0], precision), roundCoord(ll[1], precision)];

    // Drop sequential duplicates
    if (last && last[0] === rounded[0] && last[1] === rounded[1]) continue;

    out.push(rounded);
    last = rounded;

    if (out.length >= maxPoints) break;
  }

  return out;
};

export const normalizeWaypoints = (waypoints: unknown, opts?: { precision?: number }) => {
  const precision = opts?.precision ?? 6;
  const input = Array.isArray(waypoints) ? waypoints : [];
  return input
    .map((w: any) => {
      const ll = normalizeLngLat(w?.coordinates);
      if (!ll) return null;
      return {
        name: typeof w?.name === 'string' ? w.name : undefined,
        description: typeof w?.description === 'string' ? w.description : undefined,
        coordinates: [roundCoord(ll[0], precision), roundCoord(ll[1], precision)] as LngLat,
      };
    })
    .filter(Boolean) as { name?: string; description?: string; coordinates: LngLat }[];
};

const TRANSLIT_MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

export const transliterate = (ru: string): string =>
  ru.replace(/[а-яё]/gi, (char) => {
    const lower = char.toLowerCase();
    const mapped = TRANSLIT_MAP[lower] ?? char;
    if (char === lower) return mapped;
    return mapped.charAt(0).toUpperCase() + mapped.slice(1);
  });

export const safeFileBaseName = (name: string) => {
  const trimmed = (name || '').trim();
  const base = trimmed || 'metravel-route';
  // Conservative filename sanitizer with Cyrillic→Latin transliteration so
  // Russian titles don't collapse to the empty fallback.
  return transliterate(base)
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 80) || 'metravel-route';
};

export const isoNow = () => new Date().toISOString();

export const escapeXml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const clampOpacity = (opacity: number | undefined) => {
  if (opacity == null) return 1;
  if (!Number.isFinite(opacity)) return 1;
  return clamp(opacity, 0, 1);
};
