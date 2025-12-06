// src/services/pdf-export/generators/pages/FinalPageGenerator.ts
// Генератор финальной страницы

import type { PdfThemeConfig } from '../../themes/PdfThemeConfig';

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

  /**
   * Генерирует HTML для финальной страницы
   */
  generate(data: FinalPageData, pageNumber: number): string {
    const { colors, typography } = this.theme;

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
        ${this.renderDecorativeElements()}
        
        <div style="position: relative; z-index: 2; width: 100%;">
          ${this.renderMainMessage()}
          ${this.renderStats(data)}
          ${data.quote ? this.renderQuote(data.quote) : ''}
          ${this.renderBranding()}
        </div>

        ${this.renderPageNumber(pageNumber)}
      </section>
    `;
  }

  private renderDecorativeElements(): string {
    return `
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 150mm;
        height: 150mm;
        border: 2px solid rgba(255,255,255,0.1);
        border-radius: 50%;
        opacity: 0.3;
      "></div>
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100mm;
        height: 100mm;
        border: 2px solid rgba(255,255,255,0.15);
        border-radius: 50%;
        opacity: 0.2;
      "></div>
    `;
  }

  private renderMainMessage(): string {
    const { typography } = this.theme;
    return `
      <div style="
        background: rgba(255,255,255,0.08);
        backdrop-filter: blur(20px);
        border-radius: 24px;
        padding: 25mm 20mm;
        margin-bottom: 20mm;
        border: 1px solid rgba(255,255,255,0.15);
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      ">
        <h1 style="
          font-size: 42pt;
          font-weight: 800;
          margin-bottom: 12mm;
          text-shadow: 0 4px 20px rgba(0,0,0,0.3);
          font-family: ${typography.headingFont};
          letter-spacing: -0.02em;
          line-height: 1.1;
        ">Спасибо за<br/>путешествие!</h1>
        
        <p style="
          font-size: 16pt;
          opacity: 0.95;
          margin-bottom: 0;
          font-family: ${typography.bodyFont};
          line-height: 1.7;
          font-weight: 400;
        ">
          Пусть эта книга напоминает о самых тёплых эмоциях и<br/>
          помогает планировать новые приключения
        </p>
      </div>
      
      <div style="
        font-size: 13pt;
        font-style: italic;
        opacity: 0.75;
        margin-bottom: 20mm;
        font-family: ${typography.bodyFont};
        line-height: 1.6;
      ">
        «Посмотри на мир. Он куда удивительнее, чем сны»<br/>
        <span style="font-size: 11pt; opacity: 0.6;">— Рэй Брэдбери</span>
      </div>
    `;
  }

  private renderStats(data: FinalPageData): string {
    const { colors } = this.theme;
    const stats = [];

    if (data.totalTravels) {
      stats.push({
        value: data.totalTravels,
        label: this.getTravelLabel(data.totalTravels),
      });
    }

    if (data.totalCountries) {
      stats.push({
        value: data.totalCountries,
        label: this.getCountryLabel(data.totalCountries),
      });
    }

    if (data.totalDays) {
      stats.push({
        value: data.totalDays,
        label: this.getDayLabel(data.totalDays),
      });
    }

    if (stats.length === 0) return '';

    return `
      <div style="
        display: flex;
        justify-content: center;
        gap: 20mm;
        margin-bottom: 25mm;
        flex-wrap: wrap;
      ">
        ${stats.map(stat => `
          <div style="
            padding: 8mm 12mm;
            background: rgba(255,255,255,0.1);
            border-radius: 12px;
            backdrop-filter: blur(10px);
          ">
            <div style="
              font-size: 32pt;
              font-weight: 800;
              color: ${colors.accent};
              margin-bottom: 3mm;
            ">${stat.value}</div>
            <div style="
              font-size: 12pt;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              opacity: 0.9;
            ">${stat.label}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderQuote(quote: { text: string; author: string }): string {
    return `
      <div style="
        max-width: 120mm;
        margin: 0 auto 25mm;
        padding: 15mm;
        background: rgba(255,255,255,0.05);
        border-left: 4px solid rgba(255,255,255,0.3);
        border-radius: 8px;
        font-style: italic;
      ">
        <div style="font-size: 14pt; margin-bottom: 5mm; line-height: 1.6;">
          "${this.escapeHtml(quote.text)}"
        </div>
        <div style="font-size: 11pt; opacity: 0.7; text-align: right;">
          — ${this.escapeHtml(quote.author)}
        </div>
      </div>
    `;
  }

  private renderBranding(): string {
    return `
      <div style="
        margin-top: auto;
        padding-top: 15mm;
        text-align: center;
      ">
        <div style="
          display: inline-block;
          padding: 8mm 15mm;
          background: rgba(255,255,255,0.06);
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
        ">
          <div style="
            font-size: 16pt;
            font-weight: 700;
            letter-spacing: 0.15em;
            margin-bottom: 2mm;
          ">
            METRAVEL.BY
          </div>
          <div style="
            font-size: 10pt;
            opacity: 0.75;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          ">
            © ${new Date().getFullYear()}
          </div>
        </div>
      </div>
    `;
  }

  private renderPageNumber(pageNumber: number): string {
    return `
      <div style="
        position: absolute;
        bottom: 15mm;
        right: 25mm;
        font-size: 12pt;
        opacity: 0.6;
        font-weight: 500;
      ">${pageNumber}</div>
    `;
  }

  private getTravelLabel(count: number): string {
    if (count === 1) return 'путешествие';
    if (count >= 2 && count <= 4) return 'путешествия';
    return 'путешествий';
  }

  private getCountryLabel(count: number): string {
    if (count === 1) return 'страна';
    if (count >= 2 && count <= 4) return 'страны';
    return 'стран';
  }

  private getDayLabel(count: number): string {
    if (count === 1) return 'день';
    if (count >= 2 && count <= 4) return 'дня';
    return 'дней';
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
