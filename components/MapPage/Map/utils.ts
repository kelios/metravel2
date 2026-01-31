// components/MapPage/map/utils.ts
import { CoordinateConverter } from '@/utils/coordinateConverter';

export const strToLatLng = (
  s: string,
  hintCenter?: { lat: number; lng: number } | null
): [number, number] | null => {
  const raw = typeof s === 'string' ? s.trim() : '';
  if (!raw) return null;

  const cleaned = raw.replace(/;/g, ',').replace(/\s+/g, '');

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
    return chosen ? [chosen.lng, chosen.lat] : null;
  }

  if (baseValid && swappedValid) {
    const dBase = CoordinateConverter.distance(hintCenter, baseValid);
    const dSwapped = CoordinateConverter.distance(hintCenter, swappedValid);
    const chosen = dSwapped < dBase ? swappedValid : baseValid;
    return [chosen.lng, chosen.lat];
  }

  const chosen = baseValid ?? swappedValid;
  return chosen ? [chosen.lng, chosen.lat] : null;
};

export const generateUniqueId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

