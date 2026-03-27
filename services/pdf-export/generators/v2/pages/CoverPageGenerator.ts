// src/services/pdf-export/generators/v2/pages/CoverPageGenerator.ts
// ✅ ГЕНЕРАТОР: Обложка книги путешествий

import { BasePageGenerator } from './PageGenerator';
import type { PageContext } from '../types';
import { ImageProcessor } from '../processors/ImageProcessor';
import type { TravelQuote } from '../../../quotes/travelQuotes';
import { getTravelLabel } from '../../../utils/pluralize';
import {
  getYearRange as getBookYearRange,
  resolveCoverImage as resolveBookCoverImage,
} from '../runtime/bookData';

/**
 * Генератор обложки книги
 */
export class CoverPageGenerator extends BasePageGenerator {
  constructor(
    private imageProcessor: ImageProcessor,
    private quote?: TravelQuote
  ) {
    super();
  }

  async generate(context: PageContext): Promise<string> {
    const { settings, travels = [], theme } = context;
    const { colors, typography } = theme;

    const travelCount = travels.length;
    const userName = travels[0]?.userName || 'Аноним';
    const travelLabel = getTravelLabel(travelCount);
    const yearRange = getBookYearRange(travels)?.replace(' - ', '–');

    // Обрабатываем изображение обложки
    const coverImage = resolveBookCoverImage(travels, settings);
    const safeCoverImage = coverImage ? await this.imageProcessor.processUrl(coverImage) : '';

    const background = `linear-gradient(135deg, ${colors.cover.backgroundGradient[0]} 0%, ${colors.cover.backgroundGradient[1]} 100%)`;

    const safeTitle = (settings.title || '').trim();

    return `
      <section class="pdf-page cover-page" style="
        padding: 0;
        height: 285mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        color: ${colors.cover.text};
        background: ${background};
        position: relative;
        overflow: hidden;
      ">
        ${safeCoverImage ? `
          <img
            class="cover-bg-blur"
            src="${this.escapeHtml(safeCoverImage)}"
            alt=""
            aria-hidden="true"
            crossorigin="anonymous"
            style="
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
              filter: blur(18px);
              transform: scale(1.08);
              opacity: 0.95;
              z-index: 0;
            "
          />
          <img
            class="cover-bg-main"
            src="${this.escapeHtml(safeCoverImage)}"
            alt=""
            aria-hidden="true"
            crossorigin="anonymous"
            style="
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              object-fit: contain;
              z-index: 1;
            "
          />
          <div style="
            position: absolute;
            inset: 0;
            background:
              linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.70) 100%);
            z-index: 2;
          "></div>
        ` : ''}

        <div style="
          padding: 26mm 24mm 0 24mm;
          text-align: center;
          position: relative;
          z-index: 3;
        ">
          ${safeTitle ? `
            <h1 style="
              color: ${colors.cover.text};
              font-size: ${typography.h1.size};
              font-weight: ${typography.h1.weight};
              line-height: ${typography.h1.lineHeight};
              margin: 0;
              text-shadow: 0 2px 4px rgba(0,0,0,0.8), 0 4px 16px rgba(0,0,0,0.6), 0 8px 32px rgba(0,0,0,0.4);
              font-family: ${typography.headingFont};
              overflow-wrap: anywhere;
              word-break: break-word;
              hyphens: auto;
            ">${this.escapeHtml(safeTitle)}</h1>
          ` : ''}

          ${settings.subtitle ? `
            <div style="
              font-size: 16pt;
              letter-spacing: 0.02em;
              color: rgba(255,255,255,0.88);
              margin-top: 6mm;
              font-family: ${typography.bodyFont};
              overflow-wrap: anywhere;
              word-break: break-word;
              hyphens: auto;
            ">${this.escapeHtml(settings.subtitle)}</div>
          ` : ''}

          <div style="
            font-size: 12pt;
            opacity: 0.85;
            margin-top: 10mm;
            font-family: ${typography.bodyFont};
            overflow-wrap: anywhere;
            word-break: break-word;
            hyphens: auto;
          ">${this.escapeHtml(userName)}</div>

          ${this.quote ? `
            <div style="
              margin-top: 14mm;
              max-width: 120mm;
              margin-left: auto;
              margin-right: auto;
              font-size: 11pt;
              line-height: 1.6;
              color: rgba(255,255,255,0.9);
              font-style: italic;
              font-family: ${typography.bodyFont};
              overflow-wrap: anywhere;
              word-break: break-word;
              hyphens: auto;
            ">
              «${this.escapeHtml(this.quote.text)}»
              ${this.quote.author ? `
                <div style="
                  margin-top: 3mm;
                  font-size: 9pt;
                  letter-spacing: 0.08em;
                  text-transform: uppercase;
                  opacity: 0.9;
                  overflow-wrap: anywhere;
                  word-break: break-word;
                  hyphens: auto;
                ">
                  ${this.escapeHtml(this.quote.author)}
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>

        <div style="
          padding: 0 24mm 24mm 24mm;
          position: relative;
          z-index: 3;
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
            ${this.escapeHtml(String(travelCount))} ${travelLabel}${yearRange ? ` • ${this.escapeHtml(yearRange)}` : ''}
          </div>
          <div style="
            font-size: 10pt;
            opacity: 0.7;
            font-weight: 500;
            letter-spacing: 0.08em;
            font-family: ${typography.bodyFont};
          ">MeTravel</div>
        </div>

        <div style="
          position: absolute;
          bottom: 10mm;
          left: 24mm;
          font-size: 9pt;
          opacity: 0.7;
          z-index: 3;
          font-family: ${typography.bodyFont};
        ">
          Создано ${new Date().toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      </section>
    `;
  }
}
