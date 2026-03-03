// utils/imageCompressor.ts
// AND-15: Image compression utility for native platforms.
// Resizes images to max 1920px on the largest side and compresses to quality 0.8.
// On web — no-op (returns original URI).

import { Platform } from 'react-native';

const MAX_DIMENSION = 1920;
const DEFAULT_QUALITY = 0.8;
const AVATAR_SIZE = 512;

interface CompressOptions {
  /** Max dimension for the largest side. Default: 1920 */
  maxDimension?: number;
  /** JPEG compression quality (0–1). Default: 0.8 */
  quality?: number;
  /** Force square crop (for avatars) */
  squareCrop?: boolean;
}

interface CompressResult {
  uri: string;
  width: number;
  height: number;
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

    const actions: Array<Record<string, unknown>> = [];

    if (squareCrop) {
      // For avatars: resize to fixed square
      actions.push({ resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } });
    } else {
      // Resize to fit within maxDimension, maintaining aspect ratio
      actions.push({ resize: { width: maxDimension, height: maxDimension } });
    }

    // Note: `resize` in expo-image-manipulator with both width+height
    // will fit the image within those bounds, maintaining aspect ratio.
    // Only one dimension is actually constrained (the larger one).

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
 * AND-15: Compress an avatar image (square crop, 512px).
 */
export async function compressAvatar(uri: string): Promise<CompressResult> {
  return compressImage(uri, {
    maxDimension: AVATAR_SIZE,
    quality: 0.85,
    squareCrop: true,
  });
}

/**
 * AND-15: Compress a travel photo (max 1920px, quality 0.8).
 */
export async function compressTravelPhoto(uri: string): Promise<CompressResult> {
  return compressImage(uri, {
    maxDimension: MAX_DIMENSION,
    quality: DEFAULT_QUALITY,
  });
}

