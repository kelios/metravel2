// src/services/pdf-export/generators/pages/FinalPageGenerator.ts
// Legacy compatibility adapter for the old pages/* API.

import type { PdfThemeConfig } from '../../themes/PdfThemeConfig';
import { escapeHtml } from '../../utils/htmlUtils';
import { getCountryLabel, getTravelLabel } from '../../utils/pluralize';

export interface FinalPageData {
  totalTravels: number;
  totalCountries?: number;
  totalDays?: number;
  quote?: {
    text: string;
    author: string;
  };
}

export class FinalPageGenerator {
  constructor(private theme: PdfThemeConfig) {}

  generate(data: FinalPageData, pageNumber: number): string {
    const { colors, typography } = this.theme;
    const stats = [
      data.totalTravels
        ? { value: data.totalTravels, label: getTravelLabel(data.totalTravels) }
        : null,
      data.totalCountries
        ? { value: data.totalCountries, label: getCountryLabel(data.totalCountries) }
        : null,
      data.totalDays ? { value: data.totalDays, label: this.getDayLabel(data.totalDays) } : null,
    ].filter(Boolean) as Array<{ value: number; label: string }>;

    return `
      <section class="pdf-page final-page" style="
        padding: 40mm 30mm;
        background: linear-gradient(135deg, ${colors.cover.backgroundGradient[0]} 0%, ${colors.cover.backgroundGradient[1]} 100%);
        color: ${colors.cover.text};
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
        position: relative;
      ">
        <div style="position: relative; z-index: 1; width: 100%;">
          <h1 style="
            font-size: 42pt;
            font-weight: 800;
            margin: 0 0 8mm 0;
            font-family: ${typography.headingFont};
            line-height: 1.1;
          ">Спасибо за<br/>путешествие!</h1>
          <p style="
            margin: 0 0 14mm 0;
            font-size: 16pt;
            line-height: 1.7;
            font-family: ${typography.bodyFont};
            opacity: 0.95;
          ">
            Пусть эта книга напоминает о самых тёплых эмоциях и<br/>
            помогает планировать новые приключения
          </p>
          ${stats.length ? `
            <div style="
              display: flex;
              justify-content: center;
              gap: 20mm;
              margin-bottom: 16mm;
              flex-wrap: wrap;
            ">
              ${stats.map((stat) => `
                <div style="
                  padding: 8mm 12mm;
                  background: rgba(255,255,255,0.10);
                  border-radius: 12px;
                  min-width: 28mm;
                ">
                  <div style="
                    font-size: 32pt;
                    font-weight: 800;
                    color: ${colors.accent};
                    margin-bottom: 3mm;
                    font-family: ${typography.headingFont};
                  ">${stat.value}</div>
                  <div style="
                    font-size: 12pt;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    opacity: 0.9;
                    font-family: ${typography.bodyFont};
                  ">${escapeHtml(stat.label)}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
          ${data.quote ? `
            <div style="
              max-width: 120mm;
              margin: 0 auto 18mm;
              padding: 15mm;
              background: rgba(255,255,255,0.06);
              border-left: 4px solid rgba(255,255,255,0.3);
              border-radius: 8px;
              font-style: italic;
            ">
              <div style="font-size: 14pt; margin-bottom: 5mm; line-height: 1.6;">
                "${escapeHtml(data.quote.text)}"
              </div>
              <div style="font-size: 11pt; opacity: 0.7; text-align: right;">
                — ${escapeHtml(data.quote.author)}
              </div>
            </div>
          ` : ''}
          <div style="
            margin-top: auto;
            padding-top: 8mm;
            font-size: 11pt;
            letter-spacing: 0.12em;
            font-weight: 700;
            font-family: ${typography.bodyFont};
          ">METRAVEL.BY</div>
        </div>
        <div style="
          position: absolute;
          bottom: 15mm;
          right: 25mm;
          font-size: 12pt;
          color: ${colors.cover.textSecondary};
          font-weight: 500;
        ">${pageNumber}</div>
      </section>
    `;
  }

  private getDayLabel(days: number): string {
    const mod10 = days % 10;
    const mod100 = days % 100;
    if (mod10 === 1 && mod100 !== 11) return 'день';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
    return 'дней';
  }
}
