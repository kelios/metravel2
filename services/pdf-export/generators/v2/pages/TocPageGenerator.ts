// src/services/pdf-export/generators/v2/pages/TocPageGenerator.ts
// ✅ ГЕНЕРАТОР: Оглавление книги путешествий

import { BasePageGenerator } from './PageGenerator';
import type { PageContext } from '../types';
import { getTravelLabel } from '../../../utils/pluralize';

interface TravelSectionMeta {
  travel: any;
  startPage: number;
}

/**
 * Генератор оглавления
 */
export class TocPageGenerator extends BasePageGenerator {
  constructor(private meta: TravelSectionMeta[] = []) {
    super();
  }

  generate(context: PageContext): string {
    const { theme, pageNumber } = context;
    const { colors, typography, spacing } = theme;

    const tocItems = this.meta
      .map((item, index) => {
        const travel = item.travel;

        const country = travel.countryName ? this.escapeHtml(travel.countryName) : '';
        const year = travel.year ? this.escapeHtml(String(travel.year)) : '';
        const metaLineParts = [country, year].filter(Boolean);
        const metaLine = metaLineParts.join(' • ');

        return `
          <div style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 18px;
            background: ${colors.surface};
            border-radius: 12px;
            border: 1px solid ${colors.border};
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          ">
            <div style="flex: 1; min-width: 0;">
              <div style="
                font-weight: 600;
                font-size: 14pt;
                margin-bottom: 4px;
                color: ${colors.text};
                line-height: 1.3;
                font-family: ${typography.headingFont};
              ">${index + 1}. ${this.escapeHtml(travel.name)}</div>
              ${metaLine ? `
                <div style="
                  font-size: 10.5pt;
                  color: ${colors.textMuted};
                  font-family: ${typography.bodyFont};
                ">${metaLine}</div>
              ` : ''}
            </div>
            <div style="
              margin-left: 18px;
              font-weight: 700;
              color: ${colors.accent};
              font-size: 18pt;
              flex-shrink: 0;
              display: flex;
              align-items: center;
              font-family: ${typography.headingFont};
            ">${item.startPage}</div>
          </div>
        `;
      })
      .join('');

    return `
      <section class="pdf-page toc-page" style="
        padding: ${spacing.pagePadding};
        background: ${colors.background};
      ">
        <div style="
          text-align: center;
          margin-top: 24mm;
          margin-bottom: 16mm;
        ">
          <h2 style="
            font-size: ${typography.h1.size};
            margin-bottom: 6px;
            font-weight: ${typography.h1.weight};
            color: ${colors.text};
            letter-spacing: -0.02em;
            font-family: ${typography.headingFont};
          ">Содержание</h2>
          <p style="
            color: ${colors.textMuted};
            font-size: ${typography.body.size};
            font-family: ${typography.bodyFont};
            margin: 0 0 10px 0;
          ">${this.meta.length} ${getTravelLabel(this.meta.length)}</p>
        </div>

        <div style="
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 150mm;
          margin: 0 auto;
        ">${tocItems}</div>

        <div style="
          position: absolute;
          bottom: 15mm;
          right: 25mm;
          font-size: 11pt;
          color: ${colors.textMuted};
          font-weight: 500;
          font-family: ${typography.bodyFont};
        ">${pageNumber}</div>
      </section>
    `;
  }

}
