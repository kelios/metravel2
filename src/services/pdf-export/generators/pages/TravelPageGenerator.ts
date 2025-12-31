// src/services/pdf-export/generators/pages/TravelPageGenerator.ts
// Генератор разворота путешествия (фото + контент)

import type { PdfThemeConfig } from '../../themes/PdfThemeConfig';
import type { TravelForBook } from '@/src/types/pdf-export';

export interface TravelPageOptions {
  qrCode?: string;
  showMetadata?: boolean;
  showRating?: boolean;
}

export class TravelPageGenerator {
  constructor(private theme: PdfThemeConfig) {}

  /**
   * Генерирует разворот путешествия (2 страницы: фото + контент)
   */
  generateSpread(
    travel: TravelForBook,
    pageNumber: number,
    options: TravelPageOptions = {}
  ): string {
    return `
      ${this.generatePhotoPage(travel, pageNumber)}
      ${this.generateContentPage(travel, pageNumber + 1, options)}
    `;
  }

  /**
   * Генерирует левую страницу с большим фото
   */
  generatePhotoPage(travel: TravelForBook, pageNumber: number): string {
    const { colors } = this.theme;
    const imageUrl = this.getMainImage(travel);

    return `
      <section class="pdf-page travel-photo-page" style="
        padding: 0;
        background: ${colors.surface};
        position: relative;
        overflow: hidden;
      ">
        ${this.renderPhotoImage(imageUrl)}
        ${this.renderPhotoOverlay(travel)}
        ${this.renderPageNumber(pageNumber, 'left')}
      </section>
    `;
  }

  /**
   * Генерирует правую страницу с контентом
   */
  generateContentPage(
    travel: TravelForBook,
    pageNumber: number,
    options: TravelPageOptions = {}
  ): string {
    const { colors, spacing } = this.theme;

    return `
      <section class="pdf-page travel-content-page" style="
        padding: ${spacing.pagePadding};
        background: ${colors.background};
        position: relative;
      ">
        ${this.renderHeader(travel)}
        ${options.showMetadata !== false ? this.renderMetadata(travel) : ''}
        ${this.renderDescription(travel)}
        ${this.renderHighlights(travel)}
        ${options.qrCode ? this.renderQRCode(options.qrCode) : ''}
        ${this.renderPageNumber(pageNumber, 'right')}
      </section>
    `;
  }

  private renderPhotoImage(imageUrl: string): string {
    return `
      <div style="
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
      ">
        <img
          src="${this.escapeHtml(imageUrl)}"
          alt="Travel photo"
          style="
            width: 100%;
            height: 100%;
            object-fit: cover;
            ${this.theme.imageFilter ? `filter: ${this.theme.imageFilter};` : ''}
          "
          crossorigin="anonymous"
        />
      </div>
    `;
  }

  private renderPhotoOverlay(travel: TravelForBook): string {
    const { typography } = this.theme;

    return `
      <div style="
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 30mm 25mm;
        background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%);
        color: #ffffff;
        page-break-inside: avoid;
      ">
        <h2 style="
          font-size: 28pt;
          font-weight: 700;
          margin: 0 0 8mm 0;
          text-shadow: 0 2px 8px rgba(0,0,0,0.3);
          font-family: ${typography.headingFont};
          overflow-wrap: anywhere;
          word-break: break-word;
          hyphens: auto;
        ">${this.escapeHtml(travel.name)}</h2>
        
        <div style="
          font-size: 14pt;
          opacity: 0.95;
          font-family: ${typography.bodyFont};
          overflow-wrap: anywhere;
          word-break: break-word;
          hyphens: auto;
        ">
          ${travel.countryName || ''}${travel.countryName && travel.year ? ' • ' : ''}${travel.year || ''}
        </div>
      </div>
    `;
  }

