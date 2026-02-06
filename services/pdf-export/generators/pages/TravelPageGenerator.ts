// src/services/pdf-export/generators/pages/TravelPageGenerator.ts
// Генератор разворота путешествия (фото + контент)

import type { PdfThemeConfig } from '../../themes/PdfThemeConfig';
import type { TravelForBook } from '@/types/pdf-export';

export type PhotoPageLayout = 'full-bleed' | 'framed' | 'split';

export interface TravelPageOptions {
  qrCode?: string;
  showMetadata?: boolean;
  showRating?: boolean;
  photoLayout?: PhotoPageLayout;
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
    const layout = options.photoLayout || 'full-bleed';
    return `
      ${this.generatePhotoPage(travel, pageNumber, layout)}
      ${this.generateContentPage(travel, pageNumber + 1, options)}
    `;
  }

  /**
   * Генерирует левую страницу с большим фото
   */
  generatePhotoPage(
    travel: TravelForBook,
    pageNumber: number,
    layout: PhotoPageLayout = 'full-bleed'
  ): string {
    switch (layout) {
      case 'framed':
        return this.generateFramedPhotoPage(travel, pageNumber);
      case 'split':
        return this.generateSplitPhotoPage(travel, pageNumber);
      case 'full-bleed':
      default:
        return this.generateFullBleedPhotoPage(travel, pageNumber);
    }
  }

  /**
   * Layout 1: Full Bleed (текущий стиль)
   */
  private generateFullBleedPhotoPage(travel: TravelForBook, pageNumber: number): string {
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
   * Layout 2: Framed - фото в рамке с подписью под ним
   */
  private generateFramedPhotoPage(travel: TravelForBook, pageNumber: number): string {
    const { colors, typography } = this.theme;
    const imageUrl = this.getMainImage(travel);

    return `
      <section class="pdf-page travel-photo-page" style="
        padding: 20mm;
        background: ${colors.surfaceAlt || colors.background};
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: center;
      ">
        <div style="
          width: 100%;
          height: 200mm;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 10px 40px rgba(0,0,0,0.15);
          margin-bottom: 15mm;
        ">
          <img
            src="${this.escapeHtml(imageUrl)}"
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
        
        <div style="
          padding: 12mm;
          background: ${colors.surface};
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        ">
          <h2 style="
            margin: 0;
            color: ${colors.text};
            font-size: ${typography.h2.size};
            font-weight: ${typography.h2.weight};
            font-family: ${typography.headingFont};
          ">${this.escapeHtml(travel.name)}</h2>
          <div style="
            color: ${colors.textMuted};
            margin-top: 4mm;
            font-size: 12pt;
            font-family: ${typography.bodyFont};
          ">
            ${travel.countryName || ''}${travel.countryName && travel.year ? ' • ' : ''}${travel.year || ''}
          </div>
        </div>
        
        ${this.renderPageNumber(pageNumber, 'left')}
      </section>
    `;
  }

  /**
   * Layout 3: Split - фото 70% + цветной блок 30%
   */
  private generateSplitPhotoPage(travel: TravelForBook, pageNumber: number): string {
    const { colors, typography } = this.theme;
    const imageUrl = this.getMainImage(travel);

    return `
      <section class="pdf-page travel-photo-page" style="
        padding: 0;
        display: flex;
        flex-direction: column;
        position: relative;
        overflow: hidden;
      ">
        <div style="flex: 7; overflow: hidden; position: relative;">
          <img
            src="${this.escapeHtml(imageUrl)}"
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
        
        <div style="
          flex: 3;
          background: linear-gradient(135deg, ${colors.accent}, ${colors.accentStrong || colors.accent});
          padding: 20mm;
          display: flex;
          flex-direction: column;
          justify-content: center;
          color: ${colors.cover.text || '#ffffff'};
        ">
          <h2 style="
            font-size: 24pt;
            margin: 0 0 6mm 0;
            font-weight: ${typography.h2.weight};
            font-family: ${typography.headingFont};
          ">${this.escapeHtml(travel.name)}</h2>
          
          <div style="
            font-size: 14pt;
            opacity: 0.9;
            font-family: ${typography.bodyFont};
          ">
            ${travel.countryName || ''}${travel.countryName && travel.year ? ' • ' : ''}${travel.year || ''}
          </div>
          
          ${travel.number_days ? `
            <div style="
              font-size: 12pt;
              opacity: 0.8;
              margin-top: 6mm;
              font-family: ${typography.bodyFont};
            ">
              ${travel.number_days} ${this.getDaysLabel(travel.number_days)}
            </div>
          ` : ''}
        </div>
        
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
            object-fit: contain;
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
    const { typography, colors } = this.theme;
    const highlights = [];

    if (travel.plus) {
      const plusItems = this.parseListString(travel.plus);
      if (plusItems.length > 0) {
        highlights.push({
          title: 'Понравилось',
          items: plusItems,
          bgColor: colors.tipBlock?.background || '#f0fdf4',
          borderColor: colors.tipBlock?.border || '#22c55e',
          textColor: colors.tipBlock?.text || '#14532d',
          iconColor: colors.tipBlock?.icon || '#22c55e',
        });
      }
    }

    if (travel.minus) {
      const minusItems = this.parseListString(travel.minus);
      if (minusItems.length > 0) {
        highlights.push({
          title: 'Не понравилось',
          items: minusItems,
          bgColor: colors.dangerBlock?.background || '#fef2f2',
          borderColor: colors.dangerBlock?.border || '#ef4444',
          textColor: colors.dangerBlock?.text || '#7f1d1d',
          iconColor: colors.dangerBlock?.icon || '#ef4444',
        });
      }
    }

    if (travel.recommendation) {
      const recItems = this.parseListString(travel.recommendation);
      if (recItems.length > 0) {
        highlights.push({
          title: 'Рекомендации',
          items: recItems,
          bgColor: colors.infoBlock?.background || '#eff6ff',
          borderColor: colors.infoBlock?.border || '#3b82f6',
          textColor: colors.infoBlock?.text || '#1e40af',
          iconColor: colors.infoBlock?.icon || '#3b82f6',
        });
      }
    }

    if (highlights.length === 0) return '';

    // Если есть и плюсы и минусы, показываем в две колонки
    const hasPlusAndMinus = travel.plus && travel.minus;
    
    if (hasPlusAndMinus) {
      return `
        <div style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8mm;
          margin-bottom: 10mm;
        ">
          ${highlights.slice(0, 2).map(section => this.renderHighlightCard(section, typography)).join('')}
        </div>
        ${highlights.length > 2 ? highlights.slice(2).map(section => this.renderHighlightCard(section, typography)).join('') : ''}
      `;
    }

    return `
      <div style="margin-bottom: 16mm;">
        ${highlights.map(section => this.renderHighlightCard(section, typography)).join('')}
      </div>
    `;
  }

  private renderHighlightCard(section: any, typography: any): string {
    return `
      <div style="
        background: ${section.bgColor};
        border-left: 4px solid ${section.borderColor};
        padding: 10mm;
        border-radius: 8px;
        margin-bottom: 8mm;
        break-inside: avoid;
        page-break-inside: avoid;
      ">
        <h3 style="
          font-size: 13pt;
          font-weight: 600;
          margin: 0 0 6mm 0;
          color: ${section.textColor};
          font-family: ${typography.headingFont};
        ">${section.title}</h3>
        <ul style="
          margin: 0;
          padding-left: 5mm;
          list-style: none;
        ">
          ${section.items.map((item: string) => `
            <li style="
              margin-bottom: 3mm;
              font-size: 11pt;
              line-height: 1.6;
              color: ${section.textColor};
              font-family: ${typography.bodyFont};
              position: relative;
              padding-left: 6mm;
            ">
              <span style="
                position: absolute;
                left: 0;
                color: ${section.iconColor};
                font-weight: 700;
              ">•</span>
              ${this.escapeHtml(item)}
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  private renderQRCode(qrCodeDataUrl: string): string {
    const { colors, typography } = this.theme;

    return `
      <div style="
        background: ${colors.surface};
        padding: 10mm;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 8mm;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        margin-top: 10mm;
        break-inside: avoid;
        page-break-inside: avoid;
      ">
        <img
          src="${this.escapeHtml(qrCodeDataUrl)}"
          alt="QR Code"
          style="
            width: 40mm;
            height: 40mm;
            border-radius: 8px;
            flex-shrink: 0;
          "
        />
        <div style="flex: 1;">
          <div style="
            font-size: 12pt;
            font-weight: 600;
            margin-bottom: 3mm;
            color: ${colors.text};
            font-family: ${typography.headingFont};
          ">Подробнее онлайн</div>
          <div style="
            font-size: 10pt;
            color: ${colors.textMuted};
            line-height: 1.5;
            font-family: ${typography.bodyFont};
          ">
            Отсканируйте QR-код<br/>
            для просмотра полной<br/>
            версии путешествия
          </div>
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
