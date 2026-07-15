import { translate as i18nT } from '@/i18n'
const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

const HEIC_EXTENSIONS = ['.heic', '.heif', '.heics', '.heifs'];
const WEB_UPLOAD_MAX_SIDE = 2560;
const WEB_UPLOAD_JPEG_QUALITY = 0.86;
const WEB_UPLOAD_COMPRESS_ABOVE_BYTES = 9 * 1024 * 1024;
const WEB_COMPRESSIBLE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function replaceImageExtension(name: string, nextExtension: string): string {
  const trimmed = String(name || '').trim();
  if (!trimmed) return `image${nextExtension}`;
  return /\.[^.]+$/u.test(trimmed)
    ? trimmed.replace(/\.[^.]+$/u, nextExtension)
    : `${trimmed}${nextExtension}`;
}

function canUseCanvasCompression(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof Image !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function' &&
    typeof URL.revokeObjectURL === 'function'
  );
}

export function isHeicLikeFile(file: File): boolean {
  const normalizedType = String(file?.type || '').trim().toLowerCase();
  if (HEIC_MIME_TYPES.has(normalizedType)) return true;

  const normalizedName = String(file?.name || '').trim().toLowerCase();
  return HEIC_EXTENSIONS.some((extension) => normalizedName.endsWith(extension));
}

// Бросается, когда HEIC не удалось преобразовать в JPEG в браузере.
// Раньше на этом месте молча возвращался исходный .HEIC, который бэкенд
// отклонял с 400 (Bad Request) — теперь вызывающий код ловит ошибку и
// показывает понятное сообщение вместо загрузки заведомо битого файла.
export class HeicConversionError extends Error {
  constructor(cause?: unknown) {
    super(i18nT('shared:utils.webImageUpload.ne_udalos_preobrazovat_heic_v_brauzere_4286f759'));
    this.name = 'HeicConversionError';
    (this as { cause?: unknown }).cause = cause;
  }
}

async function loadImageForCompression(file: File): Promise<HTMLImageElement | null> {
  if (!canUseCanvasCompression()) return null;

  return await new Promise<HTMLImageElement | null>((resolve) => {
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      resolve(null);
      return;
    }

    const image = new Image();
    const finalize = (value: HTMLImageElement | null) => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // noop
      }
      resolve(value);
    };

    image.onload = () => finalize(image);
    image.onerror = () => finalize(null);
    image.src = objectUrl;
  });
}

function getCompressedCanvasSize(width: number, height: number): { width: number; height: number } {
  const maxSide = Math.max(width, height);
  if (maxSide <= WEB_UPLOAD_MAX_SIDE) return { width, height };

  const scale = WEB_UPLOAD_MAX_SIDE / maxSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function compressWebRasterImage(file: File): Promise<File> {
  const normalizedType = String(file?.type || '').trim().toLowerCase();
  if (!WEB_COMPRESSIBLE_TYPES.has(normalizedType)) return file;
  if (file.size <= WEB_UPLOAD_COMPRESS_ABOVE_BYTES) return file;
  if (!canUseCanvasCompression()) return file;

  const image = await loadImageForCompression(file);
  const sourceWidth = Number((image as any)?.naturalWidth || image?.width || 0);
  const sourceHeight = Number((image as any)?.naturalHeight || image?.height || 0);
  if (!image || sourceWidth <= 0 || sourceHeight <= 0) return file;

  const target = getCompressedCanvasSize(sourceWidth, sourceHeight);
  const shouldCompress = file.size > WEB_UPLOAD_COMPRESS_ABOVE_BYTES;
  if (!shouldCompress) return file;

  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof canvas.toBlob !== 'function') return file;

  ctx.drawImage(image, 0, 0, target.width, target.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', WEB_UPLOAD_JPEG_QUALITY);
  });
  if (!blob || blob.size <= 0 || blob.size >= file.size) return file;

  return new File([blob], replaceImageExtension(file.name, '.jpg'), {
    type: 'image/jpeg',
    lastModified: file.lastModified || Date.now(),
  });
}

export async function prepareWebImageFileForUpload(file: File): Promise<File> {
  if (typeof File === 'undefined' || !(file instanceof File)) return file;
  if (!isHeicLikeFile(file)) return await compressWebRasterImage(file);

  // heic-to (libheif-js ~1.18) декодирует современные iPhone HEIC (HEVC),
  // которые устаревший heic2any@0.0.4 не парсил (ERR_LIBHEIF format not supported).
  // Ленивый импорт: wasm грузится только при реальной загрузке HEIC.
  const { heicTo } = await import('heic-to');

  let convertedBlob: Blob;
  try {
    convertedBlob = await heicTo({
      blob: file,
      type: 'image/jpeg',
      quality: 0.92,
    });
  } catch (error) {
    throw new HeicConversionError(error);
  }

  if (!(convertedBlob instanceof Blob)) {
    throw new HeicConversionError('heic-to did not return a Blob');
  }

  const convertedFile = new File([convertedBlob], replaceImageExtension(file.name, '.jpg'), {
    type: 'image/jpeg',
    lastModified: file.lastModified || Date.now(),
  });

  return await compressWebRasterImage(convertedFile);
}
