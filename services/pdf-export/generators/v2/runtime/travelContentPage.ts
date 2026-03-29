import type { TravelForBook } from '@/types/pdf-export'
import type { PdfThemeConfig } from '../../../themes/PdfThemeConfig'
import type { ParsedContentBlock } from '../../../parsers/ContentParser'
import type { BookSettings } from '@/components/export/BookSettingsModal'
import type { PdfIconName } from './pdfVisualHelpers'

type TravelContentVariant = 'runtime' | 'standalone'

function buildSectionDivider(colors: PdfThemeConfig['colors']): string {
  return `
    <div style="
      text-align: center;
      margin: 6mm 0;
      color: ${colors.textMuted};
      font-size: 12pt;
      letter-spacing: 0.5em;
      opacity: 0.35;
      user-select: none;
    ">· · ·</div>
  `
}

function buildDropCapHtml(html: string, colors: PdfThemeConfig['colors'], typography: PdfThemeConfig['typography']): string {
  const stripped = html.replace(/^[\s]*/, '')
  const pMatch = stripped.match(/^<p[^>]*>([\s\S]*?)<\/p>/i)
  if (!pMatch) return html

  const innerHtml = pMatch[1].replace(/^[\s]*/, '')
  const firstChar = innerHtml.match(/^(&[^;]+;|[^\s<])/)?.[0]
  if (!firstChar || firstChar.length === 0) return html

  const rest = innerHtml.slice(firstChar.length)
  const dropCapParagraph = `<p style="margin-bottom: ${typography.body.marginBottom}; line-height: ${typography.body.lineHeight}; text-align: justify;">
    <span style="
      float: left;
      font-size: 42pt;
      line-height: 0.82;
      font-weight: 800;
      color: ${colors.accent};
      font-family: ${typography.headingFont};
      margin-right: 3px;
      margin-top: 4px;
      padding-bottom: 2px;
    ">${firstChar}</span>${rest}</p>`

  return stripped.replace(pMatch[0], dropCapParagraph)
}

