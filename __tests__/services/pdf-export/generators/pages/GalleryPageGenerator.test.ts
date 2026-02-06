// __tests__/services/pdf-export/generators/pages/GalleryPageGenerator.test.ts

import { GalleryPageGenerator } from '@/services/pdf-export/generators/pages';
import { minimalTheme } from '@/services/pdf-export/themes/PdfThemeConfig';

describe('GalleryPageGenerator', () => {
  let generator: GalleryPageGenerator;

  beforeEach(() => {
    generator = new GalleryPageGenerator(minimalTheme);
  });

  const mockPhotos = [
    { url: 'https://example.com/1.jpg', id: 1 },
    { url: 'https://example.com/2.jpg', id: 2 },
    { url: 'https://example.com/3.jpg', id: 3 },
  ];

  describe('generate', () => {
    it('должен генерировать HTML галереи', () => {
      const html = generator.generate('Париж', mockPhotos, 'grid', 10);

      expect(html).toContain('Фотогалерея');
      expect(html).toContain('Париж');
      expect(html).toContain('https://example.com/1.jpg');
      expect(html).toContain('pdf-page');
      expect(html).toContain('gallery-page');
    });

    it('должен отображать все фотографии', () => {
      const html = generator.generate('Париж', mockPhotos, 'grid', 10);

      expect(html).toContain('https://example.com/1.jpg');
      expect(html).toContain('https://example.com/2.jpg');
      expect(html).toContain('https://example.com/3.jpg');
    });

    it('должен отображать номер страницы', () => {
      const html = generator.generate('Париж', mockPhotos, 'grid', 15);

      expect(html).toContain('>15<');
    });

    it('должен экранировать HTML в названии', () => {
      const html = generator.generate('<script>alert("xss")</script>', mockPhotos, 'grid', 10);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('grid layout', () => {
    it('должен использовать grid-template-columns', () => {
      const html = generator.generate('Париж', mockPhotos, 'grid', 10);

      expect(html).toContain('grid-template-columns');
      expect(html).toContain('repeat(3, 1fr)');
    });
  });

  describe('mosaic layout', () => {
    it('должен использовать grid-column для разных размеров', () => {
      const html = generator.generate('Париж', mockPhotos, 'mosaic', 10);

      expect(html).toContain('grid-column');
      expect(html).toContain('span');
    });
  });

  describe('collage layout', () => {
    it('должен использовать absolute positioning', () => {
      const html = generator.generate('Париж', mockPhotos, 'collage', 10);

      expect(html).toContain('position: absolute');
    });
  });

  describe('polaroid layout', () => {
    it('должен использовать transform rotate', () => {
      const html = generator.generate('Париж', mockPhotos, 'polaroid', 10);

      expect(html).toContain('transform: rotate');
    });

    it('должен отображать подписи к фото', () => {
      const photosWithCaptions = [
        { url: 'https://example.com/1.jpg', id: 1, caption: 'Эйфелева башня' },
      ];

      const html = generator.generate('Париж', photosWithCaptions, 'polaroid', 10);

      expect(html).toContain('Эйфелева башня');
    });

    it('должен отображать номер фото если нет подписи', () => {
      const html = generator.generate('Париж', mockPhotos, 'polaroid', 10);

      expect(html).toContain('Фото 1');
    });
  });

  describe('edge cases', () => {
    it('должен работать с пустым списком фото', () => {
      const html = generator.generate('Париж', [], 'grid', 10);

      expect(html).toContain('Фотогалерея');
      expect(html).toContain('Париж');
    });

    it('должен работать с большим количеством фото', () => {
      const manyPhotos = Array.from({ length: 20 }, (_, i) => ({
        url: `https://example.com/${i}.jpg`,
        id: i,
      }));

      const html = generator.generate('Париж', manyPhotos, 'grid', 10);

      expect(html).toContain('https://example.com/0.jpg');
      expect(html).toContain('https://example.com/8.jpg');
    });
  });
});
