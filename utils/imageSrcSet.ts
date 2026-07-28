// utils/imageSrcSet.ts
// J4: Responsive image srcSet/sizes utilities (extracted from imageOptimization.ts)

import { Platform } from 'react-native';
import type { ImageOptimizationOptions } from './imageProxy';
import { optimizeImageUrl } from './imageProxy';

export interface ResponsiveImageSource {
  src: string;
  srcSet?: string;
  sizes?: string;
  format: string;
}

export function generateSrcSet(
  baseUrl: string,
  sizes: number[],
  options: Omit<ImageOptimizationOptions, 'width' | 'height'> = {}
): string {
  if (!baseUrl) return '';
  if (Platform.OS !== 'web') return baseUrl;

  // Keep srcset candidates aligned with the main src default:
  // prefer backend/content negotiation unless the caller explicitly forces
  // a format. This avoids generating `f=webp`/`f=avif` URLs for media
  // conversions that may only exist in the original format.
  const resolvedFormat = options.format ?? 'auto';
  const srcset = sizes
    .map((size) => {
      const optimizedOptions: ImageOptimizationOptions = {
        width: size,
        format: resolvedFormat,
        quality: options.quality ?? 75,
        fit: options.fit,
      };
      if (options.dpr !== undefined) {
        optimizedOptions.dpr = options.dpr;
      }
      const optimizedUrl = optimizeImageUrl(baseUrl, optimizedOptions);
      return `${optimizedUrl} ${size}w`;
    })
    .join(', ');

  return srcset || baseUrl;
}

export function getResponsiveSizes(maxWidth: number = 1920): number[] {
  const sizes: number[] = [];
  const breakpoints = [320, 640, 768, 1024, 1280, 1536, 1920];

  for (const bp of breakpoints) {
    if (bp <= maxWidth) sizes.push(bp);
  }

  if (maxWidth > 1920 && !sizes.includes(maxWidth)) sizes.push(maxWidth);
  return sizes.sort((a, b) => a - b);
}

export function buildResponsiveImageProps(
  baseUrl: string,
  options: {
    maxWidth?: number;
    widths?: number[];
    sizes?: string;
    quality?: number;
    format?: ImageOptimizationOptions['format'];
    fit?: ImageOptimizationOptions['fit'];
    dpr?: number;
  } = {}
): { src: string; srcSet?: string; sizes?: string } {
  if (!baseUrl) return { src: '' };

  const widths = options.widths ?? getResponsiveSizes(options.maxWidth ?? 1920);
  const widest = widths.length > 0 ? widths[widths.length - 1] : options.maxWidth ?? 1920;
  const format = options.format ?? 'auto';

  const optimizeOptions: ImageOptimizationOptions = {
    width: widest,
    quality: options.quality ?? 75,
    format,
    fit: options.fit,
  };

  if (options.dpr !== undefined) optimizeOptions.dpr = options.dpr;

  const src = optimizeImageUrl(baseUrl, optimizeOptions) || baseUrl;

  if (Platform.OS !== 'web') return { src };

  const srcSetOptions: Omit<ImageOptimizationOptions, 'width' | 'height'> = {
    format,
    quality: options.quality ?? 75,
    fit: options.fit,
  };

  if (options.dpr !== undefined) srcSetOptions.dpr = options.dpr;

  const srcSet = generateSrcSet(baseUrl, widths, srcSetOptions);
  return { src, srcSet, sizes: options.sizes ?? '100vw' };
}

// #1118: здесь жили `buildResponsiveImage`, `buildLqipUrl`, `generateLQIP`,
// `calculateImageDimensions`, `createLazyImageProps`, `shouldLoadEager` и
// `generateSizes` — ни одна из них не вызывалась в приложении. Часть при этом
// строила заведомо нерабочие URL: `buildLqipUrl` просил `w=24`, `generateLQIP` —
// `w=15`, а таких ступеней у прокси нет, и он отдаёт исходный файл целиком
// (см. DIMENSION_LADDER в `utils/imageProxy.ts`). Живой LQIP приходит из
// backend-манифеста через `getMediaLqipUrl`.
