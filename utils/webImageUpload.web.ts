import { translate as i18nT } from '@/i18n'
const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

const HEIC_EXTENSIONS = ['.heic', '.heif', '.heics', '.heifs'];

// #1164: 2500 = `PRINT_IMAGE_MAX_SIZE` бэкенда, самая большая сторона, которую он
// реально хранит. Прежние 2560 не были согласованы ни с одним серверным значением:
// мастер режется до 1920 (`ImageProcessingConfig.max_width`), print — до 2500.
// Ниже 2500 опускать нельзя, пока существует print-вариант (см. BE #1156): клиентский
// downscale обрежет то, что нужно PDF-экспорту.
const WEB_UPLOAD_MAX_SIDE = 2500;
const WEB_UPLOAD_JPEG_QUALITY = 0.86;

// Страховка под `MAX_IMAGE_UPLOAD_SIZE = 10 MB` на бэкенде: файл может быть тяжёлым
// и при скромных размерах в пикселях (например PNG-скриншот 2000×2000 на 12 МБ).
// Такой downscale не спасёт — его нужно именно пережать.
const WEB_UPLOAD_COMPRESS_ABOVE_BYTES = 9 * 1024 * 1024;

// Ниже этого веса не декодируем файл вообще. Правило по пикселям требует знать
// размеры, а узнать их можно только декодированием — то есть ценой лишней работы на
// КАЖДОЙ загрузке. Для файла легче 512 КБ выигрыш от downscale исчезающе мал (такой
// файл уже хорошо сжат), а цена — декод и перерисовка канваса на каждое фото.
const WEB_UPLOAD_DECODE_ABOVE_BYTES = 512 * 1024;
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
    Object.defineProperty(this, 'cause', {
      configurable: true,
      value: cause,
      writable: true,
    });
  }
}

// #1164: декодирование теперь происходит на КАЖДОЙ загрузке растра (раньше только у
// файлов тяжелее 9 МБ), поэтому ожидание обязано быть ограниченным. Браузер не
// гарантирует ни `onload`, ни `onerror`: на битом или неподдержанном файле оба
// события могут не прийти вовсе, и без таймаута загрузка зависала бы навсегда —
// пользователь видел бы вечный спиннер вместо отправки оригинала.
const IMAGE_DECODE_TIMEOUT_MS = 5000;

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

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const image = new Image();
    const finalize = (value: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // noop
      }
      resolve(value);
    };

    timer = setTimeout(() => finalize(null), IMAGE_DECODE_TIMEOUT_MS);
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

/**
 * #1164: раньше решение принималось ТОЛЬКО по весу файла (`> 9 МБ`). Порог был
 * подогнан под серверный лимит загрузки и спасал от 400, но не экономил ни байта
 * трафика: фото 6000×4000 на 8 МБ уезжало по мобильной сети целиком, чтобы сервер
 * тут же срезал его до 1920 (`ImageProcessingConfig.max_width`). Native при этом
 * всегда жал до 1920 (`utils/imageCompressor.ts`) — web и native расходились без
 * причины.
 *
 * Теперь основной признак — размер в пикселях; вес остался вторым триггером для
 * случая «пикселей немного, а байт много» (см. `WEB_UPLOAD_COMPRESS_ABOVE_BYTES`).
 */
export async function compressWebRasterImage(file: File): Promise<File> {
  const normalizedType = String(file?.type || '').trim().toLowerCase();
  if (!WEB_COMPRESSIBLE_TYPES.has(normalizedType)) return file;
  if (!canUseCanvasCompression()) return file;

  if (file.size <= WEB_UPLOAD_DECODE_ABOVE_BYTES) return file;

  const exceedsUploadBudget = file.size > WEB_UPLOAD_COMPRESS_ABOVE_BYTES;

  const image = await loadImageForCompression(file);
  const sourceWidth = Number(image?.naturalWidth || image?.width || 0);
  const sourceHeight = Number(image?.naturalHeight || image?.height || 0);
  if (!image || sourceWidth <= 0 || sourceHeight <= 0) return file;

  const needsDownscale = Math.max(sourceWidth, sourceHeight) > WEB_UPLOAD_MAX_SIDE;
  if (!needsDownscale && !exceedsUploadBudget) return file;

  const target = getCompressedCanvasSize(sourceWidth, sourceHeight);

  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d');
  if (!ctx || typeof canvas.toBlob !== 'function') return file;

  // JPEG не хранит альфу, и прозрачные пиксели PNG выходят чёрными. Под правилом по
  // весу сюда попадали единицы файлов, теперь — любой PNG крупнее 2500px, поэтому
  // подкладываем белый фон, как это делают обычные компрессоры.
  if (typeof ctx.fillRect === 'function') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, target.width, target.height);
  }
  ctx.drawImage(image, 0, 0, target.width, target.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', WEB_UPLOAD_JPEG_QUALITY);
  });
  // Если пережатие не дало выигрыша (например фото уже маленькое и хорошо сжатое),
  // отправляем оригинал — качество важнее косметической экономии.
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
