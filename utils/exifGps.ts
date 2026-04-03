type GpsCoords = { lat: number; lng: number };
type ExifGpsOverride = GpsCoords | ((file: File) => GpsCoords | null | Promise<GpsCoords | null>) | null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isValidGps = (coords: GpsCoords) =>
  isFiniteNumber(coords.lat) &&
  isFiniteNumber(coords.lng) &&
  coords.lat >= -90 &&
  coords.lat <= 90 &&
  coords.lng >= -180 &&
  coords.lng <= 180;

const getTestGpsOverride = (): ExifGpsOverride => {
  const globalValue = (globalThis as typeof globalThis & {
    __METRAVEL_E2E_EXIF_GPS__?: ExifGpsOverride;
  }).__METRAVEL_E2E_EXIF_GPS__;

  return globalValue ?? null;
};

/**
 * Extracts GPS coordinates from image EXIF (if present).
 * - Web-only (expects browser `File`).
 * - Returns `null` when GPS is missing or unreadable.
 */
export async function extractGpsFromImageFile(file: File): Promise<GpsCoords | null> {
  if (typeof file === 'undefined' || file == null) return null;

  try {
    const testOverride = getTestGpsOverride();
    if (testOverride) {
      const rawCoords =
        typeof testOverride === 'function' ? await testOverride(file) : testOverride;
      if (!rawCoords) return null;
      const coords = { lat: Number(rawCoords.lat), lng: Number(rawCoords.lng) };
      return isValidGps(coords) ? coords : null;
    }

    // `exifr` default entry pulls the full ESM bundle, which includes a
    // webpack-specific dynamic import comment that Hermes fails to parse
    // during web export. The lite bundle still provides `gps()` and avoids
    // that problematic code path.
    const mod: any = await import('exifr/dist/lite.esm.mjs');
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
