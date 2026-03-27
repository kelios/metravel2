import { GalleryLayoutFactory } from '@/services/pdf-export/generators/v2/runtime/legacyGalleryLayouts';
import type { FullGallerySettings, GalleryPhoto } from '@/types/pdf-gallery';

describe('GalleryLayoutFactory', () => {
  const photos: GalleryPhoto[] = [
    {
      id: 1,
      url: 'https://example.com/1.jpg',
      caption: { text: 'Slide', location: 'Paris', date: '2024', showMetadata: true, position: 'bottom' },
      exif: { camera: 'Canon EOS R5', aperture: '2.8', iso: '100' },
    },
  ];

  it('returns empty placeholder for empty input', () => {
    const html = GalleryLayoutFactory.generateGallery([], {
      layout: 'grid',
      showCaptions: true,
      captionPosition: 'bottom',
      spacing: 'normal',
    } as FullGallerySettings);
    expect(html).toContain('gallery-empty');
  });

  it('delegates grid layout to grid generator', () => {
    const html = GalleryLayoutFactory.generateGallery(photos, {
      layout: 'grid',
      columns: 2,
      showCaptions: true,
      captionPosition: 'bottom',
      spacing: 'normal',
    } as FullGallerySettings);
    expect(html).toContain('gallery-grid');
    expect(html).toContain('grid-template-columns: repeat(2, 1fr)');
  });

  it('supports slideshow rendering with metadata', () => {
    const html = GalleryLayoutFactory.generateGallery(photos, {
      layout: 'slideshow',
      showCaptions: true,
      captionPosition: 'bottom',
      spacing: 'normal',
      slideshow: {
        photoSize: 'medium',
        showCaption: true,
        showMetadata: true,
        backgroundColor: '#ffffff',
        textColor: '#111111',
      },
    } as FullGallerySettings);
    expect(html).toContain('slideshow-page');
    expect(html).toContain('max-width: 70%');
    expect(html).toContain('Canon EOS R5');
    expect(html).toContain('ISO 100');
  });
});
