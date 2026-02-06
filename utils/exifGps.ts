type GpsCoords = { lat: number; lng: number };

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isValidGps = (coords: GpsCoords) =>
  isFiniteNumber(coords.lat) &&
  isFiniteNumber(coords.lng) &&
  coords.lat >= -90 &&
  coords.lat <= 90 &&
  coords.lng >= -180 &&
  coords.lng <= 180;

/**
 * Extracts GPS coordinates from image EXIF (if present).
 * - Web-only (expects browser `File`).
 * - Returns `null` when GPS is missing or unreadable.
 */
export async function extractGpsFromImageFile(file: File): Promise<GpsCoords | null> {
  if (typeof file === 'undefined' || file == null) return null;

  try {
    const mod: any = await import('exifr');
    const gpsFn =
      (typeof mod?.gps === 'function' ? mod.gps : null) ||
      (typeof mod?.default?.gps === 'function' ? mod.default.gps : null);

    if (!gpsFn) return null;

    const gps = await gpsFn(file);
    if (!gps) return null;

    const latRaw = gps?.latitude ?? gps?.lat ?? null;
    const lngRaw = gps?.longitude ?? gps?.lng ?? null;
    if (latRaw == null || lngRaw == null) return null;

    const coords = { lat: Number(latRaw), lng: Number(lngRaw) };
    return isValidGps(coords) ? coords : null;
  } catch {
    return null;
  }
}
