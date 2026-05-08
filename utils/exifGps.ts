type GpsCoords = { lat: number; lng: number };
type ExifGpsOverride = GpsCoords | ((file: File) => GpsCoords | null | Promise<GpsCoords | null>) | null;

export const EXIF_IMAGE_INPUT_ACCEPT = 'image/*,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif';

const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

const HEIC_EXTENSIONS = ['.heic', '.heif', '.heics', '.heifs'];
const HEIC_COMPATIBLE_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
]);
const HEIC_HEADER_SCAN_LIMIT = 128;

let heicExifParserPatched = false;

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

const isHeicLikeFile = (file: File): boolean => {
  const normalizedType = String(file?.type || '').trim().toLowerCase();
  if (HEIC_MIME_TYPES.has(normalizedType)) return true;

  const normalizedName = String(file?.name || '').trim().toLowerCase();
  return HEIC_EXTENSIONS.some((extension) => normalizedName.endsWith(extension));
};

const looksLikeHeicIsoBmff = (
  fileView: {
    byteLength: number;
    getString: (offset: number, length: number) => string;
    getUint32: (offset: number) => number;
  },
  firstTwoBytes: number,
): boolean => {
  if (firstTwoBytes !== 0) return false;

  try {
    if (fileView.getString(4, 4) !== 'ftyp') return false;

    const declaredHeaderLength = Number(fileView.getUint32(0));
    const scanLimit = Math.min(
      Number.isFinite(declaredHeaderLength) && declaredHeaderLength > 0
        ? declaredHeaderLength
        : fileView.byteLength,
      fileView.byteLength,
      HEIC_HEADER_SCAN_LIMIT,
    );

    for (let offset = 8; offset + 4 <= scanLimit; offset += 4) {
      if (HEIC_COMPATIBLE_BRANDS.has(fileView.getString(offset, 4))) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
};

const patchExifHeicParser = (mod: any, file: File) => {
  if (heicExifParserPatched || !isHeicLikeFile(file)) return;

  const fileParsers = mod?.fileParsers;
  const OriginalHeicParser = fileParsers?.get?.('heic');
  if (!(fileParsers instanceof Map) || typeof OriginalHeicParser !== 'function') return;

  class PatchedHeicParser extends OriginalHeicParser {
    static canHandle(fileView: any, firstTwoBytes: number) {
      if (typeof OriginalHeicParser.canHandle === 'function' && OriginalHeicParser.canHandle(fileView, firstTwoBytes)) {
        return true;
      }

      return looksLikeHeicIsoBmff(fileView, firstTwoBytes);
    }
  }

  fileParsers.set('patched-heic', PatchedHeicParser);
  heicExifParserPatched = true;
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
    patchExifHeicParser(mod, file);
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
