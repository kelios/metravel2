// src/services/pdf-export/generators/layouts/GridGalleryGenerator.ts
// Генератор сеточной галереи для PDF

import type { GalleryPhoto, GallerySettings } from '@/src/types/pdf-gallery';

export class GridGalleryGenerator {
  /**
   * Генерирует HTML для сеточной галереи
   */
  generateHTML(
    photos: GalleryPhoto[],
    settings: GallerySettings
  ): string {
    const columns = settings.columns || 3;
    const spacing = this.getSpacing(settings.spacing);
    const borderStyle = this.getBorderStyle(settings.borderStyle);

    return `
      <div class="gallery-grid" style="
        display: grid;
        grid-template-columns: repeat(${columns}, 1fr);
        gap: ${spacing}px;
        padding: ${spacing}px;
        ${settings.backgroundColor ? `background-color: ${settings.backgroundColor};` : ''}
      ">
        ${photos.map((photo) => this.generatePhotoCard(photo, settings, borderStyle)).join('')}
      </div>
    `;
  }

  /**
   * Генерирует карточку фотографии
   */
  private generatePhotoCard(
    photo: GalleryPhoto,
    settings: GallerySettings,
    borderStyle: string
  ): string {
    const showCaption = settings.showCaptions && photo.caption;
    const captionPosition = settings.captionPosition;

    return `
      <div class="photo-card" style="
        position: relative;
        overflow: hidden;
        ${borderStyle}
        background: #ffffff;
      ">
        ${captionPosition === 'top' && showCaption ? this.generateCaption(photo, 'top') : ''}
        
        <div class="photo-container" style="
          position: relative;
          width: 100%;
          padding-bottom: 75%; /* 4:3 aspect ratio */
          overflow: hidden;
        ">
          <img 
            src="${photo.url}" 
            alt="${photo.caption?.text || ''}"
            style="
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
              ${this.theme.imageFilter ? `filter: ${this.theme.imageFilter};` : ''}
            "
          />
          ${captionPosition === 'overlay' && showCaption ? this.generateCaption(photo, 'overlay') : ''}
        </div>
        
        ${captionPosition === 'bottom' && showCaption ? this.generateCaption(photo, 'bottom') : ''}
      </div>
    `;
  }

  /**
   * Генерирует подпись к фотографии
   */
  private generateCaption(photo: GalleryPhoto, position: 'top' | 'bottom' | 'overlay'): string {
    if (!photo.caption) return '';

    const isOverlay = position === 'overlay';
    const overlayStyle = isOverlay ? `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
      color: #ffffff;
    ` : `
      background: #f9fafb;
      color: #1f2937;
    `;

    return `
      <div class="photo-caption" style="
        padding: 12px;
        ${overlayStyle}
      ">
        ${photo.caption.text ? `
          <p style="
            margin: 0 0 4px 0;
            font-size: 14px;
            font-weight: 500;
            line-height: 1.4;
          ">${photo.caption.text}</p>
        ` : ''}
        
        ${photo.caption.location || photo.caption.date ? `
          <p style="
            margin: 0;
            font-size: 12px;
            opacity: 0.8;
            line-height: 1.3;
          ">
            ${photo.caption.location || ''}
            ${photo.caption.location && photo.caption.date ? ' • ' : ''}
            ${photo.caption.date || ''}
          </p>
        ` : ''}
        
        ${photo.caption.showMetadata && photo.exif ? this.generateMetadata(photo) : ''}
      </div>
    `;
  }

  /**
   * Генерирует метаданные EXIF
   */
  private generateMetadata(photo: GalleryPhoto): string {
    if (!photo.exif) return '';

    const metadata: string[] = [];
    if (photo.exif.camera) metadata.push(photo.exif.camera);
    if (photo.exif.focalLength) metadata.push(photo.exif.focalLength);
    if (photo.exif.aperture) metadata.push(`f/${photo.exif.aperture}`);
    if (photo.exif.iso) metadata.push(`ISO ${photo.exif.iso}`);

    if (metadata.length === 0) return '';

    return `
      <p style="
        margin: 4px 0 0 0;
        font-size: 10px;
        opacity: 0.6;
        font-family: monospace;
      ">
        ${metadata.join(' • ')}
      </p>
    `;
  }

  /**
   * Получить значение отступа
   */
  private getSpacing(spacing: 'compact' | 'normal' | 'spacious'): number {
    switch (spacing) {
      case 'compact': return 8;
      case 'spacious': return 24;
      default: return 16;
    }
  }

  /**
   * Получить стиль рамки
   */
  private getBorderStyle(borderStyle?: 'none' | 'thin' | 'thick' | 'polaroid'): string {
    switch (borderStyle) {
      case 'thin':
        return 'border: 1px solid #e5e7eb; border-radius: 4px;';
      case 'thick':
        return 'border: 3px solid #d1d5db; border-radius: 8px;';
      case 'polaroid':
        return 'border: 12px solid #ffffff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 2px;';
      default:
        return '';
    }
  }
}
