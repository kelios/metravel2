/**
 * V1 Final page renderer — extracted from EnhancedPdfGenerator.renderFinalPage
 */

import type { TravelForBook } from '@/types/pdf-export';
import type { TravelQuote } from '../../quotes/travelQuotes';
import { escapeHtml } from '../../utils/htmlUtils';
import { formatDays, getTravelLabel } from '../../utils/pluralize';
import type { V1RenderContext } from './V1RenderHelpers';

export class V1FinalRenderer {
  constructor(private ctx: V1RenderContext) {}

  render(
    pageNumber: number,
    travels: TravelForBook[] = [],
    finalQuote?: TravelQuote | null
  ): string {
    const { colors, typography } = this.ctx.theme;

    // Статистика
    const totalTravels = travels.length;
    const countries = new Set(travels.map((t) => t.countryName).filter(Boolean));
    const totalDays = travels.reduce((sum, t) => {
      const days = typeof t.number_days === 'number' ? t.number_days : 0;
      return sum + Math.max(0, days);
    }, 0);

    const stats: Array<{ value: number; label: string }> = [];
    if (totalTravels > 0) {
      stats.push({ value: totalTravels, label: getTravelLabel(totalTravels) });
    }
    if (countries.size > 0) {
      const cl = countries.size;
      stats.push({ value: cl, label: cl === 1 ? 'страна' : cl < 5 ? 'страны' : 'стран' });
    }
    if (totalDays > 0) {
      stats.push({ value: totalDays, label: formatDays(totalDays).replace(String(totalDays), '').trim() || 'дней' });
    }

    const statsHtml = stats.length > 0 ? `
      <div style="
        display: flex;
        justify-content: center;
        gap: 14mm;
        margin-bottom: 12mm;
        flex-wrap: wrap;
      ">
        ${stats.map((s) => `
          <div style="text-align: center;">
            <div style="
              font-size: 28pt;
              font-weight: 800;
              color: ${colors.accent};
              font-family: ${typography.headingFont};
              line-height: 1.1;
            ">${s.value}</div>
            <div style="
              font-size: ${typography.caption.size};
              text-transform: uppercase;
              letter-spacing: 0.08em;
              color: ${colors.textMuted};
              margin-top: 2mm;
              font-family: ${typography.bodyFont};
            ">${escapeHtml(s.label)}</div>
          </div>
        `).join('')}
      </div>
    ` : '';

    return `
      <section class="pdf-page final-page" style="
        padding: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 285mm;
        text-align: center;
        color: ${colors.cover.text};
        background: linear-gradient(135deg, ${colors.cover.backgroundGradient[0]} 0%, ${colors.cover.backgroundGradient[1]} 100%);
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
          opacity: 0.85;
          font-family: ${typography.bodyFont};
        ">
          Пусть эта книга напоминает о самых тёплых эмоциях
          и помогает планировать новые приключения.
        </p>
        ${statsHtml}
        ${finalQuote ? `
          <p style="
            max-width: 120mm;
            margin: 0 auto 4mm auto;
            font-size: 10.5pt;
            line-height: 1.6;
            opacity: 0.85;
            font-style: italic;
            font-family: ${typography.bodyFont};
          ">
            «${escapeHtml(finalQuote.text)}»
          </p>
          <p style="
            max-width: 120mm;
            margin: 0 auto;
            font-size: 8.5pt;
            line-height: 1.4;
            opacity: 0.7;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            font-family: ${typography.bodyFont};
          ">
            ${escapeHtml(finalQuote.author || 'MeTravel.by')}
          </p>
        ` : ''}
        <div style="
          position: absolute;
          bottom: 22mm;
          width: 100%;
          left: 0;
          text-align: center;
          font-size: ${typography.caption.size};
          opacity: 0.7;
          font-family: ${typography.bodyFont};
        ">
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 2mm;
            font-size: ${typography.caption.size};
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
          font-size: ${typography.caption.size};
          opacity: 0.6;
          font-family: ${typography.bodyFont};
        ">${pageNumber}</div>
      </section>
    `;
  }
}
