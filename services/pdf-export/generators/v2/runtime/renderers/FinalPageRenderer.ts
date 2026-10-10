import type { TravelForBook } from '@/types/pdf-export'
import type { TravelQuote } from '../../../../quotes/travelQuotes'
import { escapeHtml, formatDays, getTravelLabel, type RuntimeRenderContext } from './renderHelpers'
import { translate as i18nT } from '@/i18n'
import { getCountryLabel, getPhotoLabel } from '@/utils/pluralize'
import type { BookSummary } from '../../../../segments/types'
import {
  buildContourLayer,
  buildEmblemSvg,
  buildPostmarkRings,
  buildPostmarkWaves,
  buildQuoteMark,
  buildTicketRoute,
  inkWithAlpha,
} from './finalPageArt'

/**
 * #2275: печать WebKit на iOS (и в Safari/macOS) теряет альфу у цветов
 * градиента: `rgba(…, a)` и `transparent` в `linear/radial-gradient` выходят
 * непрозрачными — свечение рисовалось белым кругом на чёрной странице, тонкие
 * линии — сплошными. Однотонная `rgba` и градиенты из непрозрачных цветов
 * печатаются верно. Поэтому светлые полупрозрачные слои страницы заданы
 * непрозрачными градиентами в режиме наложения `screen`: для белого с альфой a
 * `screen(фон, серый a·255)` = `фон + a·(1 − фон)` — ровно то же, что прежнее
 * наложение, а чёрный (`#000`) в `screen` фон не меняет.
 */
const screenGray = (alpha: number): string => {
  const level = Math.round(alpha * 255)
  return `rgb(${level},${level},${level})`
}

const SCREEN_LAYER = 'mix-blend-mode: screen;'

/**
 * Тёплое свечение внизу было `rgba(217,115,85,0.16)`. Цветной слой через
 * `screen` точно не повторить (он только осветляет), поэтому цвет подобран под
 * средние тёмные обложки: на них отличие ≤ 1/255, на синих (`light`) свечение
 * светлее прежнего до 16/255 в синем канале.
 */
const ORANGE_GLOW_SCREEN = 'rgb(29,3,0)'

export class RuntimeFinalRenderer {
  constructor(private ctx: RuntimeRenderContext) {}

