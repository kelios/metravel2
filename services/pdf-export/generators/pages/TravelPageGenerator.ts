// src/services/pdf-export/generators/pages/TravelPageGenerator.ts
// Legacy compatibility adapter for the old pages/* API.

import type { PdfThemeConfig } from '../../themes/PdfThemeConfig';
import { escapeHtml } from '../../utils/htmlUtils';
import type { TravelForBook } from '@/types/pdf-export';
import { formatDays } from '../../utils/pluralize';
import { renderTravelPhotoPageMarkup } from '../v2/runtime/travelPhotoPage';
import { renderPdfIcon } from '../v2/runtime/pdfVisualHelpers';

export type PhotoPageLayout = 'full-bleed' | 'framed' | 'split';

export interface TravelPageOptions {
  qrCode?: string;
  showMetadata?: boolean;
  showRating?: boolean;
  photoLayout?: PhotoPageLayout;
}

export class TravelPageGenerator {
  constructor(private theme: PdfThemeConfig) {}

  generateSpread(
    travel: TravelForBook,
    pageNumber: number,
    options: TravelPageOptions = {}
  ): string {
    return `${this.generatePhotoPage(travel, pageNumber, options.photoLayout)}\n${this.generateContentPage(travel, pageNumber + 1, options)}`;
  }

  generatePhotoPage(
    travel: TravelForBook,
    pageNumber: number,
    layout: PhotoPageLayout = 'full-bleed'
  ): string {
    return renderTravelPhotoPageMarkup({
      travel,
      pageNumber,
      theme: this.theme,
      layout,
      buildSafeImageUrl: (url) => url || undefined,
      escapeHtml,
      formatDays,
      buildContainImage: (src, alt, height, opts) => `
        <div style="position: relative; width: 100%; height: ${height}; background: ${opts?.onerrorBg || '#f3f4f6'};">
          <img
            src="${escapeHtml(src)}"
            alt="${escapeHtml(alt)}"
            style="width: 100%; height: ${height}; object-fit: contain; display: block;"
            crossorigin="anonymous"
          />
        </div>
      `,
      getImageFilterStyle: () => (this.theme.imageFilter ? `filter: ${this.theme.imageFilter};` : ''),
    });
  }

  generateContentPage(
    travel: TravelForBook,
    pageNumber: number,
    options: TravelPageOptions = {}
  ): string {
    const { colors, spacing, typography } = this.theme;
    const metaItems = options.showMetadata
      ? [travel.countryName, travel.year, travel.number_days ? formatDays(travel.number_days) : null].filter(Boolean)
      : [];

    return `
      <section class="pdf-page travel-content-page" style="
        padding: ${spacing.pagePadding};
        background: ${colors.background};
        position: relative;
      ">
        <div style="
          margin-bottom: ${spacing.sectionSpacing};
          break-inside: avoid;
          page-break-inside: avoid;
        ">
          <h1 style="
            margin: 0 0 4mm 0;
            color: ${colors.text};
            font-size: ${typography.h1.size};
            font-weight: ${typography.h1.weight};
            line-height: ${typography.h1.lineHeight};
            font-family: ${typography.headingFont};
            overflow-wrap: anywhere;
            word-break: break-word;
            hyphens: auto;
          ">${escapeHtml(travel.name)}</h1>
          ${metaItems.length ? `
            <div style="
              display: flex;
              flex-wrap: wrap;
              gap: 6px;
              margin-bottom: 6mm;
              overflow-wrap: anywhere;
              word-break: break-word;
              hyphens: auto;
            ">
              ${metaItems.map((item) => `
                <span style="
                  padding: 4px 10px;
                  border-radius: 999px;
                  background: ${colors.accentSoft};
                  color: ${colors.accentStrong};
                  font-size: ${typography.caption.size};
                  font-family: ${typography.bodyFont};
                ">${escapeHtml(String(item))}</span>
              `).join('')}
            </div>
          ` : ''}
        </div>
        ${this.renderSection('Описание', travel.description, 'pen')}
        ${this.renderSection('Рекомендации', travel.recommendation, 'bulb')}
        ${this.renderSection('Понравилось', travel.plus, 'thumbs-up')}
        ${this.renderSection('Не понравилось', travel.minus, 'thumbs-down')}
        ${options.qrCode ? `
          <div style="
            margin-top: ${spacing.sectionSpacing};
            padding: 8mm;
            border-radius: ${this.theme.blocks.borderRadius};
            background: ${colors.surface};
            border: ${this.theme.blocks.borderWidth} solid ${colors.border};
            width: fit-content;
            page-break-inside: avoid;
          ">
            <img
              src="${escapeHtml(options.qrCode)}"
              alt="QR код"
              style="width: 28mm; height: 28mm; display: block;"
            />
          </div>
        ` : ''}
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

  private renderSection(title: string, rawText: string | null | undefined, icon: Parameters<typeof renderPdfIcon>[0]): string {
    if (!rawText) return '';
    const { colors, spacing, typography } = this.theme;
    const paragraphs = rawText
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);

    return `
      <div style="margin-bottom: ${spacing.sectionSpacing};">
        <div style="
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: ${spacing.elementSpacing};
          padding-bottom: 8px;
          border-bottom: 2px solid ${colors.accentSoft};
        ">
          ${renderPdfIcon(icon, colors.text, 20)}
          <h2 style="
            font-size: ${typography.h2.size};
            font-weight: ${typography.h2.weight};
            color: ${colors.accent};
            margin: 0;
            font-family: ${typography.headingFont};
          ">${title}</h2>
        </div>
        <div style="
          overflow-wrap: anywhere;
          word-break: break-word;
          hyphens: auto;
          page-break-inside: avoid;
        ">
          ${paragraphs.map((paragraph) => `
            <p style="
              margin: 0 0 4mm 0;
              color: ${colors.text};
              font-size: ${typography.body.size};
              line-height: ${typography.body.lineHeight};
              font-family: ${typography.bodyFont};
            ">${escapeHtml(paragraph)}</p>
          `).join('')}
        </div>
      </div>
    `;
  }
}
