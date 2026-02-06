/**
 * V1 Gallery page renderer — extracted from EnhancedPdfGenerator.renderGalleryPages
 */

import type { TravelForBook } from '@/types/pdf-export';
import type { GalleryLayout } from '@/types/pdf-gallery';
import { calculateOptimalColumns } from '@/types/pdf-gallery';
import { escapeHtml } from '../../utils/htmlUtils';
import { buildSafeImageUrl } from '../../utils/htmlUtils';
import { buildRunningHeader, getImageFilterStyle, type V1RenderContext } from './V1RenderHelpers';

export class V1GalleryRenderer {
  constructor(private ctx: V1RenderContext) {}

  renderPages(travel: TravelForBook, startPageNumber: number): string[] {
    const { colors, typography, spacing } = this.ctx.theme;
    const photos = (travel.gallery || [])
      .map((item) => {
        const raw = typeof item === 'string' ? item : item?.url;
        return buildSafeImageUrl(raw);
      })
      .filter((url): url is string => !!url && url.trim().length > 0);

    if (!photos.length) return [];

    const { layout, columns: configuredColumns, spacing: gallerySpacing } =
      this.getGalleryOptions();
    const twoPerPageLayout = this.ctx.settings?.galleryTwoPerPageLayout || 'vertical';

    const gapMm = this.getGalleryGapMm(gallerySpacing);

    const photosPerPage = this.getGalleryPhotosPerPage(layout, photos.length);
    const chunks: string[][] = [];
    for (let start = 0; start < photos.length; start += photosPerPage) {
      chunks.push(photos.slice(start, start + photosPerPage));
    }

    return chunks.map((pagePhotos, pageIndex) => {
      const defaultColumns = calculateOptimalColumns(pagePhotos.length, layout);
      const isTwoPerPage = photosPerPage === 2 && pagePhotos.length === 2;
      const columns = pagePhotos.length === 1
        ? 1
        : isTwoPerPage && twoPerPageLayout === 'vertical'
          ? 1
          : Math.max(1, Math.min(4, configuredColumns ?? defaultColumns));

      const imageHeight =
        layout === 'slideshow'
          ? '200mm'
          : pagePhotos.length === 1
            ? '210mm'
            : pagePhotos.length === 2
              ? (isTwoPerPage && twoPerPageLayout === 'vertical' ? '120mm' : '175mm')
              : pagePhotos.length <= 4
                ? '130mm'
                : pagePhotos.length <= 6
                  ? '95mm'
                  : '80mm';

      const gridContainerStyle =
        layout === 'masonry'
          ? `column-count: ${columns}; column-gap: ${gapMm}mm;`
          : `display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: ${gapMm}mm; align-items: stretch;`;

      const pageNumber = startPageNumber + pageIndex;
      const title = pageIndex === 0 ? 'Фотогалерея' : escapeHtml(travel.name);
      const subtitle = pageIndex === 0 ? escapeHtml(travel.name) : '';
      return `
      <section class="pdf-page gallery-page" style="padding: ${spacing.pagePadding}; display: flex; flex-direction: column;">
        ${buildRunningHeader(this.ctx, travel.name, pageNumber)}
        <div style="text-align: center; margin-bottom: 8mm;">
          <h2 style="
            font-size: ${typography.h2.size};
            margin-bottom: 3mm;
            font-weight: ${typography.h2.weight};
            color: ${colors.text};
            letter-spacing: 0.02em;
            font-family: ${typography.headingFont};
          ">${title}</h2>
          ${subtitle ? `
          <p style="
            color: ${colors.textMuted};
            font-size: ${typography.body.size};
            font-weight: 500;
            font-family: ${typography.bodyFont};
          ">${subtitle}</p>` : ''}
        </div>
        <div style="${gridContainerStyle} flex: 1; min-height: 170mm;">
          ${pagePhotos
            .map((photo, index) => {
              const wrapperStyle =
                layout === 'masonry'
                  ? `break-inside: avoid; margin-bottom: ${gapMm}mm;`
                  : '';

              const polaroidStyle =
                layout === 'polaroid'
                  ? `padding: 1.5mm; background: #fff; transform: rotate(${index % 2 === 0 ? '-1.4deg' : '1.3deg'});`
                  : '';

              const collageHero = layout === 'collage' && index === 0;
              const collageSpan = collageHero ? 'grid-column: span 2; grid-row: span 2;' : '';
              const resolvedHeight = collageHero ? '160mm' : imageHeight;
              const isSingle = pagePhotos.length === 1;
              const forceCover = pagePhotos.length <= 2;
              const imgHeightStyle =
                layout === 'polaroid'
                  ? (forceCover ? `height: ${isSingle ? '210mm' : '190mm'};` : `height: auto; max-height: ${isSingle ? '210mm' : '190mm'};`)
                  : (forceCover ? `height: ${isSingle ? '210mm' : resolvedHeight};` : `height: auto; max-height: ${resolvedHeight};`);
              const wrapperMinHeight =
                layout === 'polaroid'
                  ? (isSingle ? 'min-height: 210mm;' : '')
                  : `min-height: ${isSingle ? '210mm' : resolvedHeight};`;

              // Для одиночных фото (slideshow) — blur-backdrop + contain
              const useBlurBackdrop = isSingle && layout === 'slideshow';

              return `
            <div style="
              ${wrapperStyle}
              ${collageSpan}
              border-radius: ${this.ctx.theme.blocks.borderRadius};
              overflow: hidden;
              position: relative;
              box-shadow: ${this.ctx.theme.blocks.shadow};
              background: ${layout === 'polaroid' ? '#fff' : colors.surfaceAlt};
              ${polaroidStyle}
              ${wrapperMinHeight}
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              ${useBlurBackdrop ? `
                <img src="${escapeHtml(photo)}" alt="" aria-hidden="true"
                  style="
                    position: absolute;
                    inset: -20px;
                    width: calc(100% + 40px);
                    height: calc(100% + 40px);
                    object-fit: cover;
                    filter: blur(20px);
                    opacity: 0.4;
                    display: block;
                  "
                  crossorigin="anonymous" />
              ` : ''}
              <img src="${escapeHtml(photo)}" alt="Фото ${index + 1}"
                style="
                  width: 100%;
                  ${imgHeightStyle}
                  object-fit: ${useBlurBackdrop ? 'contain' : 'cover'};
                  display: block;
                  ${useBlurBackdrop ? 'position: relative;' : ''}
                  ${getImageFilterStyle(this.ctx)}
                "
                crossorigin="anonymous"
                onerror="this.style.display='none'; this.parentElement.style.background='${colors.surfaceAlt}';" />
            </div>
          `;
            })
            .join('')}
        </div>
      </section>
    `;
    });
  }

  renderSinglePage(travel: TravelForBook, pageNumber: number): string {
    return this.renderPages(travel, pageNumber)[0] || '';
  }

  // --- Gallery helpers ---

  private getGalleryOptions() {
    const settings = this.ctx.settings;
    const layout: GalleryLayout = (settings?.galleryLayout as GalleryLayout) || 'grid';
    const columns = settings?.galleryColumns;
    const showCaptions = settings?.showCaptions ?? false;
    const captionPosition = settings?.captionPosition || 'none';
    const spacing = settings?.gallerySpacing || 'normal';
    return { layout, columns, showCaptions, captionPosition, spacing };
  }

  private getGalleryPhotosPerPage(layout: GalleryLayout, totalPhotos: number): number {
    if (layout === 'slideshow') return 1;
    const configured = this.ctx.settings?.galleryPhotosPerPage;
    if (configured === 0) return totalPhotos;
    if (typeof configured === 'number' && configured > 0) {
      return Math.min(totalPhotos, Math.max(1, configured));
    }
    return totalPhotos;
  }

  private getGalleryGapMm(spacing: 'compact' | 'normal' | 'spacious'): number {
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
}
