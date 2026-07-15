// services/pdf-export/generators/v2/runtime/atlas/htmlPages.ts
// HTML страницы атласа: карта-страница и страницы указателя

import type { PdfThemeConfig } from '../../../../themes/PdfThemeConfig'
import { buildAtlasMapSvg } from './mapSvg'
import type { AtlasTravelEntry } from './types'
import { selectPlural, translate as i18nT } from '@/i18n'


function localizedNoun(count: number, key: Parameters<typeof i18nT>[0]): string {
  const forms = i18nT(key).split('|').map((form) => form.trim())
  const fallback = forms[3] || forms[2] || forms[0] || ''
  return selectPlural(count, {
    one: forms[0] || fallback,
    few: forms[1] || fallback,
    many: forms[2] || fallback,
    other: fallback,
  })
}

function localizedCount(count: number, key: Parameters<typeof i18nT>[0]): string {
  return `${count} ${localizedNoun(count, key)}`
}

export function renderAtlasMapPage({
  entries,
  theme,
  totalAtlasPages,
  bookTitle,
  escapeHtml,
}: {
  entries: AtlasTravelEntry[]
  theme: PdfThemeConfig
  pageNumber: number
  totalAtlasPages: number
  bookTitle?: string
  escapeHtml: (value: string) => string
}): string {
  const { colors, typography, spacing } = theme

  const totalTravels = entries.length
  const totalPoints = entries.reduce((sum, e) => sum + e.pointCount, 0)
  const countries = new Set(
    entries.map((e) => e.meta.travel.countryName).filter(Boolean),
  ).size

  const statKicker = [
    localizedCount(totalTravels, 'export:services.pdfExport.runtime.atlas.travelNounForms'),
    localizedCount(totalPoints, 'export:services.pdfExport.runtime.atlas.pointNounForms'),
    countries > 0 ? localizedCount(countries, 'export:services.pdfExport.runtime.atlas.countryNounForms') : '',
  ]
    .filter(Boolean)
    .join(' · ')

  const mapSvg = buildAtlasMapSvg(entries, theme)

  const legendChips = entries
    .map((entry) => {
      const travel = entry.meta.travel
      const name = escapeHtml(travel.name || i18nT('export:services.pdfExport.runtime.atlas.travelFallback', { value1: entry.travelOrdinal }))
      return `
        <div style="
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          background: ${colors.surface};
          border: 1px solid ${colors.border};
          font-family: ${typography.bodyFont};
          font-size: 8.5pt;
          color: ${colors.text};
          break-inside: avoid;
        ">
          <span style="
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: ${entry.color};
            color: #FFFFFF;
            font-weight: 800;
            font-size: 7.5pt;
            font-family: ${typography.headingFont};
            flex-shrink: 0;
          ">${entry.travelOrdinal}</span>
          <span style="
            font-weight: 600;
            max-width: 110px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          ">${name}</span>
          <span style="
            font-size: 7.5pt;
            color: ${colors.textMuted};
            font-family: ${typography.bodyFont};
          ">${i18nT("export:services.pdf_export.generators.v2.runtime.atlas.htmlPages.div_style_display_flex_align_items_center_ga_5a9d70e5.text01", { value11: entry.meta.mapPage ?? entry.meta.startPage + 2 })}</span>
        </div>
      `
    })
    .join('')

  return `
    <section class="pdf-page atlas-page atlas-map-page" style="
      padding: ${spacing.pagePadding};
      background: ${colors.background};
      display: flex;
      flex-direction: column;
    ">
      <div style="
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 5mm;
        margin-bottom: 6mm;
        border-bottom: 2px solid ${colors.text};
      ">
        <div>
          <div style="
            font-size: 8pt;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: ${colors.accent};
            font-family: ${typography.bodyFont};
            margin-bottom: 3mm;
          ">${i18nT("export:services.pdf_export.generators.v2.runtime.atlas.htmlPages.section_class_pdf_page_atlas_page_atlas_map__1ae2981a.text01", { value6: bookTitle ? escapeHtml(bookTitle) + ' · ' : '' })}</div>
          <h2 style="
            font-size: 30pt;
            font-weight: 800;
            color: ${colors.text};
            letter-spacing: -0.03em;
            font-family: ${typography.headingFont};
            line-height: 1;
            margin: 0;
          ">${i18nT("export:services.pdf_export.generators.v2.runtime.atlas.htmlPages.section_class_pdf_page_atlas_page_atlas_map__1ae2981a.text02")}</h2>
          <p style="
            margin: 3mm 0 0 0;
            color: ${colors.textMuted};
            font-size: 9.5pt;
            font-family: ${typography.bodyFont};
            line-height: 1.4;
            max-width: 130mm;
          ">${i18nT("export:services.pdf_export.generators.v2.runtime.atlas.htmlPages.section_class_pdf_page_atlas_page_atlas_map__1ae2981a.text03")}</p>
        </div>
        <div style="
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2mm;
          padding-bottom: 2px;
        ">
          <div style="
            font-size: 7.5pt;
            color: ${colors.textMuted};
            font-family: ${typography.bodyFont};
            letter-spacing: 0.14em;
            text-transform: uppercase;
            font-weight: 700;
          ">${i18nT("export:services.pdf_export.generators.v2.runtime.atlas.htmlPages.section_class_pdf_page_atlas_page_atlas_map__1ae2981a.text04")}</div>
          <div style="
            font-size: 9pt;
            color: ${colors.text};
            font-family: ${typography.bodyFont};
            font-weight: 600;
            text-align: right;
          ">${escapeHtml(statKicker)}</div>
        </div>
      </div>

      <div style="
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 5mm;
        min-height: 0;
      ">
        <div style="
          flex: 1;
          background: ${colors.surface};
          border: 1px solid ${colors.border};
          border-radius: 14px;
          box-shadow: ${theme.blocks.shadow};
          padding: 8px;
          min-height: 150mm;
          position: relative;
          overflow: hidden;
        ">
          <div style="
            width: 100%;
            height: 100%;
            border-radius: 10px;
            overflow: hidden;
            background: ${colors.surfaceAlt};
          ">
            ${mapSvg}
          </div>
          <div style="
            position: absolute;
            top: 14px;
            right: 14px;
            padding: 4px 9px;
            border-radius: 999px;
            background: rgba(255,255,255,0.85);
            border: 1px solid ${colors.border};
            font-family: ${typography.bodyFont};
            font-size: 7.5pt;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: ${colors.text};
          ">N ↑</div>
        </div>

        <div>
          <div style="
            font-size: 7.5pt;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: ${colors.textMuted};
            font-family: ${typography.bodyFont};
            margin-bottom: 3mm;
          ">${i18nT("export:services.pdf_export.generators.v2.runtime.atlas.htmlPages.section_class_pdf_page_atlas_page_atlas_map__1ae2981a.text05")}</div>
          <div style="
            display: flex;
            flex-wrap: wrap;
            gap: 5px 6px;
          ">${legendChips}</div>
        </div>
      </div>

      <div style="
        margin-top: 5mm;
        padding-top: 4mm;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
      ">
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1.5px;
          background: linear-gradient(90deg, ${colors.accent}, ${colors.border} 40%, transparent);
          border-radius: 999px;
        "></div>
        <span style="
          font-size: 8pt;
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
          letter-spacing: 0.06em;
          font-weight: 600;
        ">${i18nT("export:services.pdf_export.generators.v2.runtime.atlas.htmlPages.section_class_pdf_page_atlas_page_atlas_map__1ae2981a.text06", { value31: totalAtlasPages })}</span>
      </div>
    </section>
  `
}

