// src/services/pdf-export/generators/pages/CoverPageGenerator.ts
// Генератор обложки книги

import type { PdfThemeConfig } from '../../themes/PdfThemeConfig';

export interface CoverPageData {
  title: string;
  subtitle?: string;
  userName: string;
  travelCount: number;
  yearRange?: string;
  coverImage?: string;
  quote?: {
    text: string;
    author: string;
  };
}

export class CoverPageGenerator {
  constructor(private theme: PdfThemeConfig) {}

  /**
   * Генерирует HTML для обложки
   */
  generate(data: CoverPageData): string {
    const { colors } = this.theme;
    const travelLabel = this.getTravelLabel(data.travelCount);
    const safeCoverImage = this.buildSafeImageUrl(data.coverImage);

    const background = safeCoverImage
      ? `url('${this.escapeHtml(safeCoverImage)}')`
      : `linear-gradient(135deg, ${colors.cover.backgroundGradient[0]} 0%, ${colors.cover.backgroundGradient[1]} 100%)`;

    return `
      <section class="pdf-page cover-page" style="
        padding: 0;
        height: 285mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        color: ${colors.cover.text};
        background: ${background};
        background-size: cover;
        background-position: center;
        position: relative;
        overflow: hidden;
      ">
        ${safeCoverImage ? `
          <div style="
            position: absolute;
            inset: 0;
            background:
              linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.10) 45%, rgba(0,0,0,0.60) 100%);
            z-index: 1;
          "></div>
        ` : ''}

        <div style="
          padding: 26mm 24mm 0 24mm;
          text-align: center;
          position: relative;
          z-index: 2;
        ">
          ${this.renderTitle(data.title)}
          ${data.subtitle ? this.renderSubtitle(data.subtitle) : ''}
          ${this.renderUserName(data.userName)}
          ${data.quote ? this.renderQuote(data.quote) : ''}
        </div>

        <div style="
          padding: 0 24mm 24mm 24mm;
          position: relative;
          z-index: 2;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 10mm;
        ">
          <div style="
            font-size: 11pt;
            letter-spacing: 0.04em;
            color: rgba(255,255,255,0.85);
            font-weight: 500;
            overflow-wrap: anywhere;
            word-break: break-word;
            hyphens: auto;
          ">
            ${this.escapeHtml(String(data.travelCount))} ${travelLabel}${data.yearRange ? ` • ${this.escapeHtml(data.yearRange)}` : ''}
          </div>
          <div style="
            font-size: 10pt;
            opacity: 0.7;
            font-weight: 500;
            letter-spacing: 0.08em;
          ">MeTravel</div>
        </div>

        <div style="
          position: absolute;
          bottom: 10mm;
          left: 24mm;
          font-size: 9pt;
          opacity: 0.7;
          z-index: 2;
        ">${this.renderDate()}</div>
      </section>
    `;
  }

  private renderDecorativeElements(): string {
    return `
      <div style="
        position: absolute;
        top: 20mm;
        left: 20mm;
        width: 60mm;
        height: 60mm;
        border: 2px solid rgba(255,255,255,0.2);
        border-radius: 50%;
        opacity: 0.3;
      "></div>
      <div style="
        position: absolute;
        top: 30mm;
        right: 30mm;
        width: 40mm;
        height: 40mm;
        border: 2px solid rgba(255,255,255,0.15);
        border-radius: 50%;
        opacity: 0.2;
      "></div>
    `;
  }

  private renderSubtitle(subtitle: string): string {
    const { typography } = this.theme;
    return `
      <div style="
        font-size: 16pt;
        letter-spacing: 0.02em;
        color: rgba(255,255,255,0.88);
        margin-top: 6mm;
        font-family: ${typography.bodyFont};
      ">${this.escapeHtml(subtitle)}</div>
    `;
  }

  private renderTitle(title: string): string {
    const { typography } = this.theme;
    return `
      <h1 style="
        font-size: ${typography.h1.size};
        font-weight: ${typography.h1.weight};
        line-height: ${typography.h1.lineHeight};
        margin: 0;
        text-shadow: 0 10px 30px rgba(0,0,0,0.35);
        font-family: ${typography.headingFont};
        overflow-wrap: anywhere;
        word-break: break-word;
        hyphens: auto;
      ">${this.escapeHtml(title)}</h1>
    `;
  }

  private renderStats(count: number, label: string, yearRange?: string): string {
    const { colors } = this.theme;
    return `
      <div style="display: flex; gap: 24mm; align-items: center; margin-bottom: 16mm;">
        <div>
          <div style="font-size: 32pt; font-weight: 800; color: ${colors.accent};">
            ${count}
          </div>
          <div style="font-size: 13pt; text-transform: uppercase; letter-spacing: 0.08em;">
            ${label}
          </div>
        </div>
        ${yearRange ? `
          <div style="border-left: 1px solid rgba(255,255,255,0.4); padding-left: 24mm;">
            <div style="font-size: 32pt; font-weight: 700; color: ${colors.accent};">
              ${yearRange}
            </div>
            <div style="font-size: 13pt; letter-spacing: 0.08em;">годы</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderUserName(userName: string): string {
    const { typography } = this.theme;
    return `
      <div style="
        font-size: 12pt;
        opacity: 0.85;
        margin-top: 10mm;
        font-family: ${typography.bodyFont};
      ">${this.escapeHtml(userName)}</div>
    `;
  }

  private renderDate(): string {
    const { typography } = this.theme;
    const dateStr = new Date().toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return `
      <span style="
        font-size: 9pt;
        opacity: 0.75;
        font-family: ${typography.bodyFont};
      ">Создано ${dateStr}</span>
    `;
  }

  private renderQuote(quote: { text: string; author: string }): string {
    return `
      <div style="
        margin-top: 14mm;
        max-width: 120mm;
        margin-left: auto;
        margin-right: auto;
        font-style: italic;
        opacity: 0.85;
      ">
        <div style="font-size: 12pt; margin-bottom: 5mm;">
          "${this.escapeHtml(quote.text)}"
        </div>
        <div style="font-size: 10pt; opacity: 0.7;">
          — ${this.escapeHtml(quote.author)}
        </div>
      </div>
    `;
  }

  private getTravelLabel(count: number): string {
    if (count === 1) return 'путешествие';
    if (count >= 2 && count <= 4) return 'путешествия';
    return 'путешествий';
  }

  private buildSafeImageUrl(url?: string): string | undefined {
    if (!url) return undefined;
    // Здесь можно добавить логику проксирования изображений
    return url;
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
