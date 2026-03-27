// src/services/pdf-export/generators/v2/pages/GalleryPageGenerator.ts
// ✅ GENERATOR: Генератор страницы галереи

import { BasePageGenerator } from './PageGenerator';
import type { PageContext } from '../types';
import type { GalleryLayout, CaptionPosition } from '@/types/pdf-gallery';
import { calculateOptimalColumns } from '@/types/pdf-gallery';
import { buildSafeImageUrl } from '../../../utils/htmlUtils';
import { buildGalleryCaption, getGalleryGapMm } from '../runtime/pdfVisualHelpers';

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
        return buildSafeImageUrl(raw);
      })
      .filter((url): url is string => !!url && url.trim().length > 0);

    if (!photos.length) return '';

    // Получаем настройки галереи
    const galleryOptions = this.getGalleryOptions(settings);
    const { layout, columns: configuredColumns, showCaptions, captionPosition, spacing: gallerySpacing } = galleryOptions;

    const gapMm = getGalleryGapMm(gallerySpacing);

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
        <div style="${gridContainerStyle}">
          ${photos
            .map((photo, index) => {
              const caption = showCaptions
                ? buildGalleryCaption({ index, position: captionPosition, typography, colors })
                : null;

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
              ${this.buildContainImage(photo, `Фото ${index + 1}`, resolvedHeight, { onerrorBg: colors.surfaceAlt })}
              ${caption && captionPosition === 'overlay' ? caption.wrapperStart + caption.wrapperEnd : ''}
              ${caption && captionPosition === 'bottom' ? caption.wrapperStart + caption.wrapperEnd : ''}
            </div>
          `;
            })
            .join('')}
        </div>
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

}
