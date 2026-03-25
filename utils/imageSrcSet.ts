// utils/imageSrcSet.ts
// J4: Responsive image srcSet/sizes utilities (extracted from imageOptimization.ts)

import { Platform } from 'react-native';
import type { ImageOptimizationOptions, ResponsiveImageSource } from './imageOptimization';
import { optimizeImageUrl, getPreferredImageFormat } from './imageProxy';

function resolveImageFormat(format: ImageOptimizationOptions['format']): string {
  if (format === 'auto') return getPreferredImageFormat();
  return format ?? 'jpg';
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
  const resolvedDpr = options.dpr ?? 1;
  const srcset = sizes
    .map((size) => {
      const optimizedUrl = optimizeImageUrl(baseUrl, {
        width: size,
        format: resolvedFormat,
        quality: options.quality ?? 75,
        fit: options.fit,
        dpr: resolvedDpr,
      });
      return `${optimizedUrl} ${size}w`;
    })
    .join(', ');

  return srcset || baseUrl;
}

export function generateSizes(
  breakpoints: { desktop?: number; tablet?: number; mobile?: number } = {}
): string {
  const desktop = breakpoints.desktop || 1200;
  const tablet = breakpoints.tablet || 768;
  const mobile = breakpoints.mobile || 375;
  return `(min-width: ${desktop}px) ${desktop}px, (min-width: ${tablet}px) ${tablet}px, ${mobile}px`;
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

export function buildResponsiveImage(
  imageUrl: string,
  options: ImageOptimizationOptions & { sizes?: string } = {}
): ResponsiveImageSource {
  if (!imageUrl) return { src: '', format: 'unknown' };

  const format = resolveImageFormat(options.format ?? 'auto') || 'jpg';
  const { src, srcSet, sizes } = buildResponsiveImageProps(imageUrl, {
    maxWidth: typeof window !== 'undefined' ? window.innerWidth || 1440 : 1440,
    sizes: options.sizes,
    quality: options.quality,
    format: options.format,
    fit: options.fit,
    dpr: options.dpr,
  });

  return { src, srcSet, sizes, format };
}

export function buildLqipUrl(
  baseUrl: string,
  options: { width?: number; quality?: number; blur?: number } = {}
): string {
  if (!baseUrl) return baseUrl;
  return optimizeImageUrl(baseUrl, {
    width: options.width ?? 24,
    quality: options.quality ?? 35,
    format: 'jpg',
    fit: 'contain',
    blur: options.blur ?? 30,
  }) || baseUrl;
}

export function generateLQIP(imageUrl: string, width: number = 15): string | undefined {
  if (!imageUrl) return undefined;
  return optimizeImageUrl(imageUrl, { width, quality: 50, format: 'jpg', fit: 'contain', blur: 5 });
}

export function calculateImageDimensions(
  originalWidth: number,
  originalHeight: number,
  constraints: { maxWidth?: number; maxHeight?: number }
): { width: number; height: number } {
  const maxWidth = constraints.maxWidth || originalWidth;
  const maxHeight = constraints.maxHeight || originalHeight;
  const widthRatio = maxWidth / originalWidth;
  const heightRatio = maxHeight / originalHeight;
  const ratio = Math.min(widthRatio, heightRatio, 1);
  return { width: Math.round(originalWidth * ratio), height: Math.round(originalHeight * ratio) };
}

export function createLazyImageProps(
  src: string,
  options: ImageOptimizationOptions = {}
): {
  src: string;
  loading: 'lazy' | 'eager';
  decoding: 'async' | 'sync' | 'auto';
  fetchpriority?: 'high' | 'low' | 'auto';
} {
  const requestedFormat = options.format ?? 'auto';
  const optimizedSrc = optimizeImageUrl(src, { format: requestedFormat, quality: 85, ...options });
  return {
    src: optimizedSrc || src,
    loading: options.width && options.width > 400 ? 'lazy' : 'eager',
    decoding: 'async',
    fetchpriority: options.width && options.width > 800 ? 'low' : 'auto',
  };
}

export function shouldLoadEager(index: number, containerWidth?: number): boolean {
  if (index === 0) return true;
  if (containerWidth && containerWidth < 300) return false;
  return index < 3;
}
