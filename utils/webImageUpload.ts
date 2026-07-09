const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

const HEIC_EXTENSIONS = ['.heic', '.heif', '.heics', '.heifs'];

function replaceImageExtension(name: string, nextExtension: string): string {
  const trimmed = String(name || '').trim();
  if (!trimmed) return `image${nextExtension}`;
  return trimmed.replace(/\.[^.]+$/u, nextExtension) === trimmed
    ? `${trimmed}${nextExtension}`
    : trimmed.replace(/\.[^.]+$/u, nextExtension);
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
    super('Не удалось преобразовать HEIC в браузере');
    this.name = 'HeicConversionError';
    (this as { cause?: unknown }).cause = cause;
  }
}

export async function prepareWebImageFileForUpload(file: File): Promise<File> {
  if (typeof File === 'undefined' || !(file instanceof File)) return file;
  if (!isHeicLikeFile(file)) return file;

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

  return new File([convertedBlob], replaceImageExtension(file.name, '.jpg'), {
    type: 'image/jpeg',
    lastModified: file.lastModified || Date.now(),
  });
}
