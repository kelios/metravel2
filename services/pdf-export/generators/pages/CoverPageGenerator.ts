// src/services/pdf-export/generators/pages/CoverPageGenerator.ts
// Генератор обложки книги с улучшенным дизайном

import type { PdfThemeConfig } from '../../themes/PdfThemeConfig';
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

        ${this.renderContent(data, textPosition, textColor)}

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
    textColor: string
  ): string {
    const justifyContent = textPosition === 'top' 
      ? 'flex-start' 
      : textPosition === 'bottom' 
      ? 'flex-end' 
      : 'center';
    
    const paddingTop = textPosition === 'top' ? '30mm' : '0';
    const paddingBottom = textPosition === 'bottom' ? '30mm' : '0';

    return `
      <div style="
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: ${justifyContent};
        padding: ${paddingTop} 24mm ${paddingBottom} 24mm;
        text-align: center;
        position: relative;
        z-index: 2;
      ">
        ${this.renderTitle(data.title, textColor)}
        ${data.subtitle ? this.renderSubtitle(data.subtitle, textColor) : ''}
        ${this.renderUserName(data.userName, textColor)}
        ${data.quote ? this.renderQuote(data.quote, textColor) : ''}
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
        inset: 15mm;
        border: 2px solid rgba(255,255,255,0.18);
        border-radius: 16px;
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
        font-size: 16pt;
        letter-spacing: 0.02em;
        color: ${textColor || 'rgba(255,255,255,0.88)'};
        opacity: ${opacity};
        margin-top: 6mm;
        font-family: ${typography.bodyFont};
      ">${this.escapeHtml(subtitle)}</div>
    `;
  }

  private renderTitle(title: string, textColor?: string): string {
    const { typography, colors } = this.theme;
    const color = textColor || colors.cover.text;

    const safeTitle = (title || '').trim();
    if (!safeTitle) return '';
    
    return `
      <h1 style="
        color: ${color};
        font-size: 36pt;
        font-weight: 800;
        line-height: 1.15;
        margin: 0;
        text-shadow: 
          0 2px 4px rgba(0,0,0,0.3),
          0 4px 12px rgba(0,0,0,0.2);
        letter-spacing: 0.02em;
        font-family: ${typography.headingFont};
        overflow-wrap: anywhere;
        word-break: break-word;
        hyphens: auto;
      ">${this.escapeHtml(safeTitle)}</h1>
    `;
  }

  private renderUserName(userName: string, textColor?: string): string {
    const { typography } = this.theme;
    return `
      <div style="
        font-size: 12pt;
        color: ${textColor || 'rgba(255,255,255,0.85)'};
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

  private renderQuote(quote: { text: string; author: string }, textColor?: string): string {
    return `
      <div style="
        margin-top: 14mm;
        max-width: 120mm;
        margin-left: auto;
        margin-right: auto;
        font-style: italic;
        opacity: 0.85;
        color: ${textColor || 'rgba(255,255,255,0.85)'};
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