export function renderTravelContentPageMarkup(args: {
  travel: TravelForBook
  pageNumber: number
  theme: PdfThemeConfig
  qrCode?: string
  variant: TravelContentVariant
  descriptionHtml: string
  recommendationBlocks: ParsedContentBlock[]
  plusBlocks: ParsedContentBlock[]
  minusBlocks: ParsedContentBlock[]
  renderBlocks: (blocks: ParsedContentBlock[]) => string
  renderPdfIcon: (name: PdfIconName, color: string, size: number) => string
  escapeHtml: (value: string | null | undefined) => string
  headerHtml?: string
  statsHtml?: string
  inlineGalleryHtml?: string
  showInlineGallery?: boolean
  includeGallery?: BookSettings['includeGallery']
  hasGalleryMedia?: boolean
}): string {
  const {
    travel,
    pageNumber,
    theme,
    qrCode = '',
    variant,
    descriptionHtml,
    recommendationBlocks,
    plusBlocks,
    minusBlocks,
    renderBlocks,
    renderPdfIcon,
    escapeHtml,
    headerHtml = '',
    statsHtml = '',
    inlineGalleryHtml = '',
    showInlineGallery = false,
    includeGallery,
    hasGalleryMedia = false,
  } = args

  const { colors, typography, spacing } = theme
  const url = travel.slug ? `https://metravel.by/travels/${travel.slug}` : travel.url
  const shouldShowInlineGallery =
    showInlineGallery &&
    !(includeGallery !== false && hasGalleryMedia)

  const processedDescriptionHtml = variant === 'runtime' && descriptionHtml
    ? buildDropCapHtml(descriptionHtml, colors, typography)
    : descriptionHtml

  const buildSectionHeader = (iconName: PdfIconName, iconColor: string, iconBg: string, title: string) => `
    <div style="
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: ${spacing.elementSpacing};
      padding-bottom: 8px;
      position: relative;
    ">
      <span style="
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        background: ${iconBg};
        flex-shrink: 0;
      ">${renderPdfIcon(iconName, iconColor, 15)}</span>
      <h2 style="
        font-size: ${typography.h2.size};
        font-weight: ${typography.h2.weight};
        color: ${colors.text};
        margin: 0;
        font-family: ${typography.headingFont};
      ">${title}</h2>
      <div style="
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, ${colors.accent}, ${colors.accentSoft} 50%, transparent);
        border-radius: 999px;
      "></div>
    </div>
  `

  const descriptionSection = processedDescriptionHtml
    ? `
          <div style="margin-bottom: ${spacing.sectionSpacing}; break-inside: auto; page-break-inside: auto;">
            ${
              variant === 'runtime'
                ? buildSectionHeader('pen', colors.accent, colors.accentSoft, 'Описание')
                : `
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: ${spacing.elementSpacing};
              padding-bottom: 8px;
              border-bottom: 2px solid ${colors.accentSoft};
            ">
              ${renderPdfIcon('pen', colors.text, 20)}
              <h2 style="
                font-size: ${typography.h2.size};
                font-weight: ${typography.h2.weight};
                color: ${colors.accent};
                margin: 0;
                font-family: ${typography.headingFont};
              ">Описание</h2>
            </div>`
            }
            <div${variant === 'runtime' ? ' class="description-block"' : ''} style="
              font-size: ${typography.body.size};
              line-height: 1.75;
              color: ${colors.text};
              font-family: ${typography.bodyFont};
              break-inside: auto;
              page-break-inside: auto;
            ">${processedDescriptionHtml}</div>
          </div>
        `
    : variant === 'standalone'
      ? `
          <div style="margin-bottom: ${spacing.sectionSpacing};">
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: ${spacing.elementSpacing};
              padding-bottom: 8px;
              border-bottom: 2px solid ${colors.accentSoft};
            ">
              ${renderPdfIcon('pen', colors.text, 20)}
              <h2 style="
                font-size: ${typography.h2.size};
                font-weight: ${typography.h2.weight};
                color: ${colors.accent};
                margin: 0;
                font-family: ${typography.headingFont};
              ">Описание</h2>
            </div>
            <p style="
              color: ${colors.textMuted};
              font-style: italic;
              margin: 0;
              font-family: ${typography.bodyFont};
            ">Описание путешествия отсутствует</p>
          </div>
        `
      : ''

  const hasDividerBetweenSections = variant === 'runtime'
  const divider = hasDividerBetweenSections ? buildSectionDivider(colors) : ''

  const recommendationSection =
    recommendationBlocks.length > 0
      ? `
          ${divider}
          <div style="margin-bottom: ${spacing.sectionSpacing}; break-inside: avoid; page-break-inside: avoid;">
            ${
              variant === 'runtime'
                ? buildSectionHeader('bulb', colors.infoBlock.icon, colors.infoBlock.background, 'Рекомендации')
                : `
            <div style="
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: ${spacing.elementSpacing};
              padding-bottom: 8px;
              border-bottom: 2px solid ${colors.accentSoft};
            ">
              ${renderPdfIcon('bulb', colors.text, 20)}
              <h2 style="
                font-size: ${typography.h2.size};
                font-weight: ${typography.h2.weight};
                color: ${colors.accent};
                margin: 0;
                font-family: ${typography.headingFont};
              ">Рекомендации</h2>
            </div>`
            }
            <div style="
              font-size: ${typography.body.size};
              line-height: ${typography.body.lineHeight};
              color: ${colors.text};
              font-family: ${typography.bodyFont};
            ">${renderBlocks(recommendationBlocks)}</div>
          </div>
        `
      : ''

  const prosConsSection =
    plusBlocks.length > 0 || minusBlocks.length > 0
      ? variant === 'runtime'
        ? `
          ${divider}
          <div style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: ${spacing.elementSpacing};
            margin-top: ${spacing.blockSpacing};
            break-inside: avoid;
            page-break-inside: avoid;
          ">
            ${plusBlocks.length > 0 ? `
              <div style="
                background: ${colors.tipBlock.background};
                border-radius: ${theme.blocks.borderRadius};
                padding: ${spacing.elementSpacing} ${spacing.blockSpacing};
                border: ${theme.blocks.borderWidth} solid ${colors.tipBlock.border};
                border-left: 4px solid ${colors.tipBlock.icon};
                box-shadow: ${theme.blocks.shadow};
                break-inside: avoid;
                page-break-inside: avoid;
              ">
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: ${spacing.elementSpacing};
                ">
                  <span style="
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    border-radius: 6px;
                    background: ${colors.tipBlock.border};
                    flex-shrink: 0;
                  ">${renderPdfIcon('sparkle', colors.tipBlock.text, 13)}</span>
                  <h3 style="
                    margin: 0;
                    color: ${colors.tipBlock.text};
                    font-size: ${typography.h4.size};
                    font-weight: ${typography.h4.weight};
                    font-family: ${typography.headingFont};
                  ">Плюсы</h3>
                </div>
                <div style="
                  font-size: ${typography.small.size};
                  line-height: ${typography.small.lineHeight};
                  color: ${colors.tipBlock.text};
                  font-family: ${typography.bodyFont};
                ">${renderBlocks(plusBlocks)}</div>
              </div>
            ` : ''}
            ${minusBlocks.length > 0 ? `
              <div style="
                background: ${colors.dangerBlock.background};
                border-radius: ${theme.blocks.borderRadius};
                padding: ${spacing.elementSpacing} ${spacing.blockSpacing};
                border: ${theme.blocks.borderWidth} solid ${colors.dangerBlock.border};
                border-left: 4px solid ${colors.dangerBlock.icon};
                box-shadow: ${theme.blocks.shadow};
                break-inside: avoid;
                page-break-inside: avoid;
              ">
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: ${spacing.elementSpacing};
                ">
                  <span style="
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    border-radius: 6px;
                    background: ${colors.dangerBlock.border};
                    flex-shrink: 0;
                  ">${renderPdfIcon('warning', colors.dangerBlock.text, 13)}</span>
                  <h3 style="
                    margin: 0;
                    color: ${colors.dangerBlock.text};
                    font-size: ${typography.h4.size};
                    font-weight: ${typography.h4.weight};
                    font-family: ${typography.headingFont};
                  ">Минусы</h3>
                </div>
                <div style="
                  font-size: ${typography.small.size};
                  line-height: ${typography.small.lineHeight};
                  color: ${colors.dangerBlock.text};
                  font-family: ${typography.bodyFont};
                ">${renderBlocks(minusBlocks)}</div>
              </div>
            ` : ''}
          </div>
        `
        : `
          <div style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: ${spacing.elementSpacing};
            margin-bottom: ${spacing.sectionSpacing};
          ">
            ${plusBlocks.length > 0 ? `
              <div>
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: 8px;
                ">
                  ${renderPdfIcon('thumbs-up', colors.accent, 18)}
                  <h3 style="
                    font-size: ${typography.h3.size};
                    font-weight: ${typography.h3.weight};
                    color: ${colors.accent};
                    margin: 0;
                    font-family: ${typography.headingFont};
                  ">Плюсы</h3>
                </div>
                <div style="
                  font-size: ${typography.body.size};
                  line-height: ${typography.body.lineHeight};
                  color: ${colors.text};
                  font-family: ${typography.bodyFont};
                ">${renderBlocks(plusBlocks)}</div>
              </div>
            ` : ''}
            ${minusBlocks.length > 0 ? `
              <div>
                <div style="
                  display: flex;
                  align-items: center;
                  gap: 8px;
                  margin-bottom: 8px;
                ">
                  ${renderPdfIcon('thumbs-down', colors.textMuted, 18)}
                  <h3 style="
                    font-size: ${typography.h3.size};
                    font-weight: ${typography.h3.weight};
                    color: ${colors.textMuted};
                    margin: 0;
                    font-family: ${typography.headingFont};
                  ">Минусы</h3>
                </div>
                <div style="
                  font-size: ${typography.body.size};
                  line-height: ${typography.body.lineHeight};
                  color: ${colors.text};
                  font-family: ${typography.bodyFont};
                ">${renderBlocks(minusBlocks)}</div>
              </div>
            ` : ''}
          </div>
        `
      : ''

  const onlineSection =
    url
      ? variant === 'runtime'
        ? `
          ${divider}
          <div class="travel-online-card" style="
            display: flex;
            gap: 14px;
            align-items: center;
            margin-top: ${spacing.sectionSpacing};
            padding: 12px 14px;
            border-radius: 18px;
            background: ${colors.surfaceAlt};
            border: 1px solid ${colors.border};
            border-left: 4px solid ${colors.accent};
            break-inside: avoid;
            page-break-inside: avoid;
          ">
            ${qrCode ? `
              <div style="
                width: 28mm;
                height: 28mm;
                padding: 2mm;
                border-radius: 12px;
                background: white;
                border: 1px solid ${colors.border};
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
              ">
                <img src="${escapeHtml(qrCode)}" alt="QR" style="
                  width: 100%;
                  height: 100%;
                  display: block;
                " />
              </div>
            ` : ''}
            <div style="
              font-size: ${typography.small.size};
              color: ${colors.textMuted};
              flex: 1;
              font-family: ${typography.bodyFont};
              min-width: 0;
            ">
              <div style="
                display: inline-flex;
                align-items: center;
                gap: 5px;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                font-weight: 700;
                margin-bottom: 4px;
                color: ${colors.accent};
                font-size: ${typography.caption.size};
                font-family: ${typography.headingFont};
              ">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="${colors.accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                Онлайн-версия
              </div>
              <div style="
                line-height: 1.4;
                color: ${colors.textSecondary};
                margin-bottom: 6px;
              ">Сканируйте QR-код для просмотра маршрута</div>
              <div style="
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 10px;
                border-radius: 999px;
                background: ${colors.surface};
                border: 1px solid ${colors.border};
                color: ${colors.text};
                font-size: ${typography.caption.size};
                line-height: 1.3;
                max-width: 100%;
              ">
                <span style="
                  font-weight: 700;
                  color: ${colors.accentStrong};
                  white-space: nowrap;
                ">metravel.by</span>
                <span style="
                  overflow-wrap: anywhere;
                  word-break: break-word;
                ">${escapeHtml(String(url).replace(/^https?:\/\//i, ''))}</span>
              </div>
            </div>
          </div>
        `
        : qrCode && url
          ? `
          <div style="
            margin-top: ${spacing.sectionSpacing};
            padding: ${spacing.blockSpacing};
            background: ${colors.surfaceAlt};
            border-radius: 14px;
            display: flex;
            align-items: center;
            gap: 16px;
            border: 1px solid ${colors.border};
          ">
            <img src="${escapeHtml(qrCode)}" alt="QR код" style="width: 70px; height: 70px;" />
            <div style="flex: 1;">
              <div style="
                font-size: ${typography.body.size};
                font-weight: 600;
                color: ${colors.text};
                margin-bottom: 4px;
                font-family: ${typography.bodyFont};
              ">Читать онлайн</div>
              <div style="
                font-size: ${typography.caption.size};
                color: ${colors.textMuted};
                font-family: ${typography.bodyFont};
              ">${escapeHtml(String(url))}</div>
            </div>
          </div>
        `
          : ''
      : ''

  return `
      <section class="pdf-page travel-content-page" style="padding: 0 ${spacing.pagePadding}; position: relative;">
        <style>
          .travel-content-page p {
            margin-bottom: ${typography.body.marginBottom};
            line-height: 1.75;
            text-align: justify;
            orphans: 2;
            widows: 2;
          }
          .travel-content-page h1,
          .travel-content-page h2,
          .travel-content-page h3 {
            page-break-after: avoid;
            orphans: 3;
            widows: 3;
          }
          .content-layout { width: 100%; border-collapse: collapse; }
          .content-layout td { padding: 0; vertical-align: top; border: none; }
          .content-layout thead { display: table-header-group; }
          .content-layout thead td { height: 14mm; border-bottom: 1.5px solid ${colors.border}; }
        </style>
        <table class="content-layout">
          <thead><tr><td aria-hidden="true"></td></tr></thead>
          <tbody><tr><td style="padding: ${spacing.pagePadding} 0;">
            ${headerHtml}
            ${statsHtml}
            ${descriptionSection}
            ${shouldShowInlineGallery ? inlineGalleryHtml : ''}
            ${recommendationSection}
            ${prosConsSection}
            ${onlineSection}
          </td></tr></tbody>
        </table>
        ${
          variant === 'standalone'
            ? `
        <div style="
          position: absolute;
          bottom: 15mm;
          right: 25mm;
          font-size: ${typography.caption.size};
          color: ${colors.textMuted};
          font-weight: 500;
          font-family: ${typography.bodyFont};
        " data-page-num>${pageNumber}</div>`
            : ''
        }
      </section>
    `
}
