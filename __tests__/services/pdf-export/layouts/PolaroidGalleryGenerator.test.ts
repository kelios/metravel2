import { PolaroidGalleryGenerator } from '@/services/pdf-export/generators/v2/runtime/legacyGalleryLayouts';
import type { FullGallerySettings, GalleryPhoto } from '@/types/pdf-gallery';

describe('PolaroidGalleryGenerator', () => {
  let generator: PolaroidGalleryGenerator;
  let photos: GalleryPhoto[];
  let settings: FullGallerySettings;

  beforeEach(() => {
    generator = new PolaroidGalleryGenerator();
    photos = [
      { id: 1, url: 'https://example.com/1.jpg', caption: { text: 'First', location: 'Minsk', showMetadata: false, position: 'bottom' } },
      { id: 2, url: 'https://example.com/2.jpg' },
    ];
    settings = {
      layout: 'polaroid',
      showCaptions: true,
      captionPosition: 'bottom',
      spacing: 'normal',
      polaroid: {
        frameColor: '#ffffff',
        frameWidth: 20,
        rotation: 3,
        shadow: true,
        showCaption: true,
        captionFont: 'handwritten',
      },
    };
  });

  it('generates polaroid wrapper and cards', () => {
    const html = generator.generateHTML(photos, settings);
    expect(html).toContain('gallery-polaroid');
    expect(html).toContain('class="polaroid"');
    expect(html).toContain('https://example.com/1.jpg');
  });

  it('applies deterministic rotation pattern', () => {
    const html = generator.generateHTML(photos, settings);
    expect(html).toContain('transform: rotate(-3deg)');
    expect(html).toContain('transform: rotate(2.0999999999999996deg)');
  });

  it('renders caption and location when enabled', () => {
    const html = generator.generateHTML(photos, settings);
    expect(html).toContain('First');
    expect(html).toContain('Minsk');
    expect(html).toContain('Comic Sans MS');
  });

  it('uses spacious gap preset', () => {
    const html = generator.generateHTML(photos, { ...settings, spacing: 'spacious' });
    expect(html).toContain('gap: 40px');
  });
});
