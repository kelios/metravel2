// src/services/pdf-export/generators/v2/pages/TravelPageGenerator.ts
// ✅ GENERATOR: Генератор страниц путешествия (описание, контент, рекомендации)

import { BasePageGenerator } from './PageGenerator';
import type { PageContext } from '../types';
import { ContentParser } from '@/services/pdf-export/parsers/ContentParser';
import { BlockRenderer } from '@/services/pdf-export/renderers/BlockRenderer';
import { buildSafeImageUrl } from '../../../utils/htmlUtils';
import { formatDays } from '../../../utils/pluralize';
import { renderPdfIcon } from '../runtime/pdfVisualHelpers';

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
    const coverImage = buildSafeImageUrl(
      travel.travel_image_url || travel.travel_image_thumb_url
    ) || '';

    const metaPieces = [
      travel.countryName ? this.escapeHtml(travel.countryName) : null,
      travel.year ? this.escapeHtml(String(travel.year)) : null,
      formatDays(travel.number_days),
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
            ${this.buildContainImage(coverImage, this.escapeHtml(travel.name), '100%', { onerrorBg: colors.accentSoft })}
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
              ">
                <h1 style="
                  color: #ffffff;
                  font-size: ${typography.h2.size};
                  margin: 0 0 6mm 0;
                  font-weight: ${typography.h2.weight};
                  line-height: ${typography.h2.lineHeight};
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
                      ${renderPdfIcon('map-pin', '#fff', 16)}
                      ${this.escapeHtml(travel.countryName)}
                    </span>
                  ` : ''}
                  ${travel.year ? `
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                      ${renderPdfIcon('calendar', '#fff', 16)}
                      ${this.escapeHtml(String(travel.year))}
                    </span>
                  ` : ''}
                  ${travel.number_days ? `
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                      ${renderPdfIcon('clock', '#fff', 16)}
                      ${formatDays(travel.number_days)}
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

    // Описание рендерим через renderRichText (с умной раскладкой изображений)
    const descriptionHtml = travel.description
      ? this.renderRichText(travel.description, theme)
      : '';
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
        
        ${descriptionHtml ? `
          <div style="margin-bottom: ${spacing.sectionSpacing};">
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: ${spacing.elementSpacing};
              padding-bottom: 8px;
              border-bottom: 2px solid ${colors.accentSoft};
            ">
              ${renderPdfIcon('pen', colors.text, 20)}
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
            ">${descriptionHtml}</div>
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
              ${renderPdfIcon('pen', colors.text, 20)}
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
              ${renderPdfIcon('bulb', colors.text, 20)}
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
                  ${renderPdfIcon('thumbs-up', colors.accent, 18)}
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
                  ${renderPdfIcon('thumbs-down', colors.textMuted, 18)}
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
   * Рендерит сырой rich-text HTML через BlockRenderer (с умной раскладкой изображений)
   */
  private renderRichText(rawHtml: string, theme: any): string {
    if (typeof document !== 'undefined') {
      const blockRenderer = new BlockRenderer(theme);
      return blockRenderer.renderRichText(rawHtml);
    }
    // Fallback для серверной среды
    return rawHtml
      .split('\n\n')
      .map(para => `<p>${this.escapeHtml(para)}</p>`)
      .join('');
  }

  /**
   * Рендерит блоки контента
   */
  private renderBlocks(blocks: any[], theme: any): string {
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

}
