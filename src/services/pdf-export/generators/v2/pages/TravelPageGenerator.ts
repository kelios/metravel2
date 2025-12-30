// src/services/pdf-export/generators/v2/pages/TravelPageGenerator.ts
// ✅ GENERATOR: Генератор страниц путешествия (описание, контент, рекомендации)

import { BasePageGenerator } from './PageGenerator';
import type { PageContext } from '../types';
import { ContentParser } from '@/src/services/pdf-export/parsers/ContentParser';
import { BlockRenderer } from '@/src/services/pdf-export/renderers/BlockRenderer';

/**
 * Генератор страницы путешествия с контентом
 *
 * Генерирует:
 * - Страницу с большим фото (TravelPhotoPage)
 * - Страницу с текстом и QR кодом (TravelContentPage)
 */
export class TravelPageGenerator extends BasePageGenerator {
  private parser: ContentParser;

  constructor() {
    super();
    this.parser = new ContentParser();
  }

  /**
   * Генерирует обе страницы путешествия (фото + контент)
   */
  async generate(context: PageContext): Promise<string> {
    const { travel } = context;

    if (!travel) {
      throw new Error('TravelPageGenerator requires travel in context');
    }

    const photoPage = this.generatePhotoPage(context);
    const contentPage = this.generateContentPage(context);

    return photoPage + '\n' + contentPage;
  }

  /**
   * Оценивает количество страниц (фото + контент = 2)
   */
  estimatePageCount(_context: PageContext): number {
    return 2;
  }

