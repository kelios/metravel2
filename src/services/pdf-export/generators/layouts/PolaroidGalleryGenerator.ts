// src/services/pdf-export/generators/layouts/PolaroidGalleryGenerator.ts
// Генератор галереи в стиле полароид для PDF

import type { GalleryPhoto, FullGallerySettings } from '@/src/types/pdf-gallery';

export class PolaroidGalleryGenerator {
  /**
   * Генерирует HTML для галереи в стиле полароид
   */
  generateHTML(
    photos: GalleryPhoto[],
    settings: FullGallerySettings
  ): string {
    const polaroidSettings = settings.polaroid || {
      frameColor: '#ffffff',
      frameWidth: 20,
      rotation: 3,
      shadow: true,
      showCaption: true,
      captionFont: 'handwritten',
    };

    const spacing = this.getSpacing(settings.spacing);

    return `
      <div class="gallery-polaroid" style="
        display: flex;
        flex-wrap: wrap;
        gap: ${spacing}px;
        padding: ${spacing}px;
        justify-content: center;
        ${settings.backgroundColor ? `background-color: ${settings.backgroundColor};` : ''}
      ">
        ${photos.map((photo, index) => this.generatePolaroid(photo, index, settings, polaroidSettings)).join('')}
      </div>
    `;
  }

  /**
   * Генерирует отдельный полароид
   */
  private generatePolaroid(
    photo: GalleryPhoto,
    index: number,
    settings: FullGallerySettings,
    polaroidSettings: NonNullable<FullGallerySettings['polaroid']>
  ): string {
    // Случайный угол поворота в пределах ±rotation
    const rotation = this.getRotation(index, polaroidSettings.rotation);
    const shadow = polaroidSettings.shadow 
      ? 'box-shadow: 0 8px 16px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1);'
      : '';
    
    const showCaption = polaroidSettings.showCaption && photo.caption;
    const captionFont = polaroidSettings.captionFont === 'handwritten' 
      ? 'font-family: "Comic Sans MS", cursive; font-style: italic;'
      : 'font-family: "Courier New", monospace;';

    return `
      <div class="polaroid" style="
        display: inline-block;
        background: ${polaroidSettings.frameColor};
        padding: ${polaroidSettings.frameWidth}px;
        padding-bottom: ${polaroidSettings.frameWidth + 60}px;
        transform: rotate(${rotation}deg);
        transition: transform 0.3s ease;
        ${shadow}
        max-width: 280px;
      ">
        <div class="polaroid-photo" style="
          width: 240px;
          height: 240px;
          overflow: hidden;
          background: #f0f0f0;
        ">
          <img 
            src="${photo.url}" 
            alt="${photo.caption?.text || ''}"
            style="
              width: 100%;
              height: 100%;
              object-fit: cover;
              ${this.theme.imageFilter ? `filter: ${this.theme.imageFilter};` : ''}
            "
          />
        </div>
        
        ${showCaption ? `
          <div class="polaroid-caption" style="
            margin-top: 12px;
            text-align: center;
            ${captionFont}
            font-size: 14px;
            color: #333333;
            line-height: 1.4;
            padding: 0 8px;
          ">
            ${photo.caption?.text || ''}
            ${photo.caption?.location ? `<br><span style="font-size: 12px; opacity: 0.7;">${photo.caption.location}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Получить угол поворота для полароида
   * Использует индекс для создания предсказуемого, но разнообразного поворота
   */
  private getRotation(index: number, maxRotation: number): number {
    // Создаем паттерн: -3, +2, -1, +3, -2, +1, ...
    const pattern = [-1, 0.7, -0.3, 1, -0.7, 0.3];
    const patternValue = pattern[index % pattern.length];
    return patternValue * maxRotation;
  }

  /**
   * Получить значение отступа
   */
  private getSpacing(spacing: 'compact' | 'normal' | 'spacious'): number {
    switch (spacing) {
      case 'compact': return 16;
      case 'spacious': return 40;
      default: return 24;
    }
  }
}
