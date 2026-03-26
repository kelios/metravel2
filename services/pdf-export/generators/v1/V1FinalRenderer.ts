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
        gap: 6mm;
        margin-bottom: 14mm;
        flex-wrap: wrap;
      ">
        ${stats.map((s) => `
          <div class="final-summary-tile" style="
            text-align: center;
            padding: 10px 16px;
            min-width: 50px;
            border-radius: 18px;
            background: rgba(255,255,255,0.07);
            border: 1px solid rgba(255,255,255,0.12);
          ">
            <div style="
              font-size: 22pt;
              font-weight: 800;
              color: ${colors.cover.text};
              font-family: ${typography.headingFont};
              line-height: 1.1;
              margin-bottom: 2mm;
            ">${s.value}</div>
            <div style="
              font-size: ${typography.caption.size};
              text-transform: uppercase;
              letter-spacing: 0.1em;
              color: ${colors.cover.textSecondary};
              font-family: ${typography.bodyFont};
              opacity: 0.75;
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
        <svg class="final-route-line" viewBox="0 0 320 120" aria-hidden="true" style="
          position: absolute;
          top: 28mm;
          left: 50%;
          transform: translateX(-50%);
          width: 132mm;
          height: auto;
          opacity: 0.2;
        ">
          <path d="M18 90 C60 30, 98 102, 136 58 S214 18, 252 56 S292 108, 306 34" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="18" cy="90" r="4" fill="rgba(255,255,255,0.85)"/>
          <circle cx="136" cy="58" r="4" fill="rgba(255,255,255,0.55)"/>
          <circle cx="306" cy="34" r="4" fill="rgba(255,255,255,0.85)"/>
        </svg>

        <div style="
          position: relative;
          z-index: 1;
          width: 148mm;
          padding: 26mm 18mm 18mm;
          border-radius: 26px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.14);
          box-shadow: 0 18px 42px rgba(0,0,0,0.2);
        ">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 6mm auto; display: block; opacity: 0.7;">
            <circle cx="12" cy="12" r="10"/>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)"/>
          </svg>

          <div style="
            width: 38mm;
            height: 2px;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);
            border-radius: 999px;
            margin: 0 auto 8mm auto;
          "></div>

          <h2 style="
            font-size: ${typography.h1.size};
            margin-bottom: 4mm;
            letter-spacing: -0.02em;
            font-family: ${typography.headingFont};
            color: ${colors.cover.text};
            line-height: ${typography.h1.lineHeight};
            text-shadow: 0 8px 24px rgba(0,0,0,0.18);
          ">Спасибо за путешествие!</h2>
          <p style="
            max-width: 112mm;
            margin: 0 auto 12mm auto;
            font-size: ${typography.body.size};
            line-height: ${typography.body.lineHeight};
            opacity: 0.8;
            font-family: ${typography.bodyFont};
          ">
            Пусть эта книга напоминает о самых тёплых эмоциях
            и помогает планировать новые приключения.
          </p>
          ${statsHtml}
          ${finalQuote ? `
            <div style="
              width: 24mm;
              height: 1px;
              background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
              margin: 0 auto 8mm auto;
            "></div>
            <div style="
              max-width: 112mm;
              margin: 0 auto;
              padding: 10px 0;
              position: relative;
            ">
              <div style="
                font-size: 32pt;
                line-height: 1;
                opacity: 0.2;
                font-family: Georgia, serif;
                position: absolute;
                top: -4mm;
                left: -3mm;
              ">“</div>
              <p style="
                margin: 0 0 4mm 0;
                font-size: 10.5pt;
                line-height: 1.65;
                opacity: 0.88;
                font-style: italic;
                font-family: ${typography.bodyFont};
                padding: 0 6mm;
              ">
                ${escapeHtml(finalQuote.text)}
              </p>
              <p style="
                margin: 0;
                font-size: 8.5pt;
                line-height: 1.4;
                opacity: 0.55;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                font-family: ${typography.bodyFont};
              ">
                — ${escapeHtml(finalQuote.author || 'MeTravel.by')}
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
