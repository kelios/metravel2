import type { BookSettings } from '@/components/export/BookSettingsModal'
import type { TravelForBook } from '@/types/pdf-export'
import type { PdfThemeConfig } from '../../../themes/PdfThemeConfig'

type TravelPhotoLayout = NonNullable<BookSettings['photoPageLayout']> | 'full-bleed'

export function renderTravelPhotoPageMarkup(args: {
  travel: TravelForBook
  pageNumber: number
  theme: PdfThemeConfig
  layout?: TravelPhotoLayout
  buildSafeImageUrl: (url?: string | null) => string | undefined
  escapeHtml: (value: string | null | undefined) => string
  formatDays: (days?: number | null) => string
  buildContainImage: (
    src: string,
    alt: string,
    height: string,
    opts?: { onerrorBg?: string; extraStyle?: string }
  ) => string
  getImageFilterStyle: () => string
}): string {
  const {
    travel,
    pageNumber,
    theme,
    layout = 'full-bleed',
    buildSafeImageUrl,
    escapeHtml,
    formatDays,
    buildContainImage,
    getImageFilterStyle,
  } = args

  const { colors, typography, spacing } = theme
  const coverImage = buildSafeImageUrl(travel.travel_image_url || travel.travel_image_thumb_url)
  const metaPieces = [
    travel.countryName ? escapeHtml(travel.countryName) : null,
    travel.year ? escapeHtml(String(travel.year)) : null,
    formatDays(travel.number_days),
  ].filter(Boolean)
  const metaHtml = metaPieces.length ? escapeHtml(metaPieces.join(' \u2022 ')) : ''

  const travelIndex = travel.index != null ? travel.index : pageNumber

  const noImageFallback = `
      <div style="
        border-radius: ${theme.blocks.borderRadius};
        background: linear-gradient(135deg, ${colors.accentSoft} 0%, ${colors.accentLight} 100%);
        height: 235mm;
        display: flex;
        align-items: center;
        justify-content: center;
        color: ${colors.accentStrong};
        box-shadow: ${theme.blocks.shadow};
      ">
        <h1 style="
          font-size: ${typography.h1.size};
          font-weight: ${typography.h1.weight};
          text-align: center;
          padding: 20mm;
          font-family: ${typography.headingFont};
        ">${escapeHtml(travel.name)}</h1>
      </div>
    `

  let content: string

  if (!coverImage) {
    content = noImageFallback
  } else if (layout === 'framed') {
    content = `
        <div style="
          display: flex;
          flex-direction: column;
          height: 100%;
          min-height: 240mm;
        ">
          <div style="
            flex: 1;
            border-radius: ${theme.blocks.borderRadius};
            overflow: hidden;
            box-shadow: 0 20px 50px rgba(15,23,42,0.18), 0 8px 20px rgba(15,23,42,0.10);
            border: 14px solid ${colors.surface};
            outline: 1px solid ${colors.border};
            background: ${colors.surfaceAlt};
            position: relative;
          ">
            ${buildContainImage(coverImage, escapeHtml(travel.name), '100%', { onerrorBg: colors.accentSoft })}
          </div>
          <div style="
            text-align: center;
            padding: 8mm 10mm 0 10mm;
          ">
            <h1 style="
              font-size: ${typography.h1.size};
              font-weight: ${typography.h1.weight};
              line-height: ${typography.h1.lineHeight};
              color: ${colors.text};
              margin: 0 0 3mm 0;
              font-family: ${typography.headingFont};
              overflow-wrap: anywhere;
              word-break: break-word;
            ">${escapeHtml(travel.name)}</h1>
            ${metaHtml ? `
              <div style="
                color: ${colors.textMuted};
                font-size: 11pt;
                font-weight: 500;
                font-family: ${typography.bodyFont};
              ">${metaHtml}</div>
            ` : ''}
          </div>
        </div>
      `
  } else if (layout === 'split') {
    content = `
        <div style="
          display: flex;
          height: 100%;
          min-height: 240mm;
          gap: 0;
          border-radius: ${theme.blocks.borderRadius};
          overflow: hidden;
          box-shadow: ${theme.blocks.shadow};
        ">
          <div style="
            width: 64%;
            position: relative;
            overflow: hidden;
            background: ${colors.surfaceAlt};
          ">
            ${buildContainImage(coverImage, escapeHtml(travel.name), '100%', { onerrorBg: colors.accentSoft })}
          </div>
          <div style="
            width: 0;
            border-left: 2px solid ${colors.accentStrong};
            flex-shrink: 0;
          "></div>
          <div style="
            width: 36%;
            background: linear-gradient(180deg, ${colors.cover.backgroundGradient[0]} 0%, ${colors.cover.backgroundGradient[1]} 100%);
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 12mm;
            color: ${colors.cover.text};
          ">
            <h1 style="
              font-size: ${typography.h2.size};
              font-weight: ${typography.h1.weight};
              line-height: ${typography.h1.lineHeight};
              margin: 0 0 6mm 0;
              font-family: ${typography.headingFont};
              overflow-wrap: anywhere;
              word-break: break-word;
              hyphens: auto;
            ">${escapeHtml(travel.name)}</h1>
            ${metaHtml ? `
              <div style="
                font-size: 10pt;
                font-weight: 500;
                opacity: 0.85;
                font-family: ${typography.bodyFont};
                line-height: 1.5;
              ">${metaHtml}</div>
            ` : ''}
          </div>
        </div>
      `
  } else {
    content = `
        <div style="
          border-radius: ${theme.blocks.borderRadius};
          overflow: hidden;
          position: relative;
          box-shadow: ${theme.blocks.shadow};
          height: 100%;
          min-height: 235mm;
        ">
          <img src="${escapeHtml(coverImage)}" alt="${escapeHtml(travel.name)}"
            style="
              width: 100%;
              height: 100%;
              min-height: 235mm;
              display: block;
              object-fit: cover;
              object-position: center;
              ${getImageFilterStyle()}
            "
            onerror="this.style.display='none'; this.parentElement.style.background='linear-gradient(180deg, ${colors.accentLight} 0%, ${colors.accentSoft} 100%)';" />
          <div style="
            position: absolute;
            top: 0; right: 0; bottom: 0; left: 0;
            background:
              linear-gradient(180deg, rgba(15,23,42,0.04) 0%, rgba(15,23,42,0.18) 100%),
              linear-gradient(180deg, rgba(255,255,255,0.0) 48%, rgba(15,23,42,0.22) 100%);
          "></div>
          <div style="
            position: absolute;
            top: 10mm;
            right: 10mm;
            font-size: 48pt;
            font-weight: 800;
            font-family: ${typography.headingFont};
            color: rgba(255,255,255,0.18);
            line-height: 1;
            pointer-events: none;
          ">${travelIndex}</div>
          <div style="
            position: absolute;
            left: 14mm;
            right: auto;
            bottom: 14mm;
            max-width: 116mm;
            padding: 11mm 12mm 10mm 12mm;
            border-radius: 20px;
            background: rgba(255,255,255,0.92);
            border: 1px solid rgba(255,255,255,0.72);
            box-shadow: 0 18px 42px rgba(15,23,42,0.16);
          ">
            ${metaPieces.length ? `
              <div style="
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-bottom: 3mm;
              ">
                ${metaPieces.map((part) => `
                  <span style="
                    display: inline-flex;
                    align-items: center;
                    padding: 4px 9px;
                    border-radius: 999px;
                    background: ${colors.accentLight};
                    border: 1px solid ${colors.border};
                    color: ${colors.textSecondary};
                    font-size: ${typography.caption.size};
                    line-height: 1.2;
                    font-weight: 600;
                    font-family: ${typography.bodyFont};
                  ">${escapeHtml(part)}</span>
                `).join('')}
              </div>
              <div style="
                width: 40mm;
                height: 3px;
                border-radius: 2px;
                background: linear-gradient(90deg, ${colors.accentStrong}, ${colors.accentLight});
                margin-bottom: 5mm;
              "></div>
            ` : ''}
            <h1 style="
              color: ${colors.text};
              font-size: ${typography.h1.size};
              margin: 0;
              font-weight: ${typography.h1.weight};
              line-height: 1.12;
              font-family: ${typography.headingFont};
              overflow-wrap: anywhere;
              word-break: break-word;
              hyphens: auto;
            ">${escapeHtml(travel.name)}</h1>
          </div>
        </div>
      `
  }

  return `
      <section class="pdf-page travel-photo-page" style="padding: ${spacing.pagePadding};">
        ${content}
        <div style="
          position: absolute;
          bottom: 15mm;
          right: 25mm;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 6px;
          background: ${colors.accentSoft};
          color: ${colors.accentStrong};
          font-size: 8pt;
          font-weight: 700;
          font-family: ${typography.headingFont};
        " data-page-num>${pageNumber}</div>
      </section>
    `
}
