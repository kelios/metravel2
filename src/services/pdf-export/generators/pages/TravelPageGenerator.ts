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
      ">
        <h2 style="
          font-size: 28pt;
          font-weight: 700;
          margin: 0 0 8mm 0;
          text-shadow: 0 2px 8px rgba(0,0,0,0.3);
          font-family: ${typography.headingFont};
        ">${this.escapeHtml(travel.name)}</h2>
        
        <div style="
          font-size: 14pt;
          opacity: 0.95;
          font-family: ${typography.bodyFont};
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
        ">${this.escapeHtml(travel.name)}</h1>
      </div>
    `;
  }

  private renderMetadata(travel: TravelForBook): string {
    const { colors, typography } = this.theme;
    const metadata = [];

    if (travel.countryName) {
      metadata.push({ icon: '📍', label: 'Страна', value: travel.countryName });
    }
    if (travel.year) {
      metadata.push({ icon: '📅', label: 'Год', value: String(travel.year) });
    }
    if (travel.number_days) {
      metadata.push({ icon: '⏱️', label: 'Длительность', value: `${travel.number_days} ${this.getDaysLabel(travel.number_days)}` });
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
      ">
        ${metadata.map(item => `
          <div>
            <div style="
              font-size: 10pt;
              color: ${colors.textMuted};
              margin-bottom: 3mm;
              font-family: ${typography.bodyFont};
            ">
              ${item.icon} ${item.label}
            </div>
            <div style="
              font-size: 13pt;
              font-weight: 600;
              color: ${colors.text};
              font-family: ${typography.bodyFont};
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
          icon: '✨',
          items: plusItems,
          color: colors.accent,
        });
      }
    }

    if (travel.minus) {
      const minusItems = this.parseListString(travel.minus);
      if (minusItems.length > 0) {
        highlights.push({
          title: 'Не понравилось',
          icon: '⚠️',
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
          icon: '💡',
          items: recItems,
          color: colors.accent,
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
            ">
              ${section.icon} ${section.title}
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
          src="${qrCodeDataUrl}"
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
}
