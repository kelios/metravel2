/**
 * Advanced Image Optimization Module
 * Handles WebP, LQIP, lazy loading, caching
 * ⚠️ PERFORMANCE: Critical for LCP optimization
 */

/**
 * Image optimization options
 */
export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'auto';
  quality?: number; // 1-100
  fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside';
  position?: string; // gravity: center, top, bottom, etc
  blur?: number; // blur radius (1-100)
  compress?: boolean; // Use lossy compression
}

/**
 * Image source information for responsive images
 */
export interface ResponsiveImageSource {
  src: string;
  srcSet?: string;
  sizes?: string;
  format: string;
}

/**
 * Cache for optimized image URLs to prevent redundant processing
 */
const optimizedUrlCache = new Map<string, string>();
const MAX_CACHE_SIZE = 500; // Prevent memory leaks

/**
 * Optimize image URL with Cloudinary/imgix-like parameters
 * Compatible with metravel CDN
 *
 * @param imageUrl - Original image URL
 * @param options - Optimization options
 * @returns Optimized URL or original if optimization fails
 *
 * @example
 * optimizeImageUrl('https://cdn.metravel.by/image.jpg', {
 *   width: 800,
 *   height: 600,
 *   format: 'webp',
 *   quality: 80,
 *   fit: 'cover'
 * })
 */
export function optimizeImageUrl(
  imageUrl: string | undefined,
  options: ImageOptimizationOptions = {}
): string {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return '';
  }

  // Check cache first
  const cacheKey = `${imageUrl}:${JSON.stringify(options)}`;
  if (optimizedUrlCache.has(cacheKey)) {
    return optimizedUrlCache.get(cacheKey) || '';
  }

  try {
    const url = new URL(imageUrl);
    const params = new URLSearchParams(url.search);

    // Remove previous optimization params to avoid duplication
    const optParams = ['w', 'h', 'f', 'q', 'fit', 'pos', 'blur', 'compress'];
    optParams.forEach(p => params.delete(p));

    // Add width
    if (options.width) {
      params.set('w', String(options.width));
    }

    // Add height
    if (options.height) {
      params.set('h', String(options.height));
    }

    // Add format (WebP preferred for modern browsers)
    if (options.format) {
      params.set('f', options.format);
    } else {
      // Default to auto-format (lets CDN choose best format)
      params.set('f', 'auto');
    }

    // Add quality (1-100) with clamping even for 0
    if (typeof options.quality === 'number') {
      const q = Math.max(1, Math.min(100, options.quality));
      params.set('q', String(q));
    } else {
      // Default quality: 85 for production
      params.set('q', '85');
    }

    // Add fit mode
    if (options.fit) {
      params.set('fit', options.fit);
    }

    // Add position/gravity for cropping
    if (options.position) {
      params.set('pos', options.position);
    }

    // Add blur radius if specified
    if (options.blur && options.blur > 0) {
      params.set('blur', String(Math.min(100, options.blur)));
    }

    // Add compression flag
    if (options.compress) {
      params.set('compress', '1');
    }

    // Build final URL
    url.search = params.toString();
    const optimized = url.toString();

    // Cache the result (with size limit to prevent memory leaks)
    if (optimizedUrlCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entries (FIFO)
      const keysToDelete = Array.from(optimizedUrlCache.keys()).slice(0, 100);
      keysToDelete.forEach(k => optimizedUrlCache.delete(k));
    }
    optimizedUrlCache.set(cacheKey, optimized);

    return optimized;
  } catch (error) {
    console.warn('[optimizeImageUrl] Failed to optimize:', { imageUrl, error });
    return imageUrl;
  }
}

/**
 * Generate srcSet for responsive images
 * Creates multiple versions for different device widths
 *
 * @example
 * generateSrcSet('image.jpg', {
 *   widths: [320, 640, 1024, 1440],
 *   format: 'webp'
 * })
 * // Returns: "image.jpg?w=320 320w, image.jpg?w=640 640w, ..."
 */
export function generateSrcSet(
  imageUrl: string,
  options: {
    widths?: number[];
    format?: string;
    quality?: number;
  } = {}
): string {
  if (!imageUrl) return '';

  const widths = options.widths || [320, 640, 1024, 1440];
  const format = options.format || 'auto';
  const quality = options.quality || 85;

  return widths
    .map(width => {
      const optimized = optimizeImageUrl(imageUrl, {
        width,
        format: format as any,
        quality,
        fit: 'contain',
      });
      return `${optimized} ${width}w`;
    })
    .join(', ');
}

/**
 * Generate sizes string for responsive images
 * Used in img.sizes attribute
 *
 * @example
 * generateSizes({ desktop: 1200, tablet: 768, mobile: 375 })
 * // Returns: "(min-width: 1200px) 1200px, (min-width: 768px) 768px, 375px"
 */
export function generateSizes(
  breakpoints: {
    desktop?: number;
    tablet?: number;
    mobile?: number;
  } = {}
): string {
  const desktop = breakpoints.desktop || 1200;
  const tablet = breakpoints.tablet || 768;
  const mobile = breakpoints.mobile || 375;

  return `(min-width: ${desktop}px) ${desktop}px, (min-width: ${tablet}px) ${tablet}px, ${mobile}px`;
}

