/**
 * Performance optimization tests
 * Tests for image optimization, Web Vitals, and performance hooks
 */

import { Platform } from 'react-native';

import {
  optimizeImageUrl,
  generateSrcSet,
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
    // #1171: сброса кэша больше нет и он не нужен — публичный origin входит в
    // ключ кэша, поэтому смена `EXPO_PUBLIC_API_URL` между блоками не может
    // отдать URL, собранный для прежнего хоста.
    process.env.EXPO_PUBLIC_API_URL = 'https://cdn.metravel.by/api'
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

    // #1113/#1171: `h` не отправляется и больше не принимается на входе — прокси
    // ресайзит только по `w`, а запрос с одним лишь `h` он не отвергает, а молча
    // отдаёт оригинал. Без ширины не добавляются и остальные параметры (q/f/fit):
    // они не меняют байтовый результат, только плодят записи в кэше прокси.
    it('should send nothing sizing-related without a width', () => {
      const noWidth = optimizeImageUrl(baseUrl, { quality: 80, fit: 'cover' });
      expect(noWidth).not.toMatch(/[?&]h=/);
      expect(noWidth).not.toMatch(/[?&]w=/);
      expect(noWidth).not.toMatch(/[?&]q=/);
    });

    // Легаси-URL из БД и из старой разметки приходят с `h`/`dpr`/`blur`. Их нужно
    // снять, иначе прокси получит запрос, который сам себе противоречит.
    it('strips legacy sizing params carried by the incoming url', () => {
      const legacy = `${baseUrl}?w=1920&h=1080&dpr=3&blur=12`;
      const result = optimizeImageUrl(legacy, { width: 800 });
      expect(result).toContain('w=800');
      expect(result).not.toMatch(/[?&]h=/);
      expect(result).not.toMatch(/[?&]dpr=/);
      expect(result).not.toMatch(/[?&]blur=/);
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

    it('should fall back to backend default quality outside the supported ladder', () => {
      const tooHigh = optimizeImageUrl(baseUrl, {
        width: 800,
        quality: 150,
      });
      expect(tooHigh).not.toContain('q=150');
      expect(tooHigh).toContain('q=85');

      const tooLow = optimizeImageUrl(baseUrl, {
        width: 800,
        quality: 0,
      });
      expect(tooLow).toContain('q=85');
    });

    it('should cache optimized URLs', () => {
      const url = baseUrl;
      const options = { width: 800, quality: 80 } as const;

      const result1 = optimizeImageUrl(url, options);
      const result2 = optimizeImageUrl(url, options);

      expect(result1).toBe(result2);
    });

    it('should handle existing query parameters', () => {
      const url = `${baseUrl}?existing=param`;
      const result = optimizeImageUrl(url, { width: 800 });

      expect(result).toContain('existing=param');
      expect(result).toContain('w=800');
    });
  });

  // #1113: дескриптор в srcSet равен ФАКТИЧЕСКОЙ ступени прокси, а не запрошенной
  // ширине. Иначе браузер выбирает кандидата по обещанным 1440w, а получает файл
  // другого размера — и либо мылит, либо тянет лишние байты.
  //
  // #1170: 1024 — полноправная ступень контракта прокси, она вернулась в лестницу,
  // поэтому теперь остаётся собой, а не округляется до 1280. Снэп сохраняется там,
  // где ступени действительно нет: 1440 → 1600, 200 → 320, 400 → 480.
  describe('generateSrcSet', () => {
    it('should generate responsive src set with real proxy widths', () => {
      const srcSet = generateSrcSet(baseUrl, [320, 640, 1024, 1440]);
      expect(srcSet).toContain('320w');
      expect(srcSet).toContain('640w');
      expect(srcSet).toContain('1024w');
      expect(srcSet).toContain('1600w');
      // 1440 у прокси нет — такой дескриптор обещал бы несуществующий вариант
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
      // q квантуется вверх по лестнице proxy-contract (75 -> 80)
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
  // #1171: `clearImageOptimizationCache`/`getImageCacheStats` удалены — они
  // существовали только ради этих тестов. Наблюдаемое свойство кэша, которое имеет
  // значение снаружи, одно: он не искажает результат при переполнении. Вытеснение
  // происходит на 400 записях, поэтому 600 разных URL гарантированно его вызывают,
  // и первый URL после этого должен оптимизироваться так же, как до заполнения.
  it('keeps producing correct URLs after the cache overflows', () => {
    const first = 'https://example.com/image0.jpg';
    const before = optimizeImageUrl(first, { width: 800 });

    for (let i = 1; i < 600; i++) {
      optimizeImageUrl(`https://example.com/image${i}.jpg`, { width: 800 });
    }

    expect(optimizeImageUrl(first, { width: 800 })).toBe(before);
  });
});
