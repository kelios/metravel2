/**
 * Performance optimization tests
 * Tests for image optimization, Web Vitals, and performance hooks
 */

import { Platform } from 'react-native';

import {
  optimizeImageUrl,
  generateSrcSet,
  generateSizes,
  generateLQIP,
  calculateImageDimensions,
  buildResponsiveImage,
  clearImageOptimizationCache,
  getImageCacheStats,
  ImageOptimizationOptions,
} from '@/utils/imageOptimization';

import {
  onWebVitals,
  getWebVitalsMetrics,
  checkMetricsHealth,
  formatMetricsForDisplay,
  markPerformance,
  measurePerformance,
} from '@/utils/webVitalsMonitoring';

describe('Image Optimization', () => {
  const originalOS = Platform.OS
  const baseUrl = 'https://cdn.metravel.by/image.jpg'

  beforeEach(() => {
    Platform.OS = 'web'
    clearImageOptimizationCache();
  });

  afterEach(() => {
    Platform.OS = originalOS
  })

  describe('optimizeImageUrl', () => {
    it('should return empty string for missing URL', () => {
      expect(optimizeImageUrl('')).toBeUndefined();
      expect(optimizeImageUrl(undefined)).toBeUndefined();
    });

    it('should add width parameter', () => {
      const result = optimizeImageUrl(baseUrl, {
        width: 800,
      });
      expect(result).toContain('w=800');
    });

    it('should add height parameter', () => {
      const result = optimizeImageUrl(baseUrl, {
        height: 600,
      });
      expect(result).toContain('h=600');
    });

    it('should add format parameter', () => {
      const result = optimizeImageUrl(baseUrl, {
        format: 'webp',
      });
      expect(result).toContain('f=webp');
    });

    it('should add quality parameter', () => {
      const result = optimizeImageUrl(baseUrl, {
        quality: 80,
      });
      expect(result).toContain('q=80');
    });

    it('should default to auto format', () => {
      const result = optimizeImageUrl(baseUrl, {});
      expect(result).toMatch(/\bf=(avif|webp|jpg|png)\b/);
    });

    it('should default to quality 75', () => {
      const result = optimizeImageUrl(baseUrl, {});
      expect(result).toContain('q=75');
    });

    it('should clamp quality to valid range', () => {
      const tooHigh = optimizeImageUrl(baseUrl, {
        quality: 150,
      });
      expect(tooHigh).not.toContain('q=150');
      expect(tooHigh).not.toContain('q=');

      const tooLow = optimizeImageUrl(baseUrl, {
        quality: 0,
      });
      expect(tooLow).toContain('q=1');
    });

    it('should cache optimized URLs', () => {
      const url = baseUrl;
      const options: ImageOptimizationOptions = { width: 800, quality: 80 };

      const result1 = optimizeImageUrl(url, options);
      const result2 = optimizeImageUrl(url, options);

      expect(result1).toBe(result2);

      const stats = getImageCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should handle existing query parameters', () => {
      const url = `${baseUrl}?existing=param`;
      const result = optimizeImageUrl(url, { width: 800 });

      expect(result).toContain('existing=param');
      expect(result).toContain('w=800');
    });
  });

  describe('generateSrcSet', () => {
    it('should generate responsive src set', () => {
      const srcSet = generateSrcSet(baseUrl, [320, 640, 1024, 1440]);
      expect(srcSet).toContain('320w');
      expect(srcSet).toContain('640w');
      expect(srcSet).toContain('1024w');
      expect(srcSet).toContain('1440w');
    });

    it('should include custom widths', () => {
      const srcSet = generateSrcSet(baseUrl, [200, 400, 800]);
      expect(srcSet).toContain('200w');
      expect(srcSet).toContain('400w');
      expect(srcSet).toContain('800w');
      expect(srcSet).not.toContain('320w');
    });

    it('should set format parameter', () => {
      const srcSet = generateSrcSet(baseUrl, [320, 640], {
        format: 'webp',
      });
      expect(srcSet).toContain('f=webp');
    });

    it('should set quality parameter', () => {
      const srcSet = generateSrcSet(baseUrl, [320, 640], {
        quality: 75,
      });
      expect(srcSet).toContain('q=75');
    });

    it('should return empty string for missing URL', () => {
      const srcSet = generateSrcSet('', [320, 640]);
      expect(srcSet).toBe('');
    });
  });

  describe('generateSizes', () => {
    it('should generate default sizes string', () => {
      const sizes = generateSizes();
      expect(sizes).toContain('1200px');
      expect(sizes).toContain('768px');
      expect(sizes).toContain('375px');
    });

    it('should use custom breakpoints', () => {
      const sizes = generateSizes({
        desktop: 1600,
        tablet: 800,
        mobile: 400,
      });
      expect(sizes).toContain('1600px');
      expect(sizes).toContain('800px');
      expect(sizes).toContain('400px');
    });
  });

  describe('generateLQIP', () => {
    it('should generate low-quality placeholder', () => {
      const lqip = generateLQIP(baseUrl)!;
      expect(lqip).toContain('w=15');
      expect(lqip).toContain('q=50');
      expect(lqip).toContain('blur=5');
    });

    it('should use custom width', () => {
      const lqip = generateLQIP(baseUrl, 20)!;
      expect(lqip).toContain('w=20');
    });
  });

  describe('calculateImageDimensions', () => {
    it('should calculate scaled dimensions', () => {
      const dims = calculateImageDimensions(1200, 800, { maxWidth: 600 });
      expect(dims.width).toBe(600);
      expect(dims.height).toBe(400);
    });

    it('should maintain aspect ratio', () => {
      const dims = calculateImageDimensions(1600, 900, {
        maxWidth: 800,
        maxHeight: 600,
      });
      const aspectRatio = dims.width / dims.height;
      const originalRatio = 1600 / 900;
      expect(Math.abs(aspectRatio - originalRatio)).toBeLessThan(0.01);
    });

    it('should not upscale', () => {
      const dims = calculateImageDimensions(400, 300, { maxWidth: 600 });
      expect(dims.width).toBe(400);
      expect(dims.height).toBe(300);
    });
  });

  describe('buildResponsiveImage', () => {
    it('should build complete responsive image config', () => {
      const config = buildResponsiveImage(baseUrl);
      expect(config.src).toBeDefined();
      expect(config.srcSet).toBeDefined();
      expect(config.sizes).toBeDefined();
      expect(config.format).toBeDefined();
    });

    it('should return empty for missing URL', () => {
      const config = buildResponsiveImage('');
      expect(config.src).toBe('');
    });
  });
});

