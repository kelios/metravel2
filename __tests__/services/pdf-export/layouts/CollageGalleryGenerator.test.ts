import { CollageGalleryGenerator } from '@/services/pdf-export/generators/v2/runtime/legacyGalleryLayouts';
import type { FullGallerySettings, GalleryPhoto } from '@/types/pdf-gallery';

describe('CollageGalleryGenerator', () => {
  let generator: CollageGalleryGenerator;
  let photos: GalleryPhoto[];
  let settings: FullGallerySettings;

  beforeEach(() => {
    generator = new CollageGalleryGenerator();
    photos = [
      { id: 1, url: 'https://example.com/1.jpg', caption: { text: 'Hero', showMetadata: false, position: 'overlay' } },
      { id: 2, url: 'https://example.com/2.jpg' },
      { id: 3, url: 'https://example.com/3.jpg' },
      { id: 4, url: 'https://example.com/4.jpg' },
      { id: 5, url: 'https://example.com/5.jpg' },
    ];
    settings = {
      layout: 'collage',
      showCaptions: true,
      captionPosition: 'overlay',
      spacing: 'compact',
      collage: {
        template: 'magazine',
        gap: 12,
        borderRadius: 8,
        shadow: true,
      },
    };
  });

  it('generates collage wrapper and image urls', () => {
    const html = generator.generateHTML(photos, settings);
    expect(html).toContain('gallery-collage');
    expect(html).toContain('https://example.com/1.jpg');
    expect(html).toContain('https://example.com/5.jpg');
  });

  it('switches to symmetric template for two photos', () => {
    const html = generator.generateHTML(photos.slice(0, 2), settings);
    expect(html).toContain('display: flex; flex-direction: column;');
    expect(html).toContain('calc((100% - 12px) / 2)');
  });

  it('supports magazine layout with grid areas', () => {
    const html = generator.generateHTML(photos, settings);
    expect(html).toContain('grid-template-columns: 2fr 1fr');
    expect(html).toContain('grid-area: 1 / 1 / 3 / 2;');
  });

  it('renders overlay captions when enabled', () => {
    const html = generator.generateHTML(photos, settings);
    expect(html).toContain('Hero');
    expect(html).toContain('position: absolute');
    expect(html).toContain('linear-gradient');
  });
});
