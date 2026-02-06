// __tests__/services/pdf-export/generators/v1/V1GalleryRenderer.test.ts

import { V1GalleryRenderer } from '@/services/pdf-export/generators/v1/V1GalleryRenderer';
import { minimalTheme } from '@/services/pdf-export/themes/PdfThemeConfig';
import type { TravelForBook } from '@/types/pdf-export';

const makeTravel = (gallery: Array<string | { url: string }> = []): TravelForBook =>
  ({
    id: 1,
    name: 'Тестовое путешествие',
    gallery,
  } as unknown as TravelForBook);

describe('V1GalleryRenderer', () => {
  let renderer: V1GalleryRenderer;

  beforeEach(() => {
    renderer = new V1GalleryRenderer({ theme: minimalTheme });
  });

  it('должен возвращать пустой массив если галерея пуста', () => {
    const pages = renderer.renderPages(makeTravel([]), 1);
    expect(pages).toEqual([]);
  });

  it('должен возвращать пустой массив если нет фото', () => {
    const pages = renderer.renderPages(makeTravel(), 1);
    expect(pages).toEqual([]);
  });

  it('должен генерировать страницу для одного фото', () => {
    const pages = renderer.renderPages(
      makeTravel(['https://example.com/photo1.jpg']),
      5
    );

    expect(pages).toHaveLength(1);
    expect(pages[0]).toContain('gallery-page');
    expect(pages[0]).toContain('Фотогалерея');
    expect(pages[0]).toContain('Тестовое путешествие');
  });

  it('должен генерировать страницу для нескольких фото', () => {
    const photos = [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
      'https://example.com/photo3.jpg',
    ];
    const pages = renderer.renderPages(makeTravel(photos), 5);

    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages[0]).toContain('gallery-page');
  });

  it('должен поддерживать объекты {url} в галерее', () => {
    const photos = [
      { url: 'https://example.com/photo1.jpg' },
      { url: 'https://example.com/photo2.jpg' },
    ];
    const pages = renderer.renderPages(makeTravel(photos), 5);

    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages[0]).toContain('gallery-page');
  });

  it('должен фильтровать пустые URL', () => {
    const photos = ['https://example.com/photo1.jpg', '', '   '];
    const pages = renderer.renderPages(makeTravel(photos), 5);

    expect(pages).toHaveLength(1);
    expect(pages[0]).toContain('photo1.jpg');
  });

  it('должен содержать running header', () => {
    const pages = renderer.renderPages(
      makeTravel(['https://example.com/photo1.jpg']),
      7
    );

    expect(pages[0]).toContain('>7<');
  });

  it('renderSinglePage должен возвращать первую страницу', () => {
    const html = renderer.renderSinglePage(
      makeTravel(['https://example.com/photo1.jpg']),
      5
    );

    expect(html).toContain('gallery-page');
  });

  it('renderSinglePage должен возвращать пустую строку если нет фото', () => {
    const html = renderer.renderSinglePage(makeTravel([]), 5);

    expect(html).toBe('');
  });

  it('должен использовать slideshow layout с настройками', () => {
    const slideshowRenderer = new V1GalleryRenderer({
      theme: minimalTheme,
      settings: { galleryLayout: 'slideshow' } as any,
    });

    const photos = [
      'https://example.com/photo1.jpg',
      'https://example.com/photo2.jpg',
    ];
    const pages = slideshowRenderer.renderPages(makeTravel(photos), 1);

    // slideshow = 1 photo per page
    expect(pages).toHaveLength(2);
  });
});
