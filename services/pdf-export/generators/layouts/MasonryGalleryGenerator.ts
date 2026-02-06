// src/services/pdf-export/generators/layouts/MasonryGalleryGenerator.ts
// Генератор мозаичной галереи (Pinterest-style) для PDF

import type { GalleryPhoto, FullGallerySettings, MasonrySettings } from '@/types/pdf-gallery';

export class MasonryGalleryGenerator {
  /**
   * Генерирует HTML для мозаичной галереи
   */
  generateHTML(
    photos: GalleryPhoto[],
    settings: FullGallerySettings
  ): string {
    const masonrySettings = settings.masonry || {
      columns: 3,
      gap: 16,
      maintainAspectRatio: true,
    };

    // Распределяем фото по колонкам
    const columns = this.distributePhotos(photos, masonrySettings.columns);

    return `
      <div class="gallery-masonry" style="
        display: flex;
        gap: ${masonrySettings.gap}px;
        padding: ${masonrySettings.gap}px;
        ${settings.backgroundColor ? `background-color: ${settings.backgroundColor};` : ''}
      ">
        ${columns.map((columnPhotos) => this.generateColumn(columnPhotos, settings, masonrySettings)).join('')}
      </div>
    `;
  }

  /**
   * Распределяет фотографии по колонкам для оптимальной раскладки
   */
  private distributePhotos(photos: GalleryPhoto[], columnCount: number): GalleryPhoto[][] {
    const columns: GalleryPhoto[][] = Array.from({ length: columnCount }, () => []);
    const columnHeights: number[] = Array(columnCount).fill(0);

    photos.forEach((photo) => {
      // Находим колонку с минимальной высотой
      const minHeightIndex = columnHeights.indexOf(Math.min(...columnHeights));
      
      // Добавляем фото в эту колонку
      columns[minHeightIndex].push(photo);
      
      // Обновляем высоту колонки (используем aspect ratio или дефолтное значение)
      const aspectRatio = photo.aspectRatio || (photo.height && photo.width ? photo.height / photo.width : 1);
      columnHeights[minHeightIndex] += aspectRatio;
    });

    return columns;
  }

  /**
   * Генерирует колонку фотографий
   */
  private generateColumn(
    photos: GalleryPhoto[],
    settings: FullGallerySettings,
    masonrySettings: MasonrySettings
  ): string {
    return `
      <div class="masonry-column" style="
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: ${masonrySettings.gap}px;
      ">
        ${photos.map((photo) => this.generatePhotoCard(photo, settings, masonrySettings)).join('')}
      </div>
    `;
  }

  /**
   * Генерирует карточку фотографии
   */
  private generatePhotoCard(
    photo: GalleryPhoto,
    settings: FullGallerySettings,
    masonrySettings: MasonrySettings
  ): string {
    // Тема может быть необязательной — берём фильтр из theme (если передан) с безопасным доступом
    const imageFilter = (settings as any)?.theme?.imageFilter ?? (settings as any)?.imageFilter;
    const showCaption = settings.showCaptions && photo.caption;
    const captionPosition = settings.captionPosition;
    const borderStyle = this.getBorderStyle(settings.borderStyle);

    // Вычисляем aspect ratio для поддержания пропорций
    const aspectRatio = photo.aspectRatio || (photo.height && photo.width ? photo.height / photo.width : 1);
    const paddingBottom = masonrySettings.maintainAspectRatio ? `${aspectRatio * 100}%` : '75%';

    return `
      <div class="masonry-photo-card" style="
        position: relative;
        overflow: hidden;
        ${borderStyle}
        background: #ffffff;
        break-inside: avoid;
      ">
        ${captionPosition === 'top' && showCaption ? this.generateCaption(photo, 'top') : ''}
        
        <div class="photo-container" style="
          position: relative;
          width: 100%;
          padding-bottom: ${paddingBottom};
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
              ${imageFilter ? `filter: ${imageFilter};` : ''}
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
      background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
      color: #ffffff;
      padding: 16px 12px 12px 12px;
    ` : `
      background: #f9fafb;
      color: #1f2937;
      padding: 12px;
    `;

    return `
      <div class="photo-caption" style="${overlayStyle}">
        ${photo.caption.text ? `
          <p style="
            margin: 0 0 4px 0;
            font-size: 13px;
            font-weight: 500;
            line-height: 1.4;
          ">${photo.caption.text}</p>
        ` : ''}
        
        ${photo.caption.location || photo.caption.date ? `
          <p style="
            margin: 0;
            font-size: 11px;
            opacity: ${isOverlay ? '0.9' : '0.7'};
            line-height: 1.3;
          ">
            ${photo.caption.location || ''}
            ${photo.caption.location && photo.caption.date ? ' • ' : ''}
            ${photo.caption.date || ''}
          </p>
        ` : ''}
      </div>
    `;
  }

  /**
   * Получить стиль рамки
   */
  private getBorderStyle(borderStyle?: 'none' | 'thin' | 'thick' | 'polaroid'): string {
    switch (borderStyle) {
      case 'thin':
        return 'border: 1px solid #e5e7eb; border-radius: 6px;';
      case 'thick':
        return 'border: 3px solid #d1d5db; border-radius: 8px;';
      default:
        return 'border-radius: 4px;';
    }
  }
}
