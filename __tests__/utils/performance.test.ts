/**
 * Performance optimization tests
 * Tests for image optimization, Web Vitals, and performance hooks
 */

import { Platform } from 'react-native';

import {
  optimizeImageUrl,
  generateSrcSet,
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
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL
  const baseUrl = 'https://cdn.metravel.by/image.jpg'

  beforeEach(() => {
    Platform.OS = 'web'
    process.env.EXPO_PUBLIC_API_URL = 'https://cdn.metravel.by/api'
    clearImageOptimizationCache();
  });

  afterEach(() => {
    Platform.OS = originalOS
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl
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

    // #1113: `h` больше не отправляется — прокси ресайзит только по `w`, а запрос
    // с одним лишь `h` он не отвергает, а молча отдаёт оригинал. Раз размерных
    // параметров нет, остальные (q/f/fit) тоже не добавляются: они не меняют
    // байтовый результат, а только плодят записи в кэше прокси.
    it('should not send height, and should send nothing sizing-related without a width', () => {
      const heightOnly = optimizeImageUrl(baseUrl, { height: 600 });
      expect(heightOnly).not.toMatch(/[?&]h=/);
      expect(heightOnly).not.toMatch(/[?&]w=/);
      expect(heightOnly).not.toMatch(/[?&]q=/);

      const withWidth = optimizeImageUrl(baseUrl, { width: 800, height: 600 });
      expect(withWidth).toContain('w=800');
      expect(withWidth).not.toMatch(/[?&]h=/);
    });

    it('should add format parameter', () => {
      const result = optimizeImageUrl(baseUrl, {
        width: 800,
        format: 'webp',
      });
      expect(result).toContain('f=webp');
    });

    it('should add quality parameter', () => {
      const result = optimizeImageUrl(baseUrl, {
        width: 800,
        quality: 80,
      });
      expect(result).toContain('q=80');
    });

    it('should default to auto format', () => {
      const result = optimizeImageUrl(baseUrl, { width: 800 });
      // With format='auto', no 'f=' parameter is added (server decides format)
      expect(result).not.toContain('f=auto');
    });

    it('should default to quality 75', () => {
      const result = optimizeImageUrl(baseUrl, { width: 800 });
      // On web platform, default quality is 80; on native it's 75
      expect(result).toMatch(/q=(75|80)/);
    });

    it('should clamp quality to valid range', () => {
      const tooHigh = optimizeImageUrl(baseUrl, {
        width: 800,
        quality: 150,
      });
      expect(tooHigh).not.toContain('q=150');
      expect(tooHigh).toContain('q=100'); // clamped to 100

      const tooLow = optimizeImageUrl(baseUrl, {
        width: 800,
        quality: 0,
      });
      expect(tooLow).toContain('q=1'); // clamped to 1
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

  // #1113: дескриптор в srcSet равен ФАКТИЧЕСКОЙ ступени прокси, а не запрошенной
  // ширине. Иначе браузер выбирает кандидата по обещанным 1024w, а получает файл
  // другого размера — и либо мылит, либо тянет лишние байты. Запрошенные значения
  // снэпятся по DIMENSION_LADDER: 1024 → 1280, 1440 → 1600, 200 → 320, 400 → 480.
  describe('generateSrcSet', () => {
    it('should generate responsive src set with real proxy widths', () => {
      const srcSet = generateSrcSet(baseUrl, [320, 640, 1024, 1440]);
      expect(srcSet).toContain('320w');
      expect(srcSet).toContain('640w');
      expect(srcSet).toContain('1280w');
      expect(srcSet).toContain('1600w');
      // 1024 и 1440 прокси не ресайзит — такие дескрипторы обещали бы несуществующий вариант
      expect(srcSet).not.toContain('1024w');
      expect(srcSet).not.toContain('1440w');
    });

    it('should snap custom widths up to the nearest supported rung', () => {
      const srcSet = generateSrcSet(baseUrl, [200, 400, 800]);
      expect(srcSet).toContain('320w');
      expect(srcSet).toContain('480w');
      expect(srcSet).toContain('800w');
      expect(srcSet).not.toContain('200w');
      expect(srcSet).not.toContain('400w');
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
      // q квантуется к шагу 10 (75 -> 80), см. imageProxy snapQuality
      expect(srcSet).toContain('q=80');
    });

    it('should return empty string for missing URL', () => {
      const srcSet = generateSrcSet('', [320, 640]);
      expect(srcSet).toBe('');
    });
  });

  // #1118: тесты `generateSizes`, `generateLQIP`, `calculateImageDimensions` и
  // `buildResponsiveImage` удалены вместе с самими функциями — ни одна из них не
  // вызывалась в приложении, а LQIP-хелперы вдобавок просили ширины (15/24),
  // которых нет в whitelist прокси, то есть вернули бы оригинал. Живой LQIP
  // приходит из backend-манифеста через `getMediaLqipUrl`.
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

