// src/services/pdf-export/generators/pages/TocPageGenerator.ts
// Генератор оглавления

import type { PdfThemeConfig } from '../../themes/PdfThemeConfig';

export interface TocEntry {
  travel: {
    id: number | string;
    name: string;
    countryName?: string;
    year?: string | number;
    travel_image_thumb_small_url?: string;
  };
  pageNumber: number;
}

export class TocPageGenerator {
  constructor(private theme: PdfThemeConfig) {}

  /**
   * Генерирует HTML для оглавления
   */
  generate(entries: TocEntry[], pageNumber: number): string {
    const { colors, typography, spacing } = this.theme;

    return `
      <section class="pdf-page toc-page" style="
        padding: ${spacing.pagePadding};
        background: ${colors.background};
      ">
        ${this.renderHeader()}
        ${this.renderEntries(entries)}
        ${this.renderPageNumber(pageNumber)}
      </section>
    `;
  }

  private renderHeader(): string {
    const { colors, typography } = this.theme;
    return `
      <div style="
        text-align: center;
        margin-bottom: 20mm;
        padding-bottom: 10mm;
        border-bottom: 3px solid ${colors.accent};
      ">
        <h2 style="
          font-size: ${typography.h2.size};
          font-weight: ${typography.h2.weight};
          margin: 0;
          color: ${colors.text};
          font-family: ${typography.headingFont};
        ">Оглавление</h2>
      </div>
    `;
  }

  private renderEntries(entries: TocEntry[]): string {
    return `
      <div style="
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12mm;
        margin-bottom: 15mm;
      ">
        ${entries.map((entry, index) => this.renderEntry(entry, index)).join('')}
      </div>
    `;
  }

  private renderEntry(entry: TocEntry, index: number): string {
    const { colors, typography } = this.theme;
    const { travel, pageNumber } = entry;

    return `
      <div style="
        break-inside: avoid;
        display: flex;
        gap: 8mm;
        padding: 6mm;
        background: ${colors.surface};
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      ">
        ${travel.travel_image_thumb_small_url ? `
          <div style="
            width: 20mm;
            height: 20mm;
            flex-shrink: 0;
            border-radius: 6px;
            overflow: hidden;
            background: ${colors.surfaceAlt};
          ">
            <img
              src="${this.escapeHtml(travel.travel_image_thumb_small_url)}"
              alt="${this.escapeHtml(travel.name)}"
              style="
                width: 100%;
                height: 100%;
                object-fit: cover;
              "
              crossorigin="anonymous"
            />
          </div>
        ` : ''}
        
        <div style="flex: 1; min-width: 0;">
          <div style="
            font-size: 12pt;
            font-weight: 600;
            color: ${colors.text};
            margin-bottom: 2mm;
            font-family: ${typography.headingFont};
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          ">
            ${index + 1}. ${this.escapeHtml(travel.name)}
          </div>
          
          <div style="
            font-size: 10pt;
            color: ${colors.textSecondary};
            font-family: ${typography.bodyFont};
          ">
            ${travel.countryName || '—'} • ${travel.year || '—'}
          </div>
          
          <div style="
            font-size: 9pt;
            color: ${colors.textMuted};
            margin-top: 2mm;
            font-family: ${typography.bodyFont};
          ">
            стр. ${pageNumber}
          </div>
        </div>
      </div>
    `;
  }

  private renderPageNumber(pageNumber: number): string {
    const { colors } = this.theme;
    return `
      <div style="
        position: absolute;
        bottom: 15mm;
        right: 25mm;
        font-size: 12pt;
        color: ${colors.textMuted};
        font-weight: 500;
      ">${pageNumber}</div>
    `;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
