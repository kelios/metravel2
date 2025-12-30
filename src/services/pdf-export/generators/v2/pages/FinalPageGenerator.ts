// src/services/pdf-export/generators/v2/pages/FinalPageGenerator.ts
// ✅ ГЕНЕРАТОР: Финальная страница книги путешествий

import { BasePageGenerator } from './PageGenerator';
import type { PageContext } from '../types';
import type { TravelQuote } from '../../../quotes/travelQuotes';

/**
 * Генератор финальной страницы
 */
export class FinalPageGenerator extends BasePageGenerator {
  constructor(private quote?: TravelQuote) {
    super();
  }

  generate(context: PageContext): string {
    const { theme, pageNumber } = context;
    const { colors, typography } = theme;

    return `
      <section class="pdf-page final-page" style="
        padding: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 285mm;
        text-align: center;
        color: ${colors.text};
        background: #ffffff;
      ">
        <h2 style="
          font-size: ${typography.h1.size};
          margin-bottom: 6mm;
          letter-spacing: -0.02em;
          font-family: ${typography.headingFont};
        ">Спасибо за путешествие!</h2>
        <p style="
          max-width: 120mm;
          margin: 0 auto 10mm auto;
          font-size: ${typography.body.size};
          line-height: ${typography.body.lineHeight};
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
        ">
          Пусть эта книга напоминает о самых тёплых эмоциях
          и помогает планировать новые приключения.
        </p>
        ${this.quote ? `
          <p style="
            max-width: 120mm;
            margin: 0 auto 4mm auto;
            font-size: 10.5pt;
            line-height: 1.6;
            color: ${colors.textMuted};
            font-style: italic;
            font-family: ${typography.bodyFont};
          ">
            «${this.escapeHtml(this.quote.text)}»
          </p>
          ${this.quote.author ? `
            <p style="
              max-width: 120mm;
              margin: 0 auto;
              font-size: 8.5pt;
              line-height: 1.4;
              color: ${colors.textMuted};
              letter-spacing: 0.06em;
              text-transform: uppercase;
              font-family: ${typography.bodyFont};
            ">
              ${this.escapeHtml(this.quote.author)}
            </p>
          ` : ''}
        ` : ''}
        <div style="
          position: absolute;
          bottom: 22mm;
          width: 100%;
          left: 0;
          text-align: center;
          font-size: 10pt;
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
        ">
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 2mm;
            font-size: 10pt;
          ">
            <span style="font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;">
              MeTravel.by
            </span>
          </div>
          <div>© ${new Date().getFullYear()}</div>
        </div>
        <div style="
          position: absolute;
          bottom: 15mm;
          right: 25mm;
          font-size: 11pt;
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
        ">${pageNumber}</div>
      </section>
    `;
  }
}