  private renderHeader(travel: TravelForBook): string {
    const { colors, typography } = this.theme;

    return `
      <div style="margin-bottom: 20mm;">
        <h1 style="
          font-size: ${typography.h1.size};
          font-weight: ${typography.h1.weight};
          line-height: ${typography.h1.lineHeight};
          margin: 0 0 8mm 0;
          color: ${colors.text};
          font-family: ${typography.headingFont};
          overflow-wrap: anywhere;
          word-break: break-word;
          hyphens: auto;
        ">${this.escapeHtml(travel.name)}</h1>
      </div>
    `;
  }

  private renderMetadata(travel: TravelForBook): string {
    const { colors, typography } = this.theme;
    const metadata = [];

    if (travel.countryName) {
      metadata.push({ icon: this.renderPdfIcon('pin', colors.textMuted, 11), label: 'Страна', value: travel.countryName });
    }
    if (travel.year) {
      metadata.push({ icon: this.renderPdfIcon('calendar', colors.textMuted, 11), label: 'Год', value: String(travel.year) });
    }
    if (travel.number_days) {
      metadata.push({ icon: this.renderPdfIcon('clock', colors.textMuted, 11), label: 'Длительность', value: `${travel.number_days} ${this.getDaysLabel(travel.number_days)}` });
    }

    if (metadata.length === 0) return '';

    return `
      <div style="
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12mm;
        margin-bottom: 16mm;
        padding: 12mm;
        background: ${colors.surface};
        border-radius: ${this.theme.blocks.borderRadius};
        border: ${this.theme.blocks.borderWidth} solid ${colors.border};
        break-inside: avoid;
        page-break-inside: avoid;
      ">
        ${metadata.map(item => `
          <div>
            <div style="
              font-size: 10pt;
              color: ${colors.textMuted};
              margin-bottom: 3mm;
              font-family: ${typography.bodyFont};
              display: inline-flex;
              align-items: center;
              gap: 6px;
            ">
              ${item.icon}<span>${item.label}</span>
            </div>
            <div style="
              font-size: 13pt;
              font-weight: 600;
              color: ${colors.text};
              font-family: ${typography.bodyFont};
              overflow-wrap: anywhere;
              word-break: break-word;
              hyphens: auto;
            ">
              ${this.escapeHtml(item.value)}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderDescription(travel: TravelForBook): string {
    const { colors, typography } = this.theme;

    if (!travel.description) return '';

    return `
      <div style="
        margin-bottom: 16mm;
        font-size: ${typography.body.size};
        line-height: ${typography.body.lineHeight};
        color: ${colors.text};
        font-family: ${typography.bodyFont};
      ">
        ${this.formatDescription(travel.description)}
      </div>
    `;
  }

  private renderHighlights(travel: TravelForBook): string {
    const { colors, typography } = this.theme;
    const highlights = [];

    if (travel.plus) {
      const plusItems = this.parseListString(travel.plus);
      if (plusItems.length > 0) {
        highlights.push({
          title: 'Понравилось',
          icon: this.renderPdfIcon('sparkle', colors.textMuted, 14),
          items: plusItems,
          color: colors.textMuted,
        });
      }
    }

    if (travel.minus) {
      const minusItems = this.parseListString(travel.minus);
      if (minusItems.length > 0) {
        highlights.push({
          title: 'Не понравилось',
          icon: this.renderPdfIcon('warning', colors.textMuted, 14),
          items: minusItems,
          color: colors.textMuted,
        });
      }
    }

    if (travel.recommendation) {
      const recItems = this.parseListString(travel.recommendation);
      if (recItems.length > 0) {
        highlights.push({
          title: 'Рекомендации',
          icon: this.renderPdfIcon('bulb', colors.textMuted, 14),
          items: recItems,
          color: colors.textMuted,
        });
      }
    }

    if (highlights.length === 0) return '';

    return `
      <div style="margin-bottom: 16mm;">
        ${highlights.map(section => `
          <div style="margin-bottom: 12mm;">
            <h3 style="
              font-size: ${typography.h3.size};
              font-weight: ${typography.h3.weight};
              margin: 0 0 6mm 0;
              color: ${section.color};
              font-family: ${typography.headingFont};
              display: flex;
              align-items: center;
              gap: 8px;
            ">
              ${section.icon}<span>${section.title}</span>
            </h3>
            <ul style="
              margin: 0;
              padding-left: 20px;
              list-style: none;
            ">
              ${section.items.map((item: string) => `
                <li style="
                  margin-bottom: 4mm;
                  font-size: ${typography.body.size};
                  line-height: ${typography.body.lineHeight};
                  color: ${colors.text};
                  font-family: ${typography.bodyFont};
                  position: relative;
                  padding-left: 8mm;
                ">
                  <span style="
                    position: absolute;
                    left: 0;
                    color: ${section.color};
                  ">•</span>
                  ${this.escapeHtml(item)}
                </li>
              `).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderQRCode(qrCodeDataUrl: string): string {
    const { colors, typography } = this.theme;

    return `
      <div style="
        position: absolute;
        bottom: 20mm;
        right: 20mm;
        text-align: center;
      ">
        <img
          src="${this.escapeHtml(qrCodeDataUrl)}"
          alt="QR Code"
          style="
            width: 25mm;
            height: 25mm;
            border: 2px solid ${colors.border};
            border-radius: 4px;
            background: #ffffff;
            padding: 2mm;
          "
        />
        <div style="
          margin-top: 3mm;
          font-size: 8pt;
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
        ">
          Подробнее
        </div>
      </div>
    `;
  }

  private renderPageNumber(pageNumber: number, position: 'left' | 'right'): string {
    const { colors } = this.theme;

    return `
      <div style="
        position: absolute;
        bottom: 15mm;
        ${position === 'left' ? 'left: 25mm;' : 'right: 25mm;'}
        font-size: 12pt;
        color: ${position === 'left' ? 'rgba(255,255,255,0.8)' : colors.textMuted};
        font-weight: 500;
      ">${pageNumber}</div>
    `;
  }

  private getMainImage(travel: TravelForBook): string {
    return (
      travel.travel_image_url ||
      travel.travel_image_thumb_url ||
      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="600"%3E%3Crect fill="%23f0f0f0" width="800" height="600"/%3E%3C/svg%3E'
    );
  }

  private formatDescription(description: string): string {
    // Базовое форматирование: разбиваем на параграфы
    return description
      .split('\n\n')
      .map(para => `<p style="margin: 0 0 12pt 0;">${this.escapeHtml(para)}</p>`)
      .join('');
  }

  private getDaysLabel(days: number): string {
    if (days === 1) return 'день';
    if (days >= 2 && days <= 4) return 'дня';
    return 'дней';
  }

  private parseListString(text: string): string[] {
    // Парсим строку со списком (разделитель: перенос строки или точка с запятой)
    return text
      .split(/[\n;]/)  
      .map(item => item.trim())
      .filter(item => item.length > 0);
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

  private renderPdfIcon(
    name: 'pin' | 'calendar' | 'clock' | 'bulb' | 'warning' | 'sparkle',
    color: string,
    sizePt: number
  ): string {
    const size = `${sizePt}pt`;
    const wrapperStyle = `
      width: ${size};
      height: ${size};
      display: inline-block;
      flex-shrink: 0;
    `;

    const svgStart = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${sizePt}" height="${sizePt}" fill="none" stroke="${this.escapeHtml(color)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`;
    const svgEnd = `</svg>`;

    const paths: Record<typeof name, string> = {
      pin: `<path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>`,
      calendar: `<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>`,
      clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>`,
      bulb: `<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12c.7.6 1 1.3 1 2v1h6v-1c0-.7.3-1.4 1-2a7 7 0 0 0-4-12z"/>`,
      warning: `<path d="M10.3 3.2 1.7 18a2 2 0 0 0 1.7 3h17.2a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>`,
      sparkle: `<path d="M12 2l1.6 5.2L19 9l-5.4 1.8L12 16l-1.6-5.2L5 9l5.4-1.8z"/>`,
    };

    return `
      <span style="${wrapperStyle}">${svgStart}${paths[name]}${svgEnd}</span>
    `;
  }
}
