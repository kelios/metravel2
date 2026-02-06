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
    const { colors, spacing } = this.theme;

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
        ${entries.map((entry) => this.renderEntry(entry)).join('')}
      </div>
    `;
  }

  private renderEntry(entry: TocEntry): string {
    const { colors, typography } = this.theme;
    const { travel, pageNumber } = entry;

    return `
      <div style="
        break-inside: avoid;
        page-break-inside: avoid;
        display: flex;
        gap: 6mm;
        padding: 8mm;
        background: ${colors.surface};
        border-radius: 12px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.08);
        transition: all 0.2s;
      ">
        ${travel.travel_image_thumb_small_url ? `
          <div style="
            width: 35mm;
            height: 35mm;
            flex-shrink: 0;
            border-radius: 8px;
            overflow: hidden;
            background: ${colors.surfaceAlt};
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          ">
            <img
              src="${this.escapeHtml(travel.travel_image_thumb_small_url)}"
              alt="${this.escapeHtml(travel.name)}"
              style="
                width: 100%;
                height: 100%;
                object-fit: contain;
                ${this.theme.imageFilter ? `filter: ${this.theme.imageFilter};` : ''}
              "
              crossorigin="anonymous"
            />
          </div>
        ` : ''}

        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
          <h3 style="
            font-size: 14pt;
            font-weight: 600;
            margin: 0 0 4mm 0;
            color: ${colors.text};
            font-family: ${typography.headingFont};
            overflow-wrap: anywhere;
            word-break: break-word;
            hyphens: auto;
            line-height: 1.3;
          ">${this.escapeHtml(travel.name)}</h3>

          <div style="
            font-size: 11pt;
            color: ${colors.textMuted};
            margin-bottom: auto;
            font-family: ${typography.bodyFont};
          ">
            ${travel.countryName || ''}${travel.countryName && travel.year ? ' • ' : ''}${travel.year || ''}
          </div>

          <div style="
            display: inline-flex;
            align-items: center;
            gap: 4mm;
            font-size: 12pt;
            font-weight: 600;
            color: ${colors.accent};
            margin-top: 4mm;
          ">
            <span>стр.</span>
            <span style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              min-width: 28px;
              height: 28px;
              padding: 0 6px;
              background: ${colors.accentSoft};
              border-radius: 6px;
              font-weight: 700;
              color: ${colors.accentStrong};
            ">${pageNumber}</span>
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
