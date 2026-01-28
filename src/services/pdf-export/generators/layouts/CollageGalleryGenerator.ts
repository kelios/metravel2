// src/services/pdf-export/generators/layouts/CollageGalleryGenerator.ts
// Генератор коллажей для PDF

import type { GalleryPhoto, FullGallerySettings, CollageTemplate } from '@/src/types/pdf-gallery';

export class CollageGalleryGenerator {
  /**
   * Генерирует HTML для коллажа
   */
  generateHTML(
    photos: GalleryPhoto[],
    settings: FullGallerySettings
  ): string {
    const collageSettings = settings.collage || {
      template: 'hero-left',
      gap: 12,
      borderRadius: 8,
      shadow: true,
    };

    // Выбираем подходящий шаблон на основе количества фото
    const template = this.selectTemplate(photos.length, collageSettings.template);
    
    return `
      <div class="gallery-collage" style="
        padding: ${collageSettings.gap}px;
        ${settings.backgroundColor ? `background-color: ${settings.backgroundColor};` : ''}
      ">
        ${this.generateCollageLayout(photos, template, settings)}
      </div>
    `;
  }

  /**
   * Выбирает оптимальный шаблон на основе количества фото
   */
  private selectTemplate(photoCount: number, preferredTemplate: CollageTemplate): CollageTemplate {
    if (photoCount === 1) return 'hero-left';
    if (photoCount === 2) return 'symmetric';
    if (photoCount === 3) return 'hero-top';
    if (photoCount === 4) return 'symmetric';
    if (photoCount >= 5) return preferredTemplate;
    return preferredTemplate;
  }

  /**
   * Генерирует раскладку коллажа
   */
  private generateCollageLayout(
    photos: GalleryPhoto[],
    template: CollageTemplate,
    settings: FullGallerySettings
  ): string {
    switch (template) {
      case 'hero-left':
        return this.generateHeroLeft(photos, settings);
      case 'hero-right':
        return this.generateHeroRight(photos, settings);
      case 'hero-top':
        return this.generateHeroTop(photos, settings);
      case 'hero-bottom':
        return this.generateHeroBottom(photos, settings);
      case 'symmetric':
        return this.generateSymmetric(photos, settings);
      case 'magazine':
        return this.generateMagazine(photos, settings);
      default:
        return this.generateHeroLeft(photos, settings);
    }
  }

