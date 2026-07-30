// __tests__/services/pdf-v2/ImageProcessor.test.ts
// ✅ ТЕСТЫ: ImageProcessor v2

import { ImageProcessor } from '../../../services/pdf-export/generators/v2/processors/ImageProcessor';
import type { ImageProcessorConfig } from '../../../services/pdf-export/generators/v2/types';

describe('ImageProcessor', () => {
  let processor: ImageProcessor;
  let config: ImageProcessorConfig;

  beforeEach(() => {
    config = {
      proxyEnabled: true,
      maxWidth: 1600,
      cacheEnabled: true,
      cacheTTL: 3600000,
    };
    processor = new ImageProcessor(config);
  });

  afterEach(() => {
    processor.clearCache();
  });

  describe('processUrl', () => {
    it('возвращает пустую строку для пустого URL', async () => {
      const result = await processor.processUrl('');
      expect(result).toBe('');
    });

    it('оставляет локальные URL без изменений', async () => {
      const url = '/assets/image.jpg';
      const result = await processor.processUrl(url);
      expect(result).toBe(url);
    });

    it('оставляет data: URL без изменений', async () => {
      const url = 'data:image/png;base64,iVBORw0KGgoAAAANS';
      const result = await processor.processUrl(url);
      expect(result).toBe(url);
    });

    // #1163: чужой URL больше не заворачивается в сторонний ресайзер — он уходит в
    // PDF как есть. Проксируются только первопартийные картинки.
    it('оставляет чужой URL без стороннего прокси', async () => {
      const url = 'https://example.com/image.jpg';
      const result = await processor.processUrl(url);
      expect(result).toBe(url);
    });

    it('проксирует первопартийный URL на печатной ступени лестницы', async () => {
      const result = await processor.processUrl('https://metravel.by/gallery/42/photo.jpg');
      expect(result).toContain('w=1600');
      expect(result).not.toContain('images.weserv.nl');
    });

    it('кэширует обработанные URL', async () => {
      const url = 'https://example.com/image.jpg';
      const result1 = await processor.processUrl(url);
      const result2 = await processor.processUrl(url);
      expect(result1).toBe(result2);
    });
  });

  describe('buildSafeUrl', () => {
    it('возвращает пустую строку для пустого URL', () => {
      expect(processor.buildSafeUrl('')).toBe('');
    });

    it('сохраняет локальные пути', () => {
      const url = '/local/path.jpg';
      expect(processor.buildSafeUrl(url)).toBe(url);
    });

    it('не трогает чужой http URL', () => {
      const url = 'http://example.com/image.jpg';
      expect(processor.buildSafeUrl(url)).toBe(url);
    });

    it('не трогает чужой https URL', () => {
      const url = 'https://example.com/image.jpg';
      expect(processor.buildSafeUrl(url)).toBe(url);
    });

    it('первопартийный URL получает ширину из maxWidth конфига', () => {
      const result = processor.buildSafeUrl('https://cdn.metravel.by/gallery/42/photo.jpg');
      expect(result).toContain('w=1600');
      expect(result).not.toContain('images.weserv.nl');
    });
  });

  describe('preloadImages', () => {
    it('обрабатывает массив URL', async () => {
      const urls = [
        'https://example.com/1.jpg',
        'https://example.com/2.jpg',
        'https://example.com/3.jpg',
      ];

      await processor.preloadImages(urls);

      for (const url of urls) {
        const result = await processor.processUrl(url);
        expect(result).toBeTruthy();
      }
    });

    it('обрабатывает пустой массив', async () => {
      await expect(processor.preloadImages([])).resolves.not.toThrow();
    });
  });

  describe('cache management', () => {
    it('clearCache очищает весь кэш', async () => {
      const url = 'https://example.com/image.jpg';
      await processor.processUrl(url);

      processor.clearCache();

      const result = await processor.processUrl(url);
      expect(result).toBeTruthy();
    });

    it('cleanup удаляет устаревшие записи', async () => {
      const shortTTLConfig = { ...config, cacheTTL: 1 };
      const tempProcessor = new ImageProcessor(shortTTLConfig);

      const url = 'https://example.com/image.jpg';
      await tempProcessor.processUrl(url);

      await new Promise(resolve => setTimeout(resolve, 10));

      tempProcessor.cleanup();

      const result = await tempProcessor.processUrl(url);
      expect(result).toBeTruthy();
    });

  });

  describe('error handling', () => {
    it('обрабатывает некорректные URL', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://example.com/file',
        '   ',
      ];

      for (const url of invalidUrls) {
        const result = processor.buildSafeUrl(url);
        expect(typeof result).toBe('string');
      }
    });
  });
});
