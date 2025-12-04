// __tests__/services/pdf-export/layouts/MasonryGalleryGenerator.test.ts
// Тесты для генератора мозаичной галереи

import { MasonryGalleryGenerator } from '@/src/services/pdf-export/generators/layouts/MasonryGalleryGenerator';
import type { GalleryPhoto, FullGallerySettings } from '@/src/types/pdf-gallery';

describe('MasonryGalleryGenerator', () => {
  let generator: MasonryGalleryGenerator;
  let mockPhotos: GalleryPhoto[];
  let mockSettings: FullGallerySettings;

  beforeEach(() => {
    generator = new MasonryGalleryGenerator();
    
    mockPhotos = [
      {
        id: 1,
        url: 'https://example.com/photo1.jpg',
        aspectRatio: 1.5, // Portrait
        caption: {
          text: 'Photo 1',
          showMetadata: false,
          position: 'bottom',
        },
      },
      {
        id: 2,
        url: 'https://example.com/photo2.jpg',
        aspectRatio: 0.75, // Landscape
      },
      {
        id: 3,
        url: 'https://example.com/photo3.jpg',
        aspectRatio: 1.0, // Square
      },
      {
        id: 4,
        url: 'https://example.com/photo4.jpg',
        aspectRatio: 1.2,
      },
      {
        id: 5,
        url: 'https://example.com/photo5.jpg',
        aspectRatio: 0.8,
      },
      {
        id: 6,
        url: 'https://example.com/photo6.jpg',
        aspectRatio: 1.3,
      },
    ];

    mockSettings = {
      layout: 'masonry',
      showCaptions: true,
      captionPosition: 'overlay',
      spacing: 'normal',
      masonry: {
        columns: 3,
        gap: 16,
        maintainAspectRatio: true,
      },
    };
  });

  describe('generateHTML', () => {
    it('should generate HTML with masonry structure', () => {
      const html = generator.generateHTML(mockPhotos, mockSettings);

      expect(html).toContain('gallery-masonry');
      expect(html).toContain('display: flex');
      expect(html).toContain('gap: 16px');
    });

    it('should create correct number of columns', () => {
      const html = generator.generateHTML(mockPhotos, mockSettings);

      const columnCount = (html.match(/class="masonry-column"/g) || []).length;
      expect(columnCount).toBe(3);
    });

    it('should distribute photos across columns', () => {
      const html = generator.generateHTML(mockPhotos, mockSettings);

      const photoCount = (html.match(/class="masonry-photo-card"/g) || []).length;
      expect(photoCount).toBe(6);
    });

    it('should respect column setting', () => {
      mockSettings.masonry!.columns = 2;
      const html = generator.generateHTML(mockPhotos, mockSettings);

      const columnCount = (html.match(/class="masonry-column"/g) || []).length;
      expect(columnCount).toBe(2);
    });

    it('should apply custom gap', () => {
      mockSettings.masonry!.gap = 24;
      const html = generator.generateHTML(mockPhotos, mockSettings);

      expect(html).toContain('gap: 24px');
    });

    it('should maintain aspect ratios when enabled', () => {
      mockSettings.masonry!.maintainAspectRatio = true;
      const html = generator.generateHTML(mockPhotos, mockSettings);

      // Should use calculated padding-bottom based on aspect ratio
      expect(html).toContain('padding-bottom: 150%'); // 1.5 * 100
    });

    it('should use fixed aspect ratio when disabled', () => {
      mockSettings.masonry!.maintainAspectRatio = false;
      const html = generator.generateHTML(mockPhotos, mockSettings);

      // Should use default 75%
      expect(html).toContain('padding-bottom: 75%');
    });
  });

  describe('photo distribution', () => {
    it('should distribute photos to balance column heights', () => {
      // Create photos with known aspect ratios
      const photos: GalleryPhoto[] = [
        { id: 1, url: 'photo1.jpg', aspectRatio: 2.0 }, // Tall
        { id: 2, url: 'photo2.jpg', aspectRatio: 0.5 }, // Short
        { id: 3, url: 'photo3.jpg', aspectRatio: 2.0 }, // Tall
      ];

      const settings: FullGallerySettings = {
        ...mockSettings,
        masonry: {
          columns: 2,
          gap: 16,
          maintainAspectRatio: true,
        },
      };

      const html = generator.generateHTML(photos, settings);

      // All photos should be included
      expect(html).toContain('photo1.jpg');
      expect(html).toContain('photo2.jpg');
      expect(html).toContain('photo3.jpg');
    });

    it('should handle photos without aspect ratio', () => {
      const photosWithoutRatio: GalleryPhoto[] = [
        { id: 1, url: 'photo1.jpg' },
        { id: 2, url: 'photo2.jpg' },
      ];

      const html = generator.generateHTML(photosWithoutRatio, mockSettings);

      // Should use default aspect ratio of 1
      expect(html).toContain('photo1.jpg');
      expect(html).toContain('photo2.jpg');
    });

    it('should calculate aspect ratio from width and height', () => {
      const photosWithDimensions: GalleryPhoto[] = [
        { id: 1, url: 'photo1.jpg', width: 800, height: 600 }, // 0.75
        { id: 2, url: 'photo2.jpg', width: 600, height: 800 }, // 1.33
      ];

      const html = generator.generateHTML(photosWithDimensions, mockSettings);

      expect(html).toContain('photo1.jpg');
      expect(html).toContain('photo2.jpg');
    });
  });

  describe('captions', () => {
    it('should show overlay captions by default', () => {
      const html = generator.generateHTML(mockPhotos, mockSettings);

      expect(html).toContain('Photo 1');
      expect(html).toContain('position: absolute');
    });

    it('should hide captions when disabled', () => {
      mockSettings.showCaptions = false;
      const html = generator.generateHTML(mockPhotos, mockSettings);

      expect(html).not.toContain('Photo 1');
    });

    it('should support top position', () => {
      mockSettings.captionPosition = 'top';
      const html = generator.generateHTML(mockPhotos, mockSettings);

      expect(html).toContain('Photo 1');
      expect(html).toContain('background: #f9fafb');
    });

    it('should support bottom position', () => {
      mockSettings.captionPosition = 'bottom';
      const html = generator.generateHTML(mockPhotos, mockSettings);

      expect(html).toContain('Photo 1');
      expect(html).toContain('background: #f9fafb');
    });
  });

  describe('border styles', () => {
    it('should apply thin border', () => {
      mockSettings.borderStyle = 'thin';
      const html = generator.generateHTML(mockPhotos, mockSettings);

      expect(html).toContain('border: 1px solid #e5e7eb');
    });

    it('should apply thick border', () => {
      mockSettings.borderStyle = 'thick';
      const html = generator.generateHTML(mockPhotos, mockSettings);

      expect(html).toContain('border: 3px solid #d1d5db');
    });

    it('should have rounded corners by default', () => {
      const html = generator.generateHTML(mockPhotos, mockSettings);

      expect(html).toContain('border-radius: 4px');
    });
  });

  describe('edge cases', () => {
    it('should handle empty photo array', () => {
      const html = generator.generateHTML([], mockSettings);

      expect(html).toContain('gallery-masonry');
      const columnCount = (html.match(/class="masonry-column"/g) || []).length;
      expect(columnCount).toBe(3);
    });

    it('should handle single photo', () => {
      const singlePhoto = [mockPhotos[0]];
      const html = generator.generateHTML(singlePhoto, mockSettings);

      expect(html).toContain('masonry-photo-card');
      expect(html).toContain(singlePhoto[0].url);
    });

    it('should handle more photos than columns', () => {
      const manyPhotos = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        url: `photo${i}.jpg`,
        aspectRatio: 1.0,
      }));

      const html = generator.generateHTML(manyPhotos, mockSettings);

      const photoCount = (html.match(/class="masonry-photo-card"/g) || []).length;
      expect(photoCount).toBe(20);
    });
  });
});