  /**
   * Hero Left: одно большое фото слева + маленькие справа
   */
  private generateHeroLeft(photos: GalleryPhoto[], settings: FullGallerySettings): string {
    const gap = settings.collage?.gap || 12;
    const [hero, ...rest] = photos;

    return `
      <div style="display: flex; gap: ${gap}px; height: 600px;">
        <div style="flex: 2;">
          ${this.generatePhoto(hero, settings, '100%', '100%')}
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; gap: ${gap}px;">
          ${rest.slice(0, 4).map(photo => 
            this.generatePhoto(photo, settings, '100%', 'calc((100% - ${gap * 3}px) / 4)')
          ).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Hero Right: одно большое фото справа + маленькие слева
   */
  private generateHeroRight(photos: GalleryPhoto[], settings: FullGallerySettings): string {
    const gap = settings.collage?.gap || 12;
    const [hero, ...rest] = photos;

    return `
      <div style="display: flex; gap: ${gap}px; height: 600px;">
        <div style="flex: 1; display: flex; flex-direction: column; gap: ${gap}px;">
          ${rest.slice(0, 4).map(photo => 
            this.generatePhoto(photo, settings, '100%', 'calc((100% - ${gap * 3}px) / 4)')
          ).join('')}
        </div>
        <div style="flex: 2;">
          ${this.generatePhoto(hero, settings, '100%', '100%')}
        </div>
      </div>
    `;
  }

  /**
   * Hero Top: одно большое фото сверху + маленькие снизу
   */
  private generateHeroTop(photos: GalleryPhoto[], settings: FullGallerySettings): string {
    const gap = settings.collage?.gap || 12;
    const [hero, ...rest] = photos;

    return `
      <div style="display: flex; flex-direction: column; gap: ${gap}px; height: 600px;">
        <div style="flex: 2;">
          ${this.generatePhoto(hero, settings, '100%', '100%')}
        </div>
        <div style="flex: 1; display: flex; gap: ${gap}px;">
          ${rest.slice(0, 3).map(photo => 
            this.generatePhoto(photo, settings, 'calc((100% - ${gap * 2}px) / 3)', '100%')
          ).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Hero Bottom: одно большое фото снизу + маленькие сверху
   */
  private generateHeroBottom(photos: GalleryPhoto[], settings: FullGallerySettings): string {
    const gap = settings.collage?.gap || 12;
    const [hero, ...rest] = photos;

    return `
      <div style="display: flex; flex-direction: column; gap: ${gap}px; height: 600px;">
        <div style="flex: 1; display: flex; gap: ${gap}px;">
          ${rest.slice(0, 3).map(photo => 
            this.generatePhoto(photo, settings, 'calc((100% - ${gap * 2}px) / 3)', '100%')
          ).join('')}
        </div>
        <div style="flex: 2;">
          ${this.generatePhoto(hero, settings, '100%', '100%')}
        </div>
      </div>
    `;
  }

  /**
   * Symmetric: симметричная раскладка
   */
  private generateSymmetric(photos: GalleryPhoto[], settings: FullGallerySettings): string {
    const gap = settings.collage?.gap || 12;
    const rows = Math.ceil(photos.length / 2);

    return `
      <div style="display: flex; flex-direction: column; gap: ${gap}px;">
        ${Array.from({ length: rows }).map((_, rowIndex) => {
          const rowPhotos = photos.slice(rowIndex * 2, rowIndex * 2 + 2);
          return `
            <div style="display: flex; gap: ${gap}px; height: ${600 / rows}px;">
              ${rowPhotos.map(photo => 
                this.generatePhoto(photo, settings, `calc((100% - ${gap}px) / 2)`, '100%')
              ).join('')}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  /**
   * Magazine: журнальная раскладка
   */
  private generateMagazine(photos: GalleryPhoto[], settings: FullGallerySettings): string {
    const gap = settings.collage?.gap || 12;

    return `
      <div style="display: grid; grid-template-columns: 2fr 1fr; grid-template-rows: repeat(3, 200px); gap: ${gap}px;">
        ${photos.slice(0, 5).map((photo, index) => {
          const gridArea = this.getMagazineGridArea(index);
          return this.generatePhoto(photo, settings, '100%', '100%', gridArea);
        }).join('')}
      </div>
    `;
  }

  /**
   * Получить grid-area для журнальной раскладки
   */
  private getMagazineGridArea(index: number): string {
    const areas = [
      '1 / 1 / 3 / 2', // Большое фото слева (2 строки)
      '1 / 2 / 2 / 3', // Маленькое справа сверху
      '2 / 2 / 3 / 3', // Маленькое справа в центре
      '3 / 1 / 4 / 2', // Маленькое слева снизу
      '3 / 2 / 4 / 3', // Маленькое справа снизу
    ];
    return `grid-area: ${areas[index] || '1 / 1 / 2 / 2'};`;
  }

  /**
   * Генерирует отдельную фотографию
   */
  private generatePhoto(
    photo: GalleryPhoto,
    settings: FullGallerySettings,
    width: string,
    height: string,
    additionalStyle: string = ''
  ): string {
    const borderRadius = settings.collage?.borderRadius || 8;
    const shadow = settings.collage?.shadow ? 'box-shadow: 0 4px 6px rgba(0,0,0,0.1);' : '';
    const showCaption = settings.showCaptions && photo.caption && settings.captionPosition === 'overlay';
    const imageFilter = (settings as any)?.theme?.imageFilter ?? (settings as any)?.imageFilter;

    return `
      <div style="
        position: relative;
        width: ${width};
        height: ${height};
        overflow: hidden;
        border-radius: ${borderRadius}px;
        ${shadow}
        ${additionalStyle}
      ">
        <img 
          src="${photo.url}" 
          alt="${photo.caption?.text || ''}"
          style="
            width: 100%;
            height: 100%;
            object-fit: cover;
            ${imageFilter ? `filter: ${imageFilter};` : ''}
          "
        />
        ${showCaption ? this.generateCaption(photo) : ''}
      </div>
    `;
  }

  /**
   * Генерирует подпись (только overlay для коллажей)
   */
  private generateCaption(photo: GalleryPhoto): string {
    if (!photo.caption) return '';

    return `
      <div style="
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
        color: #ffffff;
        padding: 16px 12px 12px 12px;
      ">
        ${photo.caption.text ? `
          <p style="margin: 0; font-size: 13px; font-weight: 500; line-height: 1.4;">
            ${photo.caption.text}
          </p>
        ` : ''}
      </div>
    `;
  }
}