  render(
    pageNumber: number,
    travels: TravelForBook[] = [],
    finalQuote?: TravelQuote | null,
    pinned?: { summary: BookSummary; generatedAt: string },
  ): string {
    const { colors, typography } = this.ctx.theme

    const totalTravels = pinned?.summary.travels ?? travels.length
    const countryCount = pinned?.summary.countries ?? new Set(travels.map((t) => t.countryName).filter(Boolean)).size
    const totalDays = pinned?.summary.days ?? travels.reduce((sum, t) => {
      const days = typeof t.number_days === 'number' ? t.number_days : 0
      return sum + Math.max(0, days)
    }, 0)
    const totalPhotos = pinned?.summary.photos ?? travels.reduce((sum, t) => sum + (t.gallery || []).length, 0)

    const stats: Array<{ value: number; label: string }> = []
    if (totalTravels > 0) {
      stats.push({ value: totalTravels, label: getTravelLabel(totalTravels) })
    }
    if (countryCount > 0) {
      const cl = countryCount
      stats.push({ value: cl, label: getCountryLabel(cl) })
    }
    if (totalDays > 0) {
      stats.push({
        value: totalDays,
        label: formatDays(totalDays).replace(String(totalDays), '').trim()
          || i18nT('export:services.pdfExport.runtime.final.daysFallback'),
      })
    }
    if (totalPhotos > 0) {
      stats.push({ value: totalPhotos, label: getPhotoLabel(totalPhotos) })
    }

    const ink = colors.cover.text
    const numberSize = stats.length > 3 ? '26pt' : '30pt'
    const statsHtml = stats.length > 0 ? `
      <div class="final-ticket" style="
        width: 150mm;
        max-width: 100%;
        margin: 11mm auto 0;
        border: 1px solid ${inkWithAlpha(ink, 0.34)};
        border-radius: 3.5mm;
      ">
        ${buildTicketRoute(ink)}
        <div style="
          display: grid;
          grid-template-columns: repeat(${stats.length}, minmax(0, 1fr));
          border-top: 1px dashed ${inkWithAlpha(ink, 0.34)};
        ">
          ${stats.map((s, index) => `
            <div class="final-summary-tile" style="
              text-align: center;
              padding: 5mm 2mm 5.5mm;
              min-width: 0;
              ${index > 0 ? `border-left: 1px solid ${inkWithAlpha(ink, 0.18)};` : ''}
            ">
              <div style="
                font-size: ${numberSize};
                font-weight: 600;
                color: ${ink};
                font-family: ${typography.headingFont};
                line-height: 1.1;
                margin-bottom: 1.5mm;
                font-variant-numeric: tabular-nums;
                overflow-wrap: anywhere;
              ">${s.value}</div>
              <div style="
                font-size: 7.5pt;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                color: ${colors.cover.textSecondary};
                font-family: ${typography.bodyFont};
                line-height: 1.4;
                overflow-wrap: anywhere;
              ">${escapeHtml(s.label)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''

    const year = pinned ? new Date(pinned.generatedAt).getUTCFullYear() : new Date().getFullYear()

    return `
      <section class="pdf-page final-page" style="
        padding: 20mm 26mm 17mm;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 285mm;
        min-height: 285mm;
        text-align: center;
        color: ${ink};
        background: linear-gradient(135deg, ${colors.cover.backgroundGradient[0]} 0%, ${colors.cover.backgroundGradient[1]} 100%);
        position: relative;
        overflow: hidden;
      ">
        <div style="
          position: absolute;
          top: 0; right: 0; bottom: 0; left: 0;
          background:
            radial-gradient(circle at 50% 17%, ${screenGray(0.08)}, #000 34%),
            radial-gradient(circle at 50% 86%, ${ORANGE_GLOW_SCREEN}, #000 32%);
          background-blend-mode: screen;
          ${SCREEN_LAYER}
          pointer-events: none;
        "></div>
        ${buildContourLayer(ink)}
        <div style="
          position: absolute;
          top: 10mm; right: 10mm; bottom: 10mm; left: 10mm;
          border: 1px solid ${inkWithAlpha(ink, 0.26)};
          pointer-events: none;
        "></div>
        <div style="
          position: absolute;
          top: 12mm; right: 12mm; bottom: 12mm; left: 12mm;
          border: 1px solid ${inkWithAlpha(ink, 0.12)};
          pointer-events: none;
        "></div>
        ${buildEmblemSvg(ink)}

        <div style="
          position: relative;
          width: 100%;
          margin: auto 0;
          flex-shrink: 0;
        ">
          <div style="
            width: 20mm;
            height: 1px;
            background: linear-gradient(90deg, #000, ${screenGray(0.55)}, #000);
            ${SCREEN_LAYER}
            border-radius: 999px;
            margin: 0 auto 7mm auto;
          "></div>

          <h2 style="
            font-size: 32pt;
            font-weight: ${typography.h1.weight};
            max-width: 132mm;
            margin: 0 auto 5mm;
            letter-spacing: -0.025em;
            font-family: ${typography.headingFont};
            color: ${ink};
            line-height: 1.15;
            overflow-wrap: anywhere;
          ">${i18nT("export:services.pdf_export.generators.v2.runtime.renderers.FinalPageRenderer.section_class_pdf_page_final_page_style_padd_473b31a3.text01")}</h2>
          <p style="
            max-width: 116mm;
            margin: 0 auto;
            font-size: 11pt;
            line-height: 1.65;
            color: ${colors.cover.textSecondary};
            font-family: ${typography.bodyFont};
          ">
            ${i18nT("export:services.pdf_export.generators.v2.runtime.renderers.FinalPageRenderer.section_class_pdf_page_final_page_style_padd_473b31a3.text02")}
          </p>
          ${statsHtml}
          ${finalQuote ? `
            <blockquote style="
              max-width: 120mm;
              margin: 11mm auto 0;
              position: relative;
            ">
              ${buildQuoteMark(ink)}
              <p style="
                margin: 0 0 3mm 0;
                font-size: 11.5pt;
                line-height: 1.6;
                font-style: italic;
                font-family: ${typography.bodyFont};
              ">
                ${escapeHtml(finalQuote.text)}
              </p>
              <p style="
                margin: 0;
                font-size: 8pt;
                line-height: 1.4;
                color: ${colors.cover.textSecondary};
                letter-spacing: 0.08em;
                text-transform: uppercase;
                font-family: ${typography.bodyFont};
              ">
                — ${escapeHtml(finalQuote.author || 'MeTravel.by')}
              </p>
            </blockquote>
          ` : ''}
        </div>
        <footer style="
          position: relative;
          flex-shrink: 0;
          margin-top: 8mm;
          width: 100%;
          height: 31mm;
          font-family: ${typography.bodyFont};
        ">
          ${buildPostmarkWaves(ink)}
          <div class="final-postmark" style="
            position: relative;
            width: 31mm;
            height: 31mm;
            margin: 0 auto;
            transform: rotate(-8deg);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          ">
            ${buildPostmarkRings(ink)}
            <span style="
              position: relative;
              font-size: 7pt;
              font-weight: 700;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              line-height: 1.2;
            ">MeTravel.by</span>
            <span style="
              position: relative;
              width: 15mm;
              height: 0;
              margin: 1.4mm 0 1.2mm;
              border-top: 1px solid ${inkWithAlpha(ink, 0.5)};
            "></span>
            <span style="
              position: relative;
              font-size: 10pt;
              font-weight: 600;
              letter-spacing: 0.06em;
              line-height: 1.2;
              font-variant-numeric: tabular-nums;
            ">© ${year}</span>
          </div>
        </footer>
      </section>
    `
  }
}
