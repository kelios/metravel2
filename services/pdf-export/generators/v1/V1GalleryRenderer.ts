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
    const { colors, spacing } = this.ctx.theme;
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
    const pagePaddingMm = this.parseMm(spacing.pagePadding, 25);
    const runningHeaderMm = 14;
    const availableContentHeightMm = Math.max(
      170,
      297 - pagePaddingMm * 2 - runningHeaderMm
    );

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
      const estimatedRows = Math.max(1, Math.ceil(pagePhotos.length / Math.max(columns, 1)));
      const maxCardHeightMm = Math.max(
        72,
        Math.floor((availableContentHeightMm - gapMm * (estimatedRows - 1)) / estimatedRows)
      );
      const targetCardHeightMm =
        layout === 'slideshow'
          ? 200
          : pagePhotos.length === 1
            ? 210
            : pagePhotos.length === 2
              ? (isTwoPerPage && twoPerPageLayout === 'vertical' ? 120 : 175)
              : pagePhotos.length <= 4
                ? 130
                : pagePhotos.length <= 6
                  ? 95
                  : 80;
      const cardHeightMm = Math.min(targetCardHeightMm, maxCardHeightMm);
      const singleCardHeightMm = Math.min(210, availableContentHeightMm);
      const imageHeight = `${cardHeightMm}mm`;
      const singleImageHeight = `${singleCardHeightMm}mm`;

      const gridContainerStyle =
        layout === 'masonry'
          ? `column-count: ${columns}; column-gap: ${gapMm}mm;`
          : `display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: ${gapMm}mm; align-items: stretch;`;

      const pageNumber = startPageNumber + pageIndex;
      return `
      <section class="pdf-page gallery-page" style="padding: ${spacing.pagePadding}; height: 285mm; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
        ${buildRunningHeader(this.ctx, travel.name, pageNumber)}
        <div style="${gridContainerStyle}">
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
                  ? (forceCover ? `height: ${isSingle ? singleImageHeight : resolvedHeight};` : `height: auto; max-height: ${isSingle ? singleImageHeight : resolvedHeight};`)
                  : (forceCover ? `height: ${isSingle ? singleImageHeight : resolvedHeight};` : `height: auto; max-height: ${resolvedHeight};`);
              const wrapperMinHeight =
                layout === 'polaroid'
                  ? (isSingle ? `min-height: ${singleImageHeight};` : '')
                  : `min-height: ${isSingle ? singleImageHeight : resolvedHeight};`;

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
              <img src="${escapeHtml(photo)}" alt="" aria-hidden="true"
                style="
                  position: absolute;
                  inset: -10px;
                  width: calc(100% + 20px);
                  height: calc(100% + 20px);
                  object-fit: cover;
                  filter: blur(18px);
                  opacity: 0.45;
                  display: block;
                  pointer-events: none;
                "
                crossorigin="anonymous" />
              <img src="${escapeHtml(photo)}" alt="Фото ${index + 1}"
                style="
                  width: 100%;
                  ${imgHeightStyle}
                  object-fit: contain;
                  display: block;
                  position: relative;
                  ${getImageFilterStyle(this.ctx)}
                "
                crossorigin="anonymous"
                onerror="this.style.display='none'; this.previousElementSibling.style.display='none'; this.parentElement.style.background='${colors.surfaceAlt}';" />
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

  private parseMm(value: string | undefined, fallback: number): number {
    if (!value) return fallback;
    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)mm$/i);
    if (!match) return fallback;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
