import { translate as i18nT } from '@/i18n';

const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

const HEIC_EXTENSIONS = ['.heic', '.heif', '.heics', '.heifs'];

export function isHeicLikeFile(file: File): boolean {
  const normalizedType = String(file?.type || '').trim().toLowerCase();
  if (HEIC_MIME_TYPES.has(normalizedType)) return true;

  const normalizedName = String(file?.name || '').trim().toLowerCase();
  return HEIC_EXTENSIONS.some((extension) => normalizedName.endsWith(extension));
}

export class HeicConversionError extends Error {
  constructor(cause?: unknown) {
    super(i18nT('shared:utils.webImageUpload.ne_udalos_preobrazovat_heic_v_brauzere_4286f759'));
    this.name = 'HeicConversionError';
    Object.defineProperty(this, 'cause', {
      configurable: true,
      value: cause,
      writable: true,
    });
  }
}

/** Native uploads use the platform image pipeline; browser canvas/WASM is web-only. */
export async function compressWebRasterImage(file: File): Promise<File> {
  return file;
}

/** Keep shared callers safe without bundling the LGPL browser HEIC decoder on native. */
export async function prepareWebImageFileForUpload(file: File): Promise<File> {
  return file;
}
