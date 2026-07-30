/**
 * Утилиты для оптимизации изображений — barrel re-export
 * J4: Split into imageProxy.ts (URL/proxy/format) + imageSrcSet.ts (responsive/srcSet)
 */

export type {
  ImageOptimizationOptions,
} from './imageProxy';

export type { ResponsiveImageSource } from './imageSrcSet';

// Proxy / URL building / format detection
export {
  optimizeImageUrl,
  buildVersionedImageUrl,
  getPreferredImageFormat,
  getOptimalImageWidth,
} from './imageProxy';

// Responsive srcSet / sizes
// #1171: `getResponsiveSizes` отсюда убран — он вызывается только внутри
// `imageSrcSet.ts` как дефолт для `buildResponsiveImageProps`. Публичной точкой
// входа остаётся сам `buildResponsiveImageProps`, чтобы список ширин не начали
// собирать в вызывающем коде в обход лестницы прокси.
export {
  generateSrcSet,
  buildResponsiveImageProps,
} from './imageSrcSet';