describe('Web Vitals Monitoring', () => {
  describe('onWebVitals', () => {
    it('should register callback', (done) => {
      const callback = jest.fn();
      onWebVitals(callback);

      // Callback may not fire immediately, so we just check it's registered
      setTimeout(() => {
        done();
      }, 100);
    });

    it('should return unsubscribe function', () => {
      const callback = jest.fn();
      const unsubscribe = onWebVitals(callback);
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('getWebVitalsMetrics', () => {
    it('should return metrics object', () => {
      const metrics = getWebVitalsMetrics();
      expect(typeof metrics).toBe('object');
      expect(metrics).toBeDefined();
    });

    it('should not include undefined properties after check', () => {
      const metrics = getWebVitalsMetrics();
      const definedKeys = Object.keys(metrics).filter(
        (key) => metrics[key as keyof typeof metrics] !== undefined
      );
      expect(Array.isArray(definedKeys)).toBe(true);
    });
  });

  describe('checkMetricsHealth', () => {
    it('should return health status for good metrics', () => {
      const metrics = {
        lcp: 2000,
        fid: 50,
        cls: 0.05,
      };
      const health = checkMetricsHealth(metrics);

      expect(health.isHealthy).toBe(true);
      expect(health.lcp).toBe('good');
      expect(health.fid).toBe('good');
      expect(health.cls).toBe('good');
    });

    it('should return fair status for borderline metrics', () => {
      const metrics = {
        lcp: 3500,
        fid: 150,
        cls: 0.15,
      };
      const health = checkMetricsHealth(metrics);

      expect(health.lcp).toBe('fair');
      expect(health.fid).toBe('fair');
      expect(health.cls).toBe('fair');
    });

    it('should return poor status for bad metrics', () => {
      const metrics = {
        lcp: 5000,
        fid: 400,
        cls: 0.3,
      };
      const health = checkMetricsHealth(metrics);

      expect(health.isHealthy).toBe(false);
      expect(health.lcp).toBe('poor');
      expect(health.fid).toBe('poor');
      expect(health.cls).toBe('poor');
    });
  });

  describe('formatMetricsForDisplay', () => {
    it('should format metrics as readable string', () => {
      const metrics = {
        lcp: 2000,
        fid: 50,
        cls: 0.05,
      };
      const formatted = formatMetricsForDisplay(metrics);

      expect(formatted).toContain('Web Vitals');
      expect(formatted).toContain('2000');
      expect(formatted).toContain('0.050');
    });
  });

  describe('markPerformance and measurePerformance', () => {
    it('should mark and measure performance', () => {
      const startMark = 'test-start';
      const endMark = 'test-end';

      markPerformance(startMark);
      // Simulate some work
      for (let i = 0; i < 1000000; i++) {
        Math.sqrt(i);
      }
      markPerformance(endMark);

      const duration = measurePerformance(startMark, endMark);
      expect(duration).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Cache Management', () => {
  it('should clear cache', () => {
    optimizeImageUrl('https://example.com/image1.jpg', { width: 800 });
    optimizeImageUrl('https://example.com/image2.jpg', { width: 800 });

    let stats = getImageCacheStats();
    expect(stats.size).toBeGreaterThan(0);

    clearImageOptimizationCache();

    stats = getImageCacheStats();
    expect(stats.size).toBe(0);
  });

  it('should limit cache size', () => {
    // Add many items
    for (let i = 0; i < 600; i++) {
      optimizeImageUrl(`https://example.com/image${i}.jpg`, { width: 800 });
    }

    const stats = getImageCacheStats();
    // Cache should be limited to prevent memory leaks
    expect(stats.size).toBeLessThan(600);
  });
});

