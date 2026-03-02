/**
 * Утилиты для оптимизации изображений — barrel re-export
 * J4: Split into imageProxy.ts (URL/proxy/format) + imageSrcSet.ts (responsive/srcSet)
 */

export type {
  ImageOptimizationOptions,
} from './imageProxy';

export interface ResponsiveImageSource {
  src: string;
  srcSet?: string;
  sizes?: string;
  format: string;
}

// Proxy / URL building / format detection
export {
  optimizeImageUrl,
  buildVersionedImageUrl,
  getPreferredImageFormat,
  getOptimalImageSize,
  clearImageOptimizationCache,
  getImageCacheStats,
} from './imageProxy';

// Responsive srcSet / sizes / LQIP / lazy
export {
  generateSrcSet,
  generateSizes,
  getResponsiveSizes,
  buildResponsiveImageProps,
  buildResponsiveImage,
  buildLqipUrl,
  generateLQIP,
  calculateImageDimensions,
  createLazyImageProps,
  shouldLoadEager,
} from './imageSrcSet';
