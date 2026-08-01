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
  sizes: readonly number[],
  options: Omit<ImageOptimizationOptions, 'width'> = {}
): string {
  if (!baseUrl) return '';
  if (Platform.OS !== 'web') return baseUrl;

  // Keep srcset candidates aligned with the main src default:
  // prefer backend/content negotiation unless the caller explicitly forces
  // a format. This avoids generating `f=webp`/`f=avif` URLs for media
  // conversions that may only exist in the original format.
  const resolvedFormat = options.format ?? 'auto';
  const seenProxyCandidates = new Set<string>();
  const srcset = sizes
    .flatMap((size) => {
      const optimizedOptions: ImageOptimizationOptions = {
        width: size,
        format: resolvedFormat,
        quality: options.quality ?? 75,
        fit: options.fit,
      };
      const optimizedUrl = optimizeImageUrl(baseUrl, optimizedOptions) || baseUrl;

      // The backend proxy supports a fixed width ladder. Several requested
      // widths can therefore resolve to the same canonical `w` URL (for
      // example 239/240/241 -> 320). Advertising that single file under
      // several descriptors makes the browser treat it as distinct candidates
      // and fragments request/cache accounting. Use the actual proxy width and
      // emit each canonical candidate once. Third-party URLs without `w` keep
      // their caller-provided descriptors.
      try {
        const proxyWidth = Number(
          new URL(optimizedUrl, 'https://placeholder.invalid').searchParams.get('w')
        );
        if (Number.isFinite(proxyWidth) && proxyWidth > 0) {
          const candidateKey = `${optimizedUrl}|${proxyWidth}`;
          if (seenProxyCandidates.has(candidateKey)) return [];
          seenProxyCandidates.add(candidateKey);
          return [`${optimizedUrl} ${proxyWidth}w`];
        }
      } catch {
        // Keep the original descriptor for opaque/non-URL sources.
      }

      return [`${optimizedUrl} ${size}w`];
    })
    .join(', ');

  return srcset || baseUrl;
}

// #1160: брейкпоинты — это значения, которые сразу после этого уйдут в
// `snapDimensionUp`, поэтому они обязаны быть ступенями лестницы прокси. Раньше
// здесь стояли CSS-брейкпоинты вёрстки (768, 1536), которые снэпились в 800 и 1600:
// набор кандидатов от этого не менялся, но читающий код видел ширины, которых у
// прокси нет, и делал из этого неверные выводы (ровно так появился потолок 800 в
// `htmlTransform.ts`). Источник правды по ступеням — `DIMENSION_LADDER`
// в `utils/imageProxy.ts` и `docs/features/images.md`.
//
// #1171: не в публичном экспорте — используется только как дефолт
// `buildResponsiveImageProps` ниже.
export function getResponsiveSizes(maxWidth: number = 1920): number[] {
  const sizes: number[] = [];
  const breakpoints = [320, 640, 800, 1024, 1280, 1600, 1920];

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
    widths?: readonly number[];
    sizes?: string;
    quality?: number;
    format?: ImageOptimizationOptions['format'];
    fit?: ImageOptimizationOptions['fit'];
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

  const src = optimizeImageUrl(baseUrl, optimizeOptions) || baseUrl;

  if (Platform.OS !== 'web') return { src };

  const srcSetOptions: Omit<ImageOptimizationOptions, 'width'> = {
    format,
    quality: options.quality ?? 75,
    fit: options.fit,
  };

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
