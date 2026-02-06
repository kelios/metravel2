// src/services/pdf-export/generators/v2/pages/GalleryPageGenerator.ts
// ✅ GENERATOR: Генератор страницы галереи

import { BasePageGenerator } from './PageGenerator';
import type { PageContext } from '../types';
import type { GalleryLayout, CaptionPosition } from '@/types/pdf-gallery';
import { calculateOptimalColumns } from '@/types/pdf-gallery';

/**
 * Генератор страницы галереи фотографий
 */
export class GalleryPageGenerator extends BasePageGenerator {
  /**
   * Генерирует страницу галереи
   */
  async generate(context: PageContext): Promise<string> {
    const { travel, theme, pageNumber, settings } = context;

    if (!travel) {
      throw new Error('GalleryPageGenerator requires travel in context');
    }

    const { colors, typography, spacing } = theme;

    // Получаем фото из галереи
    const photos = (travel.gallery || [])
      .map((item) => {
        const raw = typeof item === 'string' ? item : item?.url;
        return this.buildSafeImageUrl(raw);
      })
      .filter((url): url is string => !!url && url.trim().length > 0);

    if (!photos.length) return '';

    // Получаем настройки галереи
    const galleryOptions = this.getGalleryOptions(settings);
    const { layout, columns: configuredColumns, showCaptions, captionPosition, spacing: gallerySpacing } = galleryOptions;

    const gapMm = this.getGalleryGapMm(gallerySpacing);

    const defaultColumns = calculateOptimalColumns(photos.length, layout);
    const columns = Math.max(1, Math.min(4, configuredColumns ?? defaultColumns));

    const imageHeight =
      layout === 'slideshow'
        ? '170mm'
        : photos.length <= 4
          ? '80mm'
          : photos.length <= 6
            ? '65mm'
            : '55mm';

    const gridContainerStyle =
      layout === 'masonry'
        ? `column-count: ${columns}; column-gap: ${gapMm}mm;`
        : `display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: ${gapMm}mm;`;

    return `
      <section class="pdf-page gallery-page" style="padding: ${spacing.pagePadding};">
        <div style="text-align: center; margin-bottom: 18mm;">
          <h2 style="
            font-size: ${typography.h2.size};
            margin-bottom: 6mm;
            font-weight: ${typography.h2.weight};
            color: ${colors.text};
            letter-spacing: 0.02em;
            font-family: ${typography.headingFont};
          ">Фотогалерея</h2>
          <p style="
            color: ${colors.textMuted};
            font-size: ${typography.body.size};
            font-weight: 500;
            font-family: ${typography.bodyFont};
          ">${this.escapeHtml(travel.name)}</p>
        </div>
        <div style="${gridContainerStyle}">
          ${photos
            .map((photo, index) => {
              const caption = showCaptions ? this.buildGalleryCaption(index, captionPosition, typography, colors) : null;

              const wrapperStyle =
                layout === 'masonry'
                  ? `break-inside: avoid; margin-bottom: ${gapMm}mm;`
                  : '';

              const polaroidStyle =
                layout === 'polaroid'
                  ? `padding: 6mm 6mm 10mm 6mm; background: #fff; transform: rotate(${index % 2 === 0 ? '-1.4deg' : '1.3deg'});`
                  : '';

              const collageHero = layout === 'collage' && index === 0;
              const collageSpan = collageHero ? 'grid-column: span 2; grid-row: span 2;' : '';
              const resolvedHeight = collageHero ? '120mm' : imageHeight;

              return `
            <div style="
              ${wrapperStyle}
              ${collageSpan}
              border-radius: 14px;
              overflow: hidden;
              position: relative;
              box-shadow: 0 4px 12px rgba(0,0,0,0.12);
              background: ${colors.surfaceAlt};
              ${polaroidStyle}
            ">
              ${caption && captionPosition === 'top' ? caption.wrapperStart + caption.wrapperEnd : ''}
              <img src="${this.escapeHtml(photo)}" alt="Фото ${index + 1}"
                style="
                  width: 100%;
                  height: ${resolvedHeight};
                  object-fit: cover;
                  display: block;
                "
                crossorigin="anonymous"
                onerror="this.style.display='none'; this.parentElement.style.background='${colors.surfaceAlt}';" />
              ${caption && captionPosition === 'overlay' ? caption.wrapperStart + caption.wrapperEnd : ''}
              ${caption && captionPosition === 'bottom' ? caption.wrapperStart + caption.wrapperEnd : ''}
              <div style="
                position: absolute;
                top: 8px;
                right: 8px;
                background: rgba(0,0,0,0.7);
                color: #fff;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11pt;
                font-weight: 700;
                box-shadow: 0 4px 12px rgba(0,0,0,0.12);
                z-index: 3;
              ">${index + 1}</div>
            </div>
          `;
            })
            .join('')}
        </div>
        <div style="
          margin-top: 14mm;
          text-align: center;
          color: ${colors.textMuted};
          font-size: ${typography.body.size};
          font-weight: 500;
          font-family: ${typography.bodyFont};
        ">${photos.length} ${this.getPhotoLabel(photos.length)}</div>
        <div style="
          position: absolute;
          bottom: 15mm;
          right: 25mm;
          font-size: ${typography.caption.size};
          color: ${colors.textMuted};
          font-weight: 500;
          font-family: ${typography.bodyFont};
        ">${pageNumber}</div>
      </section>
    `;
  }

  /**
   * Получает настройки галереи из settings
   */
  private getGalleryOptions(settings: any): {
    layout: GalleryLayout;
    columns?: number;
    showCaptions: boolean;
    captionPosition: CaptionPosition;
    spacing: NonNullable<any>;
  } {
    const layout = (settings?.galleryLayout || 'grid') as GalleryLayout;
    const spacing = (settings?.gallerySpacing || 'normal');
    const showCaptions = settings?.showCaptions !== false;
    const captionPosition = (settings?.captionPosition || 'bottom') as CaptionPosition;
    const columns = typeof settings?.galleryColumns === 'number' ? settings.galleryColumns : undefined;

    return {
      layout,
      columns,
      showCaptions,
      captionPosition,
      spacing,
    };
  }

  /**
   * Получает размер отступа в мм
   */
  private getGalleryGapMm(spacing: string): number {
    switch (spacing) {
      case 'compact':
        return 3;
      case 'spacious':
        return 8;
      case 'normal':
      default:
        return 6;
    }
  }

  /**
   * Создает подпись для фотографии
   */
  private buildGalleryCaption(
    index: number,
    position: CaptionPosition,
    typography: any,
    colors: any
  ): { wrapperStart: string; wrapperEnd: string } {
    if (position === 'none') {
      return { wrapperStart: '', wrapperEnd: '' };
    }

    const text = `Фото ${index + 1}`;

    if (position === 'overlay') {
      return {
        wrapperStart: `
          <div style="
            position: absolute;
            left: 8px;
            bottom: 8px;
            right: 8px;
            padding: 6px 10px;
            background: rgba(0,0,0,0.65);
            color: #fff;
            border-radius: 10px;
            font-size: ${typography.caption.size};
            line-height: 1.25;
            font-weight: 600;
            z-index: 2;
          ">${this.escapeHtml(text)}`,
        wrapperEnd: `</div>`,
      };
    }

    const top = position === 'top';
    return {
      wrapperStart: `
        <div style="
          padding: 8px 10px;
          color: ${colors.textMuted};
          font-size: ${typography.caption.size};
          font-weight: 600;
          font-family: ${typography.bodyFont};
          ${top ? 'border-bottom' : 'border-top'}: 1px solid ${colors.border};
          background: ${colors.surface};
        ">${this.escapeHtml(text)}`,
      wrapperEnd: `</div>`,
    };
  }

  /**
   * Получает правильную форму слова "фото"
   */
  private getPhotoLabel(count: number): string {
    if (count === 1) return 'фото';
    if (count >= 2 && count <= 4) return 'фото';
    return 'фото';
  }

  /**
   * Создает безопасный URL изображения
   */
  private buildSafeImageUrl(url: string | null | undefined): string {
    if (!url) return '';
    const trimmed = url.trim();
    if (!trimmed) return '';

    // Используем прокси для внешних изображений
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return `https://images.weserv.nl/?url=${encodeURIComponent(trimmed)}&w=1600&q=85`;
    }

    return trimmed;
  }
}

