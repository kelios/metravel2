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
    const totalPhotos = travels.reduce((sum, t) => sum + (t.gallery || []).length, 0);

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
    if (totalPhotos > 0) {
      stats.push({ value: totalPhotos, label: totalPhotos === 1 ? 'фото' : 'фото' });
    }

    const statsHtml = stats.length > 0 ? `
      <div style="
        display: flex;
        justify-content: center;
        gap: 7mm;
        margin-bottom: 12mm;
        flex-wrap: wrap;
      ">
        ${stats.map((s) => `
          <div class="final-summary-tile" style="
            text-align: center;
            padding: 8px 12px;
            background: rgba(255,255,255,0.08);
            border-radius: 14px;
            border: 1px solid rgba(255,255,255,0.12);
            min-width: 56px;
          ">
            <div style="
              font-size: 24pt;
              font-weight: 800;
              color: ${colors.cover.text};
              font-family: ${typography.headingFont};
              line-height: 1.1;
            ">${s.value}</div>
            <div style="
              font-size: ${typography.caption.size};
              text-transform: uppercase;
              letter-spacing: 0.08em;
              color: ${colors.cover.textSecondary};
              margin-top: 2mm;
              font-family: ${typography.bodyFont};
              opacity: 0.8;
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
        position: relative;
        overflow: hidden;
      ">
        <div style="
          position: absolute;
          inset: 12mm;
          border: 1.5px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          pointer-events: none;
        "></div>

        <div style="
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 50% 25%, rgba(255,255,255,0.08), transparent 36%),
            radial-gradient(circle at 50% 80%, rgba(217,115,85,0.16), transparent 32%);
          pointer-events: none;
        "></div>

        <div style="
          position: relative;
          z-index: 1;
          width: 148mm;
          padding: 22mm 18mm 18mm;
          border-radius: 26px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.14);
          box-shadow: 0 18px 42px rgba(0,0,0,0.2);
        ">
          <div style="
            width: 38mm;
            height: 2px;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
            border-radius: 999px;
            margin: 0 auto 9mm auto;
          "></div>

          <h2 style="
            font-size: ${typography.h1.size};
            margin-bottom: 5mm;
            letter-spacing: -0.02em;
            font-family: ${typography.headingFont};
            color: ${colors.cover.text};
            line-height: ${typography.h1.lineHeight};
            text-shadow: 0 8px 24px rgba(0,0,0,0.18);
          ">Спасибо за путешествие!</h2>
          <p style="
            max-width: 112mm;
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
            <div style="
              max-width: 112mm;
              margin: 0 auto;
              padding: 10px 14px;
              background: rgba(255,255,255,0.04);
              border-radius: 16px;
              border: 1px solid rgba(255,255,255,0.1);
            ">
              <p style="
                margin: 0 0 4mm 0;
                font-size: 10.5pt;
                line-height: 1.6;
                opacity: 0.9;
                font-style: italic;
                font-family: ${typography.bodyFont};
              ">
                «${escapeHtml(finalQuote.text)}»
              </p>
              <p style="
                margin: 0;
                font-size: 8.5pt;
                line-height: 1.4;
                opacity: 0.65;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                font-family: ${typography.bodyFont};
              ">
                ${escapeHtml(finalQuote.author || 'MeTravel.by')}
              </p>
            </div>
          ` : ''}
        </div>
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
