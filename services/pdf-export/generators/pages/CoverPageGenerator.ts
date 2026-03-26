// src/services/pdf-export/generators/pages/CoverPageGenerator.ts
// Генератор обложки книги с улучшенным дизайном

import type { PdfThemeConfig } from '../../themes/PdfThemeConfig';
import { escapeHtml } from '../../utils/htmlUtils';
import { getTravelLabel } from '../../utils/pluralize';
import {
  analyzeImageBrightness,
  analyzeImageComposition,
  getOptimalTextPosition,
  getOptimalOverlayOpacity,
  getOptimalOverlayColor,
  getOptimalTextColor,
} from '@/utils/imageAnalysis';

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
  // Опциональные параметры для кастомизации
  textPosition?: 'top' | 'center' | 'bottom' | 'auto';
  overlayOpacity?: number;
  showDecorations?: boolean;
}

export class CoverPageGenerator {
  constructor(private theme: PdfThemeConfig) {}

  private getCoverTitleStyle(title: string): {
    fontSize: string;
    lineHeight: number;
    maxWidth: string;
    letterSpacing: string;
  } {
    const normalized = (title || '').trim();
    const length = normalized.length;

    if (length >= 100) {
      return {
        fontSize: '24pt',
        lineHeight: 1.08,
        maxWidth: '128mm',
        letterSpacing: '0',
      };
    }

    if (length >= 75) {
      return {
        fontSize: '27pt',
        lineHeight: 1.08,
        maxWidth: '124mm',
        letterSpacing: '0.01em',
      };
    }

    return {
      fontSize: '32pt',
      lineHeight: 1.08,
      maxWidth: '108mm',
      letterSpacing: '0.02em',
    };
  }

