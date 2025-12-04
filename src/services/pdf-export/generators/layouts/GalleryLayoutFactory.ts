// src/services/pdf-export/generators/layouts/GalleryLayoutFactory.ts
// Фабрика для создания генераторов галерей

import type { GalleryPhoto, FullGallerySettings, GalleryLayout } from '@/src/types/pdf-gallery';
import { GridGalleryGenerator } from './GridGalleryGenerator';
import { MasonryGalleryGenerator } from './MasonryGalleryGenerator';
import { CollageGalleryGenerator } from './CollageGalleryGenerator';
import { PolaroidGalleryGenerator } from './PolaroidGalleryGenerator';

/**
 * Интерфейс генератора галереи
 */
interface IGalleryGenerator {
  generateHTML(photos: GalleryPhoto[], settings: FullGallerySettings): string;
}

/**
 * Фабрика для создания генераторов галерей
 */
export class GalleryLayoutFactory {
  private static generators: Map<GalleryLayout, IGalleryGenerator> = new Map<GalleryLayout, IGalleryGenerator>([
    ['grid', new GridGalleryGenerator()],
    ['masonry', new MasonryGalleryGenerator()],
    ['collage', new CollageGalleryGenerator()],
    ['polaroid', new PolaroidGalleryGenerator()],
  ]);

  /**
   * Генерирует HTML галереи на основе выбранной раскладки
   */
  static generateGallery(
    photos: GalleryPhoto[],
    settings: FullGallerySettings
  ): string {
    if (!photos || photos.length === 0) {
      return '<div class="gallery-empty">Нет фотографий для отображения</div>';
    }

    const layout = settings.layout || 'grid';
    const generator = this.generators.get(layout);

    if (!generator) {
      console.warn(`Генератор для раскладки "${layout}" не найден, используется grid`);
      return this.generators.get('grid')!.generateHTML(photos, settings);
    }

    // Slideshow обрабатывается отдельно (одно фото на страницу)
    if (layout === 'slideshow') {
      return this.generateSlideshow(photos, settings);
    }

    return generator.generateHTML(photos, settings);
  }

  /**
   * Генерирует слайдшоу (одно фото на страницу)
   */
  private static generateSlideshow(
    photos: GalleryPhoto[],
    settings: FullGallerySettings
  ): string {
    const slideshowSettings = settings.slideshow || {
      photoSize: 'large',
      showCaption: true,
      showMetadata: true,
      backgroundColor: '#ffffff',
      textColor: '#1a1a1a',
    };

    return photos.map((photo) => this.generateSlidePage(photo, slideshowSettings)).join('');
  }

  /**
   * Генерирует страницу слайда
   */
  private static generateSlidePage(
    photo: GalleryPhoto,
    settings: NonNullable<FullGallerySettings['slideshow']>
  ): string {
    const photoSize = this.getPhotoSize(settings.photoSize);

    return `
      <div class="slideshow-page" style="
        width: 100%;
        height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: ${settings.backgroundColor};
        color: ${settings.textColor};
        page-break-after: always;
        padding: 40px;
      ">
        <div class="slide-photo" style="
          max-width: ${photoSize.width};
          max-height: ${photoSize.height};
          width: 100%;
          margin-bottom: ${settings.showCaption ? '32px' : '0'};
        ">
          <img 
            src="${photo.url}" 
            alt="${photo.caption?.text || ''}"
            style="
              width: 100%;
              height: 100%;
              object-fit: contain;
              box-shadow: 0 8px 24px rgba(0,0,0,0.12);
              border-radius: 8px;
            "
          />
        </div>
        
        ${settings.showCaption && photo.caption ? `
          <div class="slide-caption" style="
            max-width: 600px;
            text-align: center;
          ">
            ${photo.caption.text ? `
              <p style="
                margin: 0 0 12px 0;
                font-size: 20px;
                font-weight: 500;
                line-height: 1.4;
              ">${photo.caption.text}</p>
            ` : ''}
            
            ${photo.caption.location || photo.caption.date ? `
              <p style="
                margin: 0;
                font-size: 16px;
                opacity: 0.7;
                line-height: 1.3;
              ">
                ${photo.caption.location || ''}
                ${photo.caption.location && photo.caption.date ? ' • ' : ''}
                ${photo.caption.date || ''}
              </p>
            ` : ''}
            
            ${settings.showMetadata && photo.exif ? this.generateMetadata(photo) : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Получить размер фото для слайдшоу
   */
  private static getPhotoSize(size: 'full' | 'large' | 'medium'): { width: string; height: string } {
    switch (size) {
      case 'full':
        return { width: '100%', height: '80vh' };
      case 'medium':
        return { width: '70%', height: '60vh' };
      default: // large
        return { width: '85%', height: '70vh' };
    }
  }

  /**
   * Генерирует метаданные EXIF
   */
  private static generateMetadata(photo: GalleryPhoto): string {
    if (!photo.exif) return '';

    const metadata: string[] = [];
    if (photo.exif.camera) metadata.push(photo.exif.camera);
    if (photo.exif.lens) metadata.push(photo.exif.lens);
    if (photo.exif.focalLength) metadata.push(photo.exif.focalLength);
    if (photo.exif.aperture) metadata.push(`f/${photo.exif.aperture}`);
    if (photo.exif.iso) metadata.push(`ISO ${photo.exif.iso}`);
    if (photo.exif.shutterSpeed) metadata.push(photo.exif.shutterSpeed);

    if (metadata.length === 0) return '';

    return `
      <p style="
        margin: 16px 0 0 0;
        font-size: 12px;
        opacity: 0.5;
        font-family: monospace;
      ">
        ${metadata.join(' • ')}
      </p>
    `;
  }
}
