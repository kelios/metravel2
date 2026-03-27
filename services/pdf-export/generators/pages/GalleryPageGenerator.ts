// src/services/pdf-export/generators/pages/GalleryPageGenerator.ts
// Legacy compatibility adapter for the old pages/* API.

import type { PdfThemeConfig } from '../../themes/PdfThemeConfig';
import { escapeHtml } from '../../utils/htmlUtils';
import { buildContainImageMarkup } from '../v2/runtime/pdfVisualHelpers';

export type GalleryLayout = 'grid' | 'mosaic' | 'collage' | 'polaroid' | 'dynamic';

export interface GalleryPhoto {
  url: string;
  id?: number | string;
  caption?: string;
}

export class GalleryPageGenerator {
  constructor(private theme: PdfThemeConfig) {}

  generate(
    travelName: string,
    photos: GalleryPhoto[],
    layout: GalleryLayout,
    pageNumber: number
  ): string {
    const { colors, spacing } = this.theme;
    return `
      <section class="pdf-page gallery-page" style="
        padding: ${spacing.pagePadding};
        background: ${colors.background};
        position: relative;
      ">
        ${this.renderGallery(travelName, photos, layout)}
        <div style="
          position: absolute;
          bottom: 15mm;
          right: 25mm;
          font-size: 12pt;
          color: ${colors.textMuted};
          font-weight: 500;
        ">${pageNumber}</div>
      </section>
    `;
  }

  private renderGallery(travelName: string, photos: GalleryPhoto[], layout: GalleryLayout): string {
    const visiblePhotos = photos.slice(0, 9);
    const gridStyle =
      layout === 'mosaic'
        ? 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm;'
        : layout === 'collage'
          ? 'position: relative; height: 220mm;'
          : layout === 'dynamic'
            ? 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm;'
            : 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm;';

    return `
      <div style="margin-bottom: 15mm; text-align: center;">
        <h2 style="margin: 0;">Фотогалерея</h2>
        <div style="margin-top: 4mm;">${escapeHtml(travelName)}</div>
      </div>
      <div style="${gridStyle}">
        ${visiblePhotos.map((photo, index) => this.renderPhoto(photo, index, layout)).join('')}
      </div>
    `;
  }

  private renderPhoto(photo: GalleryPhoto, index: number, layout: GalleryLayout): string {
    const { colors } = this.theme;
    const rotate = layout === 'polaroid' ? `transform: rotate(${index % 2 === 0 ? '-1.4deg' : '1.3deg'});` : '';
    const collageStyle = layout === 'collage'
      ? `position: absolute; top: ${(index % 3) * 40}mm; left: ${(index % 3) * 28}mm; width: 58mm; height: 58mm;`
      : '';
    const mosaicStyle = layout === 'mosaic'
      ? `grid-column: ${index === 0 ? 'span 2' : 'span 1'}; grid-row: ${index === 0 ? 'span 2' : 'span 1'};`
      : '';
    const dynamicStyle = layout === 'dynamic' && index === 0
      ? 'grid-column: span 2; grid-row: span 2;'
      : '';
    const label = photo.caption || (layout === 'polaroid' ? `Фото ${index + 1}` : '');

    return `
      <div style="
        ${collageStyle}
        ${mosaicStyle}
        ${dynamicStyle}
        ${rotate}
        ${layout === 'polaroid' ? 'padding: 4mm 4mm 8mm 4mm; background: #fff;' : ''}
        aspect-ratio: 1;
        overflow: hidden;
        border-radius: 8px;
        position: relative;
        background: ${colors.surfaceAlt};
        box-shadow: ${this.theme.blocks.shadow};
      ">
        ${buildContainImageMarkup({
          src: photo.url,
          alt: photo.caption || `Gallery photo ${index + 1}`,
          height: '100%',
          background: colors.surfaceAlt,
          filterStyle: this.theme.imageFilter ? `filter: ${this.theme.imageFilter};` : '',
          backdropMode: 'blur',
        })}
        ${label ? `
          <div style="
            padding: 3mm 2mm 0 2mm;
            font-size: 10pt;
            text-align: center;
            color: ${colors.text};
          ">${escapeHtml(label)}</div>
        ` : ''}
      </div>
    `;
  }
}