  /**
   * Генерирует HTML для обложки с умным затемнением
   */
  async generate(data: CoverPageData): Promise<string> {
    const { colors } = this.theme;
    const travelLabel = this.getTravelLabel(data.travelCount);
    const safeCoverImage = this.buildSafeImageUrl(data.coverImage);

    // Анализируем изображение для умного затемнения
    let brightness = 128;
    let composition = { topBusy: 0.5, centerBusy: 0.5, bottomBusy: 0.5 };
    let textPosition: 'top' | 'center' | 'bottom' = 'center';
    let overlayOpacity = 0.6;
    let overlayColor = 'rgba(0,0,0,';
    let textColor = colors.cover.text;

    if (safeCoverImage) {
      try {
        brightness = await analyzeImageBrightness(safeCoverImage);
        composition = await analyzeImageComposition(safeCoverImage);
        
        // Определяем оптимальные параметры
        textPosition = data.textPosition === 'auto' || !data.textPosition
          ? getOptimalTextPosition(composition)
          : data.textPosition;
        
        overlayOpacity = data.overlayOpacity ?? getOptimalOverlayOpacity(brightness);
        overlayColor = getOptimalOverlayColor(brightness);
        textColor = getOptimalTextColor(brightness);
      } catch (error) {
        console.warn('Image analysis failed, using defaults:', error);
      }
    }

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
        ${safeCoverImage ? this.renderSmartOverlay(overlayColor, overlayOpacity, textPosition) : ''}
        ${data.showDecorations !== false ? this.renderDecorativeElements() : ''}

        ${this.renderContent(data, textPosition, textColor, Boolean(safeCoverImage))}
        ${this.renderFooterRail(
          `${this.escapeHtml(String(data.travelCount))} ${travelLabel}${data.yearRange ? ` • ${this.escapeHtml(data.yearRange)}` : ''}`
        )}
      </section>
    `;
  }

  /**
   * Умный overlay с градиентом на основе позиции текста
   */
  private renderSmartOverlay(
    overlayColor: string,
    opacity: number,
    textPosition: 'top' | 'center' | 'bottom'
  ): string {
    let gradient = '';
    
    if (textPosition === 'top') {
      gradient = `linear-gradient(180deg, ${overlayColor}${opacity}) 0%, ${overlayColor}0.1) 50%, ${overlayColor}0.3) 100%)`;
    } else if (textPosition === 'bottom') {
      gradient = `linear-gradient(180deg, ${overlayColor}0.3) 0%, ${overlayColor}0.1) 50%, ${overlayColor}${opacity}) 100%)`;
    } else {
      gradient = `linear-gradient(180deg, ${overlayColor}0.4) 0%, ${overlayColor}0.1) 30%, ${overlayColor}0.1) 70%, ${overlayColor}0.4) 100%)`;
    }

    return `
      <div style="
        position: absolute;
        inset: 0;
        background: ${gradient};
        z-index: 1;
      "></div>
    `;
  }

  /**
   * Рендерит контент с адаптивной позицией
   */
  private renderContent(
    data: CoverPageData,
    textPosition: 'top' | 'center' | 'bottom',
    textColor: string,
    hasImage: boolean
  ): string {
    const justifyContent =
      textPosition === 'top' ? 'flex-start' : textPosition === 'bottom' ? 'flex-end' : 'center';
    const paddingTop = textPosition === 'top' ? '30mm' : '0';
    const paddingBottom = textPosition === 'bottom' ? '30mm' : '0';
    const panelBackground =
      hasImage
        ? textColor === '#000000'
          ? 'rgba(255,255,255,0.82)'
          : 'rgba(15,23,42,0.34)'
        : 'transparent';
    const panelBorder =
      textColor === '#000000'
        ? 'rgba(255,255,255,0.65)'
        : 'rgba(255,255,255,0.18)';
    const panelShadow = hasImage ? '0 18px 44px rgba(15,23,42,0.22)' : 'none';

    return `
      <div style="
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: ${justifyContent};
        padding: ${paddingTop} 24mm ${paddingBottom} 24mm;
        align-items: ${textPosition === 'center' ? 'center' : 'flex-start'};
        position: relative;
        z-index: 2;
      ">
        <div class="cover-story-panel" style="
          width: min(138mm, 100%);
          padding: ${hasImage ? '14mm 16mm 13mm 16mm' : '0'};
          border-radius: 22px;
          background: ${panelBackground};
          border: ${hasImage ? `1px solid ${panelBorder}` : 'none'};
          box-shadow: ${panelShadow};
          backdrop-filter: ${hasImage ? 'blur(10px)' : 'none'};
          -webkit-backdrop-filter: ${hasImage ? 'blur(10px)' : 'none'};
          text-align: left;
        ">
          ${this.renderTitle(data.title, textColor)}
          ${data.subtitle ? this.renderSubtitle(data.subtitle, textColor) : ''}
          ${this.renderUserName(data.userName, textColor)}
          ${data.quote ? this.renderQuote(data.quote, textColor) : ''}
        </div>
      </div>
    `;
  }

  /**
   * Декоративная рамка (без кругов — они не несут смысловой нагрузки)
   */
  private renderDecorativeElements(): string {
    return `
      <div style="
        position: absolute;
        inset: 14mm;
        border: 1.5px solid rgba(255,255,255,0.15);
        border-radius: 14px;
        pointer-events: none;
        z-index: 1;
      "></div>
      <div style="
        position: absolute;
        inset: 17mm;
        border: 0.5px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        pointer-events: none;
        z-index: 1;
      "></div>
    `;
  }

  private renderSubtitle(subtitle: string, textColor?: string): string {
    const { typography } = this.theme;
    const opacity = textColor === '#000000' ? '0.7' : '0.88';
    
    return `
      <div style="
        font-size: 13pt;
        letter-spacing: 0.02em;
        color: ${textColor || 'rgba(255,255,255,0.88)'};
        opacity: ${opacity};
        margin-top: 4mm;
        font-family: ${typography.bodyFont};
        max-width: 104mm;
        line-height: 1.55;
      ">${this.escapeHtml(subtitle)}</div>
    `;
  }

  private renderTitle(title: string, textColor?: string): string {
    const { typography, colors } = this.theme;
    const color = textColor || colors.cover.text;

    const safeTitle = (title || '').trim();
    if (!safeTitle) return '';
    const titleStyle = this.getCoverTitleStyle(safeTitle);
    
    return `
      <div style="
        width: 26mm;
        height: 2px;
        background: linear-gradient(90deg, ${this.theme.colors.accent}, ${this.theme.colors.accentStrong});
        border-radius: 999px;
        margin: 0 0 6mm 0;
      "></div>
      <h1 style="
        color: ${color};
        font-size: ${titleStyle.fontSize};
        font-weight: 800;
        line-height: ${titleStyle.lineHeight};
        margin: 0;
        text-shadow: 0 6px 18px rgba(15,23,42,0.2);
        letter-spacing: ${titleStyle.letterSpacing};
        font-family: ${typography.headingFont};
        overflow-wrap: break-word;
        word-break: normal;
        hyphens: auto;
        max-width: ${titleStyle.maxWidth};
        text-wrap: balance;
      ">${this.escapeHtml(safeTitle)}</h1>
    `;
  }

  private renderUserName(userName: string, textColor?: string): string {
    const { typography } = this.theme;
    return `
      <div style="
        margin-top: 8mm;
        display: flex;
        align-items: center;
        gap: 4mm;
      ">
        <div style="
          width: 16mm;
          height: 1px;
          background: ${textColor === '#000000' ? 'rgba(15,23,42,0.22)' : 'rgba(255,255,255,0.28)'};
        "></div>
        <div style="
          font-size: 11pt;
          color: ${textColor || 'rgba(255,255,255,0.85)'};
          opacity: 0.85;
          font-family: ${typography.bodyFont};
          letter-spacing: 0.04em;
          font-weight: 500;
        ">${this.escapeHtml(userName)}</div>
      </div>
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

  private renderQuote(quote: { text: string; author: string }, textColor?: string): string {
    return `
      <div style="
        margin-top: 11mm;
        max-width: 100%;
        font-style: italic;
        opacity: 0.85;
        color: ${textColor || 'rgba(255,255,255,0.85)'};
        padding: 8px 12px;
        background: ${textColor === '#000000' ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.08)'};
        border-radius: 14px;
        border-left: 2px solid ${textColor === '#000000' ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.24)'};
      ">
        <div style="font-size: 11pt; margin-bottom: 4mm; line-height: 1.55;">
          \u00AB${this.escapeHtml(quote.text)}\u00BB
        </div>
        <div style="font-size: 9pt; opacity: 0.7; letter-spacing: 0.04em;">
          \u2014 ${this.escapeHtml(quote.author)}
        </div>
      </div>
    `;
  }

  private renderFooterRail(metaLine: string): string {
    return `
      <div class="cover-footer-rail" style="
        margin: 0 24mm 16mm 24mm;
        padding: 8mm 10mm;
        position: relative;
        z-index: 2;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 10mm;
        border-radius: 18px;
        background: rgba(15,23,42,0.28);
        border: 1px solid rgba(255,255,255,0.12);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
      ">
        <div style="
          display: flex;
          flex-direction: column;
          gap: 2mm;
          min-width: 0;
        ">
          <div style="
            font-size: 8.5pt;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.62);
            font-weight: 600;
          ">Книга путешествий</div>
          <div style="
            font-size: 11pt;
            letter-spacing: 0.02em;
            color: rgba(255,255,255,0.92);
            font-weight: 500;
            overflow-wrap: anywhere;
            word-break: break-word;
            hyphens: auto;
          ">${metaLine}</div>
        </div>
        <div style="
          text-align: right;
          min-width: 30mm;
        ">
          <div style="
            font-size: 10pt;
            font-weight: 700;
            letter-spacing: 0.08em;
            color: rgba(255,255,255,0.92);
            text-transform: uppercase;
            margin-bottom: 2mm;
          ">MeTravel</div>
          ${this.renderDate()}
        </div>
      </div>
    `;
  }

  private getTravelLabel(count: number): string {
    return getTravelLabel(count);
  }

  private buildSafeImageUrl(url?: string): string | undefined {
    if (!url) return undefined;
    return url;
  }

  private escapeHtml(text: string): string {
    return escapeHtml(text);
  }
}