  /**
   * Генерирует страницу с большим фото
   */
  private generatePhotoPage(context: PageContext): string {
    const { travel, theme } = context;

    if (!travel) return '';

    const { colors, typography, spacing } = theme;
    const coverImage = this.buildSafeImageUrl(
      travel.travel_image_url || travel.travel_image_thumb_url
    );

    const metaPieces = [
      travel.countryName ? this.escapeHtml(travel.countryName) : null,
      travel.year ? this.escapeHtml(String(travel.year)) : null,
      this.formatDays(travel.number_days),
    ].filter(Boolean);

    return `
      <section class="pdf-page travel-photo-page" style="padding: ${spacing.pagePadding};">
        ${coverImage ? `
          <div style="
            border-radius: 14px;
            overflow: hidden;
            position: relative;
            box-shadow: 0 4px 12px rgba(0,0,0,0.12);
            height: 100%;
            min-height: 235mm;
          ">
            <img src="${this.escapeHtml(coverImage)}" alt="${this.escapeHtml(travel.name)}"
              style="
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
              "
              crossorigin="anonymous"
              onerror="this.style.display='none'; this.parentElement.style.background='${colors.accentSoft}';" />
            <div style="
              position: absolute;
              left: 0;
              right: 0;
              bottom: 0;
              background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.72) 45%, rgba(0,0,0,0.92) 100%);
              padding: 20mm 22mm 18mm 22mm;
            ">
              <div style="
                display: inline-block;
                max-width: 100%;
                padding: 6mm 6mm;
                border-radius: 10px;
                background: rgba(0,0,0,0.22);
                backdrop-filter: blur(2px);
                -webkit-backdrop-filter: blur(2px);
              ">
                <h1 style="
                  color: #ffffff;
                  font-size: ${typography.h1.size};
                  margin: 0 0 6mm 0;
                  font-weight: ${typography.h1.weight};
                  line-height: ${typography.h1.lineHeight};
                  text-shadow: 0 6px 18px rgba(0,0,0,0.55);
                  font-family: ${typography.headingFont};
                  overflow-wrap: anywhere;
                  word-break: break-word;
                  hyphens: auto;
                ">${this.escapeHtml(travel.name)}</h1>
              </div>
              ${metaPieces.length ? `
                <div style="
                  color: rgba(255,255,255,0.95);
                  font-size: ${typography.body.size};
                  display: flex;
                  gap: 16px;
                  flex-wrap: wrap;
                  font-weight: 500;
                  font-family: ${typography.bodyFont};
                ">
                  ${travel.countryName ? `
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                      ${this.renderPdfIcon('map-pin', '#fff', 16)}
                      ${this.escapeHtml(travel.countryName)}
                    </span>
                  ` : ''}
                  ${travel.year ? `
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                      ${this.renderPdfIcon('calendar', '#fff', 16)}
                      ${this.escapeHtml(String(travel.year))}
                    </span>
                  ` : ''}
                  ${travel.number_days ? `
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                      ${this.renderPdfIcon('clock', '#fff', 16)}
                      ${this.formatDays(travel.number_days)}
                    </span>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </section>
    `;
  }

  /**
   * Генерирует страницу с текстовым контентом
   */
  private generateContentPage(context: PageContext): string {
    const { travel, theme, pageNumber, metadata } = context;

    if (!travel) return '';

    const { colors, typography, spacing } = theme;
    const qrCode = metadata?.qrCode || '';

    // Парсим контент
    const descriptionBlocks = travel.description
      ? this.parser.parse(travel.description)
      : [];
    const recommendationBlocks = travel.recommendation
      ? this.parser.parse(travel.recommendation)
      : [];
    const plusBlocks = travel.plus ? this.parser.parse(travel.plus) : [];
    const minusBlocks = travel.minus ? this.parser.parse(travel.minus) : [];

    const url = travel.slug
      ? `https://metravel.by/travels/${travel.slug}`
      : travel.url;

    return `
      <section class="pdf-page travel-content-page" style="padding: ${spacing.pagePadding};">
        <style>
          .travel-content-page p {
            margin-bottom: ${typography.body.marginBottom};
            line-height: ${typography.body.lineHeight};
            text-align: justify;
            orphans: 2;
            widows: 2;
          }
          .travel-content-page h1,
          .travel-content-page h2,
          .travel-content-page h3 {
            page-break-after: avoid;
            orphans: 3;
            widows: 3;
          }
        </style>
        
        ${descriptionBlocks.length > 0 ? `
          <div style="margin-bottom: ${spacing.sectionSpacing};">
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: ${spacing.elementSpacing};
              padding-bottom: 8px;
              border-bottom: 2px solid ${colors.accentSoft};
            ">
              ${this.renderPdfIcon('pen', colors.text, 20)}
              <h2 style="
                font-size: ${typography.h2.size};
                font-weight: ${typography.h2.weight};
                color: ${colors.accent};
                margin: 0;
                font-family: ${typography.headingFont};
              ">Описание</h2>
            </div>
            <div style="
              font-size: ${typography.body.size};
              line-height: ${typography.body.lineHeight};
              color: ${colors.text};
              font-family: ${typography.bodyFont};
            ">${this.renderBlocks(descriptionBlocks, theme)}</div>
          </div>
        ` : `
          <div style="margin-bottom: ${spacing.sectionSpacing};">
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: ${spacing.elementSpacing};
              padding-bottom: 8px;
              border-bottom: 2px solid ${colors.accentSoft};
            ">
              ${this.renderPdfIcon('pen', colors.text, 20)}
              <h2 style="
                font-size: ${typography.h2.size};
                font-weight: ${typography.h2.weight};
                color: ${colors.accent};
                margin: 0;
                font-family: ${typography.headingFont};
              ">Описание</h2>
            </div>
            <p style="
              color: ${colors.textMuted};
              font-style: italic;
              margin: 0;
              font-family: ${typography.bodyFont};
            ">Описание путешествия отсутствует</p>
          </div>
        `}

        ${recommendationBlocks.length > 0 ? `
          <div style="margin-bottom: ${spacing.sectionSpacing};">
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: ${spacing.elementSpacing};
              padding-bottom: 8px;
              border-bottom: 2px solid ${colors.accentSoft};
            ">
              ${this.renderPdfIcon('bulb', colors.text, 20)}
              <h2 style="
                font-size: ${typography.h2.size};
                font-weight: ${typography.h2.weight};
                color: ${colors.accent};
                margin: 0;
                font-family: ${typography.headingFont};
              ">Рекомендации</h2>
            </div>
            <div style="
              font-size: ${typography.body.size};
              line-height: ${typography.body.lineHeight};
              color: ${colors.text};
              font-family: ${typography.bodyFont};
            ">${this.renderBlocks(recommendationBlocks, theme)}</div>
          </div>
        ` : ''}

        ${plusBlocks.length > 0 || minusBlocks.length > 0 ? `
          <div style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: ${spacing.elementSpacing};
            margin-bottom: ${spacing.sectionSpacing};
          ">
            ${plusBlocks.length > 0 ? `
              <div>
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: 8px;
                ">
                  ${this.renderPdfIcon('thumbs-up', colors.accent, 18)}
                  <h3 style="
                    font-size: ${typography.h3.size};
                    font-weight: ${typography.h3.weight};
                    color: ${colors.accent};
                    margin: 0;
                    font-family: ${typography.headingFont};
                  ">Плюсы</h3>
                </div>
                <div style="
                  font-size: ${typography.body.size};
                  line-height: ${typography.body.lineHeight};
                  color: ${colors.text};
                  font-family: ${typography.bodyFont};
                ">${this.renderBlocks(plusBlocks, theme)}</div>
              </div>
            ` : ''}
            ${minusBlocks.length > 0 ? `
              <div>
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: 8px;
                ">
                  ${this.renderPdfIcon('thumbs-down', colors.textMuted, 18)}
                  <h3 style="
                    font-size: ${typography.h3.size};
                    font-weight: ${typography.h3.weight};
                    color: ${colors.textMuted};
                    margin: 0;
                    font-family: ${typography.headingFont};
                  ">Минусы</h3>
                </div>
                <div style="
                  font-size: ${typography.body.size};
                  line-height: ${typography.body.lineHeight};
                  color: ${colors.text};
                  font-family: ${typography.bodyFont};
                ">${this.renderBlocks(minusBlocks, theme)}</div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        ${qrCode && url ? `
          <div style="
            margin-top: ${spacing.sectionSpacing};
            padding: ${spacing.blockSpacing};
            background: ${colors.surfaceAlt};
            border-radius: 14px;
            display: flex;
            align-items: center;
            gap: 16px;
            border: 1px solid ${colors.border};
          ">
            <img src="${qrCode}" alt="QR код" style="width: 70px; height: 70px;" />
            <div style="flex: 1;">
              <div style="
                font-size: ${typography.body.size};
                font-weight: 600;
                color: ${colors.text};
                margin-bottom: 4px;
                font-family: ${typography.bodyFont};
              ">Читать онлайн</div>
              <div style="
                font-size: ${typography.caption.size};
                color: ${colors.textMuted};
                font-family: ${typography.bodyFont};
              ">${this.escapeHtml(url)}</div>
            </div>
          </div>
        ` : ''}

        <div style="
          position: absolute;
          bottom: 15mm;
          right: 25mm;
          font-size: ${typography.caption.size};
          color: ${colors.textMuted};
          font-weight: 500;
          font-family: ${typography.bodyFont};
        ">${pageNumber}</div>
      </section>
    `;
  }

  /**
   * Рендерит блоки контента
   */
  private renderBlocks(blocks: any[], theme: any): string {
    // Создаем BlockRenderer с темой из context
    if (typeof document !== 'undefined') {
      const blockRenderer = new BlockRenderer(theme);
      return blockRenderer.renderBlocks(blocks);
    }
    // Fallback для серверной среды
    return blocks.map(block => {
      if (block.type === 'paragraph') {
        return `<p>${this.escapeHtml(block.content || block.data?.text || '')}</p>`;
      }
      return '';
    }).join('');
  }

  /**
   * Создает безопасный URL изображения
   */
  private buildSafeImageUrl(url: string | null | undefined): string {
    if (!url) return '';
    const trimmed = url.trim();
    if (!trimmed) return '';

    // Используем прокси для внешних изображений
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return `https://images.weserv.nl/?url=${encodeURIComponent(trimmed)}&w=1600&q=85`;
    }

    return trimmed;
  }

  /**
   * Форматирует количество дней
   */
  private formatDays(days: number | null | undefined): string {
    if (!days) return '';

    if (days === 1) return '1 день';
    if (days >= 2 && days <= 4) return `${days} дня`;
    return `${days} дней`;
  }

  /**
   * Рендерит иконку для PDF
   */
  private renderPdfIcon(name: string, color: string, size: number): string {
    const icons: Record<string, string> = {
      'pen': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
      'bulb': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M9 18h6M10 22h4M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364-.707-.707M6.343 6.343l-.707-.707m12.728 0-.707.707M6.343 17.657l-.707.707"/></svg>`,
      'thumbs-up': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`,
      'thumbs-down': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>`,
      'map-pin': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
      'calendar': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      'clock': `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    };

    return icons[name] || '';
  }
}

