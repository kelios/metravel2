// utils/imageCompressor.ts
// AND-15: Image compression utility for native platforms.
// Resizes images to max 1920px on the largest side and compresses to quality 0.8.
// On web — no-op (returns original URI).

import { Platform } from 'react-native';
import type { CompressOptions, CompressResult } from './imageCompressor.types';
export type { CompressOptions, CompressResult } from './imageCompressor.types';

const MAX_DIMENSION = 1920;
const DEFAULT_QUALITY = 0.8;
const AVATAR_SIZE = 512;

type ImageSize = { width: number; height: number };

const isPositiveSize = (size: unknown): size is ImageSize =>
  typeof size === 'object'
  && size !== null
  && Number.isFinite((size as ImageSize).width)
  && Number.isFinite((size as ImageSize).height)
  && (size as ImageSize).width > 0
  && (size as ImageSize).height > 0;

/**
 * Размер исходного файла через `Image.getSize` (RN отдаёт либо Promise, либо
 * зовёт колбэки — поддерживаем обе формы). `null` — размер узнать не удалось;
 * тогда уменьшаем по одной стороне, но никогда не задаём обе.
 */
async function readImageSize(uri: string): Promise<ImageSize | null> {
  try {
    const { Image } = require('react-native');
    const getSize = Image?.getSize;
    if (typeof getSize !== 'function') return null;
    return await new Promise<ImageSize | null>((resolve) => {
      let settled = false;
      const done = (size: ImageSize | null) => {
        if (settled) return;
        settled = true;
        resolve(size);
      };
      try {
        const maybePromise = getSize.call(
          Image,
          uri,
          (width: number, height: number) => done(isPositiveSize({ width, height }) ? { width, height } : null),
          () => done(null),
        );
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(
            (size: unknown) => done(isPositiveSize(size) ? { width: size.width, height: size.height } : null),
            () => done(null),
          );
        }
      } catch {
        done(null);
      }
    });
  } catch {
    return null;
  }
}

/**
 * Действия для expo-image-manipulator. ВАЖНО: `resize` с ОБОИМИ `width` и
 * `height` растягивает кадр ровно в эти размеры без сохранения пропорций —
 * именно так фото отзывов квестов уезжали на сервер квадратами 1920×1920 с
 * «расплющенными» людьми. Поэтому задаём только одну сторону, а вторую
 * манипулятор досчитывает по пропорции сам.
 */
export function buildResizeActions(
  size: ImageSize | null,
  { maxDimension, squareCrop }: { maxDimension: number; squareCrop: boolean },
): Array<Record<string, unknown>> {
  if (squareCrop) {
    if (!size) {
      // Без размеров квадрат не вырезать — хотя бы не искажаем.
      return [{ resize: { width: AVATAR_SIZE } }];
    }
    const side = Math.min(size.width, size.height);
    const actions: Array<Record<string, unknown>> = [];
    if (size.width !== size.height) {
      actions.push({
        crop: {
          originX: Math.floor((size.width - side) / 2),
          originY: Math.floor((size.height - side) / 2),
          width: side,
          height: side,
        },
      });
    }
    if (side > AVATAR_SIZE) actions.push({ resize: { width: AVATAR_SIZE } });
    return actions;
  }

  if (!size) {
    // Пропорции сохраняются; портрет может выйти выше maxDimension — сервер
    // всё равно режет мастер по своему потолку.
    return [{ resize: { width: maxDimension } }];
  }
  const longest = Math.max(size.width, size.height);
  // Маленький кадр не растягиваем вверх — только перекодируем.
  if (longest <= maxDimension) return [];
  return size.width >= size.height
    ? [{ resize: { width: maxDimension } }]
    : [{ resize: { height: maxDimension } }];
}

/**
 * AND-15: Compress and resize an image before upload.
 *
 * - On native: uses expo-image-manipulator to resize + compress.
 * - On web: returns the original URI (server should handle resizing).
 *
 * @param uri - Local file URI (from image picker)
 * @param options - Compression options
 * @returns Compressed image URI + dimensions
 */
export async function compressImage(
  uri: string,
  options: CompressOptions = {},
): Promise<CompressResult> {
  if (Platform.OS === 'web') {
    // On web, return as-is — server handles optimization
    return { uri, width: 0, height: 0 };
  }

  const {
    maxDimension = MAX_DIMENSION,
    quality = DEFAULT_QUALITY,
    squareCrop = false,
  } = options;

  try {
    const ImageManipulator = require('expo-image-manipulator');
    const manipulate = ImageManipulator.manipulateAsync ?? ImageManipulator.default?.manipulateAsync;
    const SaveFormat = ImageManipulator.SaveFormat ?? ImageManipulator.default?.SaveFormat;

    if (!manipulate) {
      // Module not available — return original
      return { uri, width: 0, height: 0 };
    }

    const size = await readImageSize(uri);
    const actions = buildResizeActions(size, { maxDimension, squareCrop });

    const result = await manipulate(uri, actions, {
      compress: quality,
      format: SaveFormat?.JPEG ?? 'jpeg',
    });

    return {
      uri: result.uri,
      width: result.width ?? 0,
      height: result.height ?? 0,
    };
  } catch {
    // Fallback — return original if manipulation fails
    return { uri, width: 0, height: 0 };
  }
}

/**
 * AND-15: Compress an avatar image (centered square crop, 512px).
 */
export async function compressAvatar(uri: string): Promise<CompressResult> {
  return compressImage(uri, {
    maxDimension: AVATAR_SIZE,
    quality: 0.85,
    squareCrop: true,
  });
}

/**
 * AND-15: Compress a travel photo (max 1920px on the longest side, quality 0.8).
 */
export async function compressTravelPhoto(uri: string): Promise<CompressResult> {
  return compressImage(uri, {
    maxDimension: MAX_DIMENSION,
    quality: DEFAULT_QUALITY,
  });
}