export function renderAtlasIndexPage({
  pageEntries,
  theme,
  pageIndex,
  totalAtlasPages,
  totalPoints,
  totalTravels,
  bookTitle,
  escapeHtml,
}: {
  pageEntries: AtlasTravelEntry[]
  theme: PdfThemeConfig
  pageNumber: number
  pageIndex: number  // 0-based index page (0 = первая указательная)
  totalAtlasPages: number
  totalPoints: number
  totalTravels: number
  bookTitle?: string
  escapeHtml: (value: string) => string
}): string {
  const { colors, typography, spacing } = theme

  const headerKicker = pageIndex === 0
    ? i18nT('export:services.pdf_export.generators.v2.runtime.atlas.htmlPages.ukazatel_tochek_f21c5b5d')
    : i18nT('export:services.pdfExport.runtime.atlas.indexTitle')
  const continuation = pageIndex > 0
    ? ` <span style="font-size: 11pt; font-weight: 600; color: ${colors.textMuted};">(${i18nT('export:services.pdfExport.runtime.atlas.continuation')})</span>`
    : ''

  const groups = pageEntries
    .map((entry) => {
      const travel = entry.meta.travel
      const country = travel.countryName ? escapeHtml(travel.countryName) : ''
      const year = travel.year ? escapeHtml(String(travel.year)) : ''
      const metaLine = [country, year, localizedCount(entry.pointCount, 'export:services.pdfExport.runtime.atlas.pointNounForms')]
        .filter(Boolean)
        .join(' · ')

      const mapPage = entry.meta.mapPage ?? entry.meta.startPage + 2

      const pointItems = entry.meta.locations
        .map((loc, idx) => {
          const rawAddress = loc.address || i18nT('export:services.pdfExport.runtime.atlas.pointFallback', { value1: idx + 1 })
          const firstSegment = rawAddress.split(/\s*[·,]\s*/)[0]?.trim() || rawAddress
          return `
            <li style="
              display: flex;
              align-items: baseline;
              gap: 8px;
              padding: 3px 0;
              font-family: ${typography.bodyFont};
              font-size: 9pt;
              color: ${colors.text};
              line-height: 1.3;
              break-inside: avoid;
            ">
              <span style="
                flex-shrink: 0;
                min-width: 18px;
                font-weight: 700;
                color: ${entry.color};
                font-family: ${typography.headingFont};
                font-size: 8.5pt;
              ">${String(idx + 1).padStart(2, '0')}</span>
              <span style="
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              ">${escapeHtml(firstSegment)}</span>
            </li>
          `
        })
        .join('')

      return `
        <div style="
          margin-bottom: 6mm;
          break-inside: avoid;
          page-break-inside: avoid;
        ">
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            background: ${colors.surfaceAlt};
            border-left: 4px solid ${entry.color};
            border-radius: 0 10px 10px 0;
            margin-bottom: 3mm;
          ">
            <span style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 26px;
              height: 26px;
              border-radius: 50%;
              background: ${entry.color};
              color: #FFFFFF;
              font-weight: 800;
              font-size: 10pt;
              font-family: ${typography.headingFont};
              flex-shrink: 0;
            ">${entry.travelOrdinal}</span>
            <div style="flex: 1; min-width: 0;">
              <div style="
                font-family: ${typography.headingFont};
                font-size: 12pt;
                font-weight: 800;
                color: ${colors.text};
                line-height: 1.15;
                letter-spacing: -0.01em;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              ">${escapeHtml(travel.name)}</div>
              ${metaLine ? `
                <div style="
                  font-family: ${typography.bodyFont};
                  font-size: 8pt;
                  color: ${colors.textMuted};
                  margin-top: 1px;
                ">${metaLine}</div>
              ` : ''}
            </div>
            <div style="
              flex-shrink: 0;
              display: flex;
              align-items: baseline;
              gap: 4px;
              padding-left: 10px;
              border-left: 1px solid ${colors.border};
            ">
              <span style="
                font-size: 7pt;
                color: ${colors.textMuted};
                font-family: ${typography.bodyFont};
                letter-spacing: 0.1em;
                text-transform: uppercase;
                font-weight: 700;
              ">${i18nT("export:services.pdf_export.generators.v2.runtime.atlas.htmlPages.div_style_margin_bottom_6mm_break_inside_avo_ee8bc93c.text01")}</span>
              <span style="
                font-size: 16pt;
                font-weight: 800;
                color: ${entry.color};
                font-family: ${typography.headingFont};
                letter-spacing: -0.03em;
                line-height: 1;
              " data-atlas-page>${mapPage}</span>
            </div>
          </div>
          <ul style="
            list-style: none;
            padding: 0 4px 0 12px;
            margin: 0;
            columns: 2;
            column-gap: 14px;
          ">
            ${pointItems}
          </ul>
        </div>
      `
    })
    .join('')

  return `
    <section class="pdf-page atlas-page atlas-index-page" style="
      padding: ${spacing.pagePadding};
      background: ${colors.background};
      display: flex;
      flex-direction: column;
    ">
      <div style="
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 4mm;
        margin-bottom: 5mm;
        border-bottom: 2px solid ${colors.text};
      ">
        <div>
          <div style="
            font-size: 8pt;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: ${colors.accent};
            font-family: ${typography.bodyFont};
            margin-bottom: 2mm;
          ">${i18nT("export:services.pdf_export.generators.v2.runtime.atlas.htmlPages.section_class_pdf_page_atlas_page_atlas_inde_21541a38.text01", { value6: bookTitle ? escapeHtml(bookTitle) + ' · ' : '' })}</div>
          <h2 style="
            font-size: 24pt;
            font-weight: 800;
            color: ${colors.text};
            letter-spacing: -0.03em;
            font-family: ${typography.headingFont};
            line-height: 1;
            margin: 0;
          ">${headerKicker}${continuation}</h2>
        </div>
        <div style="
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2mm;
        ">
          <div style="
            font-size: 7.5pt;
            color: ${colors.textMuted};
            font-family: ${typography.bodyFont};
            letter-spacing: 0.12em;
            text-transform: uppercase;
            font-weight: 700;
          ">${pageIndex === 0 ? i18nT('export:services.pdfExport.runtime.atlas.pointsToPages') : i18nT('export:services.pdfExport.runtime.atlas.indexContinuation')}</div>
          <div style="
            font-size: 8.5pt;
            color: ${colors.text};
            font-family: ${typography.bodyFont};
            font-weight: 600;
          ">${totalTravels} · ${totalPoints} ${localizedNoun(totalPoints, 'export:services.pdfExport.runtime.atlas.pointNounForms')}</div>
        </div>
      </div>

      <div style="flex: 1;">
        ${groups}
      </div>

      <div style="
        margin-top: auto;
        padding-top: 4mm;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
      ">
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1.5px;
          background: linear-gradient(90deg, ${colors.accent}, ${colors.border} 40%, transparent);
          border-radius: 999px;
        "></div>
        <span style="
          font-size: 8pt;
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
          letter-spacing: 0.06em;
          font-weight: 600;
        ">${i18nT("export:services.pdf_export.generators.v2.runtime.atlas.htmlPages.section_class_pdf_page_atlas_page_atlas_inde_21541a38.text02", { value24: pageIndex + 2, value25: totalAtlasPages })}</span>
      </div>
    </section>
  `
}