/**
 * Generate LQIP (Low Quality Image Placeholder)
 * Creates a very small, blurred version for loading state
 *
 * @param imageUrl - Original image URL
 * @param width - LQIP width (typically 10-20px)
 * @returns URL to tiny blurred image
 *
 * @example
 * const lqip = generateLQIP(imageUrl, 15);
 * // Use in <img src={lqip} /> with blur() CSS filter
 */
export function generateLQIP(
  imageUrl: string,
  width: number = 15
): string {
  return optimizeImageUrl(imageUrl, {
    width,
    quality: 50,
    format: 'jpeg',
    fit: 'contain',
    blur: 5,
  });
}

/**
 * Generate progressive JPEG fallback
 * For browsers that don't support WebP
 *
 * @param imageUrl - Original image URL
 * @param options - Optimization options
 * @returns URL to progressive JPEG
 */
export function generateProgressiveJPEG(
  imageUrl: string,
  options: ImageOptimizationOptions = {}
): string {
  return optimizeImageUrl(imageUrl, {
    ...options,
    format: 'jpeg',
  });
}

/**
 * Detect device capabilities for optimal image serving
 * Returns recommended format and quality based on device/network
 */
export interface DeviceCapabilities {
  supportsWebP: boolean;
  isDarkMode: boolean;
  isRetina: boolean; // High DPR device
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
  maxWidth: number; // viewport width
}

/**
 * Get device capabilities for image optimization
 *
 * @example
 * const caps = getDeviceCapabilities();
 * const optimized = optimizeImageUrl(url, {
 *   width: caps.maxWidth,
 *   format: caps.supportsWebP ? 'webp' : 'jpeg',
 *   quality: caps.effectiveType === '4g' ? 85 : 70
 * })
 */
export function getDeviceCapabilities(): DeviceCapabilities {
  // WebP support detection
  const supportsWebP = (() => {
    if (typeof document === 'undefined') return true; // SSR default
    const canvas = document.createElement('canvas');
    if (canvas.getContext && canvas.getContext('2d')) {
      return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
    }
    return false;
  })();

  // Dark mode detection
  const isDarkMode =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;

  // High DPI detection
  const isRetina =
    typeof window !== 'undefined' && (window.devicePixelRatio || 1) >= 2;

  // Network type detection
  const effectiveType = (() => {
    if (typeof navigator === 'undefined') return '4g';
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    return connection?.effectiveType || '4g';
  })();

  // Viewport width
  const maxWidth =
    typeof window !== 'undefined' ? window.innerWidth || 1440 : 1440;

  return {
    supportsWebP,
    isDarkMode,
    isRetina,
    effectiveType,
    maxWidth,
  };
}

/**
 * Build complete responsive image configuration
 * Returns object with src, srcSet, sizes for <img> tag
 *
 * @example
 * const img = buildResponsiveImage('image.jpg');
 * <img {...img} alt="description" />
 */
export function buildResponsiveImage(
  imageUrl: string,
  options: ImageOptimizationOptions & { sizes?: string } = {}
): ResponsiveImageSource {
  if (!imageUrl) {
    return {
      src: '',
      format: 'unknown',
    };
  }

  const capabilities = getDeviceCapabilities();
  const format = capabilities.supportsWebP ? 'webp' : 'jpeg';

  const src = optimizeImageUrl(imageUrl, {
    width: capabilities.maxWidth,
    format: format as any,
    quality: options.quality || 85,
    ...options,
  });

  const srcSet = generateSrcSet(imageUrl, {
    format,
    quality: options.quality || 85,
  });

  const sizes = options.sizes || generateSizes();

  return {
    src,
    srcSet,
    sizes,
    format,
  };
}

/**
 * Clear image optimization cache
 * Useful for testing or memory cleanup
 */
export function clearImageOptimizationCache(): void {
  optimizedUrlCache.clear();
}

/**
 * Get cache statistics for debugging
 */
export function getImageCacheStats(): {
  size: number;
  entries: number;
} {
  return {
    size: optimizedUrlCache.size,
    entries: optimizedUrlCache.size,
  };
}

/**
 * Preload image to ensure it's cached before display
 * Useful for hero images and critical images
 *
 * @example
 * preloadImage('image.jpg', { width: 1440, format: 'webp' });
 */
export function preloadImage(
  imageUrl: string,
  options: ImageOptimizationOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      resolve(); // SSR - skip preload
      return;
    }

    const optimized = optimizeImageUrl(imageUrl, options);

    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to preload image: ${optimized}`));
    img.src = optimized;

    // Timeout after 10 seconds
    const timeout = setTimeout(
      () => reject(new Error('Image preload timeout')),
      10000
    );
    img.addEventListener('load', () => clearTimeout(timeout));
    img.addEventListener('error', () => clearTimeout(timeout));
  });
}

/**
 * Calculate optimal image dimensions based on aspect ratio
 *
 * @example
 * const dims = calculateImageDimensions(1200, 800, { maxWidth: 600 });
 * // Returns: { width: 600, height: 400 }
 */
export function calculateImageDimensions(
  originalWidth: number,
  originalHeight: number,
  constraints: { maxWidth?: number; maxHeight?: number }
): { width: number; height: number } {
  const maxWidth = constraints.maxWidth || originalWidth;
  const maxHeight = constraints.maxHeight || originalHeight;

  const widthRatio = maxWidth / originalWidth;
  const heightRatio = maxHeight / originalHeight;
  const ratio = Math.min(widthRatio, heightRatio, 1); // Don't upscale

  return {
    width: Math.round(originalWidth * ratio),
    height: Math.round(originalHeight * ratio),
  };
}

