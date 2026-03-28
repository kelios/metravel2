import type { PdfThemeConfig } from '../../../themes/PdfThemeConfig'
import { escapeHtml } from '../../../utils/htmlUtils'
import { getTravelLabel } from '../../../utils/pluralize'
import {
  analyzeImageBrightness,
  analyzeImageComposition,
  getOptimalOverlayColor,
  getOptimalOverlayOpacity,
  getOptimalTextColor,
  getOptimalTextPosition,
} from '@/utils/imageAnalysis'

export interface SharedCoverPageData {
  title: string
  subtitle?: string
  userName: string
  travelCount: number
  yearRange?: string
  coverImage?: string
  quote?: {
    text: string
    author: string
  }
  textPosition?: 'top' | 'center' | 'bottom' | 'auto'
  overlayOpacity?: number
  showDecorations?: boolean
}

export async function generateSharedCoverPageMarkup(
  theme: PdfThemeConfig,
  data: SharedCoverPageData
): Promise<string> {
  const { colors } = theme
  const travelLabel = getTravelLabel(data.travelCount)
  const safeCoverImage = data.coverImage || undefined
  const formattedYearRange = String(data.yearRange || '').replace(/\s+-\s+/g, '–')

  let brightness = 128
  let composition = { topBusy: 0.5, centerBusy: 0.5, bottomBusy: 0.5 }
  let textPosition: 'top' | 'center' | 'bottom' = 'center'
  let overlayOpacity = 0.6
  let overlayColor = 'rgba(0,0,0,'
  let textColor = colors.cover.text

  if (safeCoverImage) {
    try {
      brightness = await analyzeImageBrightness(safeCoverImage)
      composition = await analyzeImageComposition(safeCoverImage)
      textPosition =
        data.textPosition === 'auto' || !data.textPosition
          ? getOptimalTextPosition(composition)
          : data.textPosition
      overlayOpacity = data.overlayOpacity ?? getOptimalOverlayOpacity(brightness)
      overlayColor = getOptimalOverlayColor(brightness)
      textColor = getOptimalTextColor(brightness)
    } catch (error) {
      console.warn('Image analysis failed, using defaults:', error)
    }
  }

  const background = `linear-gradient(135deg, ${colors.cover.backgroundGradient[0]} 0%, ${colors.cover.backgroundGradient[1]} 100%)`

  return `
    <section class="pdf-page cover-page" style="
      padding: 0;
      height: 285mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      color: ${colors.cover.text};
      background: ${background};
      position: relative;
      isolation: isolate;
      overflow: hidden;
    ">
      ${safeCoverImage ? renderCoverImageLayer(safeCoverImage) : ''}
      ${safeCoverImage ? renderSmartOverlay(overlayColor, overlayOpacity, textPosition) : ''}
      ${data.showDecorations !== false ? renderDecorativeElements() : ''}
      ${renderContent(theme, data, textPosition, textColor, Boolean(safeCoverImage))}
      ${renderFooterRail(
        theme,
        `${escapeHtml(String(data.travelCount))} ${travelLabel}${formattedYearRange ? ` • ${escapeHtml(formattedYearRange)}` : ''}`
      )}
    </section>
  `
}

function renderCoverImageLayer(coverImage: string): string {
  return `
    <div class="cover-image-layer" style="
      position: absolute;
      top: 0; right: 0; bottom: 0; left: 0;
      z-index: 0;
      overflow: hidden;
    ">
      <img
        class="cover-image"
        src="${escapeHtml(coverImage)}"
        alt=""
        style="
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        "
        onerror="this.style.display='none';"
      />
    </div>
  `
}

function renderSmartOverlay(
  overlayColor: string,
  opacity: number,
  textPosition: 'top' | 'center' | 'bottom'
): string {
  const gradient =
    textPosition === 'top'
      ? `linear-gradient(180deg, ${overlayColor}${opacity}) 0%, ${overlayColor}0.1) 50%, ${overlayColor}0.3) 100%)`
      : textPosition === 'bottom'
        ? `linear-gradient(180deg, ${overlayColor}0.3) 0%, ${overlayColor}0.1) 50%, ${overlayColor}${opacity}) 100%)`
        : `linear-gradient(180deg, ${overlayColor}0.4) 0%, ${overlayColor}0.1) 30%, ${overlayColor}0.1) 70%, ${overlayColor}0.4) 100%)`

  return `
    <div class="cover-smart-overlay" style="
      position: absolute;
      top: 0; right: 0; bottom: 0; left: 0;
      background: ${gradient};
      z-index: 1;
    "></div>
  `
}

function renderContent(
  theme: PdfThemeConfig,
  data: SharedCoverPageData,
  textPosition: 'top' | 'center' | 'bottom',
  textColor: string,
  hasImage: boolean
): string {
  const usesDarkText = isDarkTextColor(textColor)
  const justifyContent =
    textPosition === 'top' ? 'flex-start' : textPosition === 'bottom' ? 'flex-end' : 'center'
  const paddingTop = textPosition === 'top' ? '30mm' : '0'
  const paddingBottom = textPosition === 'bottom' ? '30mm' : '0'
  const panelBackground =
    hasImage ? (usesDarkText ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.75)') : 'transparent'
  const panelBorder =
    usesDarkText ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.25)'
  const panelShadow = hasImage ? '0 22px 52px rgba(15,23,42,0.32)' : 'none'

  return `
    <div class="cover-content-layer" style="
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: ${justifyContent};
      padding: ${paddingTop} 24mm ${paddingBottom} 24mm;
      align-items: ${textPosition === 'center' ? 'center' : 'flex-start'};
      position: relative;
      z-index: 2;
    ">
      <div class="cover-story-panel" style="
        width: 126mm;
        max-width: 100%;
        padding: ${hasImage ? '11mm 13mm 11mm 13mm' : '0'};
        border-radius: 18px;
        background: ${panelBackground};
        border: ${hasImage ? `1px solid ${panelBorder}` : 'none'};
        box-shadow: ${panelShadow};
        backdrop-filter: ${hasImage ? 'blur(8px)' : 'none'};
        -webkit-backdrop-filter: ${hasImage ? 'blur(8px)' : 'none'};
        text-align: left;
      ">
        ${renderKicker(theme, textColor)}
        ${renderTitle(theme, data.title, textColor)}
        ${data.subtitle ? renderSubtitle(theme, data.subtitle, textColor) : ''}
        ${renderMetaStrip(theme, data, textColor)}
        ${data.quote ? renderQuote(data.quote, textColor) : ''}
      </div>
    </div>
  `
}

function renderKicker(theme: PdfThemeConfig, textColor?: string): string {
  const usesDarkText = isDarkTextColor(textColor)
  return `
    <div style="
      display: inline-flex;
      align-items: center;
      gap: 7px;
      margin-bottom: 5mm;
      padding: 5px 12px 5px 10px;
      border-radius: 999px;
      background: ${usesDarkText ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.12)'};
      border: 1px solid ${usesDarkText ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.16)'};
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: ${textColor || 'rgba(255,255,255,0.84)'};
      font-family: ${theme.typography.bodyFont};
    ">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="${textColor || 'rgba(255,255,255,0.84)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      <span>Книга путешествий</span>
    </div>
  `
}

function renderMetaStrip(theme: PdfThemeConfig, data: SharedCoverPageData, textColor?: string): string {
  const usesDarkText = isDarkTextColor(textColor)
  const travelLabel = getTravelLabel(data.travelCount)
  const items = [
    data.userName ? escapeHtml(data.userName) : null,
    Number.isFinite(data.travelCount) ? `${escapeHtml(String(data.travelCount))} ${travelLabel}` : null,
    data.yearRange ? escapeHtml(data.yearRange) : null,
  ].filter(Boolean)

  if (!items.length) return ''

  return `
    <div style="
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 5mm;
    ">
      ${items.map((item) => `
        <span style="
          display: inline-flex;
          align-items: center;
          padding: 4px 9px;
          border-radius: 999px;
          background: ${usesDarkText ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.12)'};
          border: 1px solid ${usesDarkText ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.16)'};
          color: ${textColor || 'rgba(255,255,255,0.9)'};
          font-size: 9pt;
          line-height: 1.2;
          font-weight: 600;
          font-family: ${theme.typography.bodyFont};
        ">${item}</span>
      `).join('')}
    </div>
  `
}

function renderCornerMark(position: string, rotate: string): string {
  return `
    <div style="
      position: absolute;
      ${position}
      width: 18mm;
      height: 18mm;
      pointer-events: none;
      z-index: 1;
      transform: ${rotate};
    ">
      <svg viewBox="0 0 60 60" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 28 L4 4 L28 4" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="4" cy="4" r="2" fill="rgba(255,255,255,0.25)"/>
      </svg>
    </div>
  `
}

function renderDecorativeElements(): string {
  return `
    <div style="
      position: absolute;
      top: 14mm; right: 14mm; bottom: 14mm; left: 14mm;
      border: 2px solid rgba(255,255,255,0.25);
      border-radius: 14px;
      pointer-events: none;
      z-index: 1;
    "></div>
    <div style="
      position: absolute;
      top: 17mm; right: 17mm; bottom: 17mm; left: 17mm;
      border: 0.5px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      pointer-events: none;
      z-index: 1;
    "></div>
    ${renderCornerMark('top: 10mm; left: 10mm;', 'rotate(0deg)')}
    ${renderCornerMark('top: 10mm; right: 10mm;', 'rotate(90deg)')}
    ${renderCornerMark('bottom: 10mm; right: 10mm;', 'rotate(180deg)')}
    ${renderCornerMark('bottom: 10mm; left: 10mm;', 'rotate(270deg)')}
  `
}

function renderSubtitle(theme: PdfThemeConfig, subtitle: string, textColor?: string): string {
  const opacity = isDarkTextColor(textColor) ? '0.7' : '0.88'
  return `
    <div style="
      font-size: 13pt;
      letter-spacing: 0.02em;
      color: ${textColor || 'rgba(255,255,255,0.88)'};
      opacity: ${opacity};
      margin-top: 4mm;
      font-family: ${theme.typography.bodyFont};
      max-width: 104mm;
      line-height: 1.55;
    ">${escapeHtml(subtitle)}</div>
  `
}

function getCoverTitleStyle(theme: PdfThemeConfig, title: string): {
  fontSize: string
  lineHeight: number
  maxWidth: string
  letterSpacing: string
} {
  const normalized = (title || '').trim()
  const length = normalized.length

  if (length >= 100) {
    return { fontSize: '23pt', lineHeight: 1.08, maxWidth: '118mm', letterSpacing: '0' }
  }
  if (length >= 75) {
    return { fontSize: '26pt', lineHeight: 1.08, maxWidth: '114mm', letterSpacing: '0.01em' }
  }
  return {
    fontSize: String(theme.typography.h1.size),
    lineHeight: 1.08,
    maxWidth: '102mm',
    letterSpacing: '0.02em',
  }
}

function renderTitle(theme: PdfThemeConfig, title: string, textColor?: string): string {
  const color = textColor || theme.colors.cover.text
  const safeTitle = (title || '').trim()
  if (!safeTitle) return ''
  const titleStyle = getCoverTitleStyle(theme, safeTitle)

  return `
    <div style="
      width: 32mm;
      height: 3px;
      background: linear-gradient(90deg, ${theme.colors.accent}, ${theme.colors.accentStrong});
      border-radius: 999px;
      margin: 0 0 6mm 0;
    "></div>
    <h1 style="
      color: ${color};
      font-size: ${titleStyle.fontSize};
      font-weight: 800;
      line-height: ${titleStyle.lineHeight};
      margin: 0;
      text-shadow: 0 6px 18px rgba(15,23,42,0.2);
      letter-spacing: ${titleStyle.letterSpacing};
      font-family: ${theme.typography.headingFont};
      overflow-wrap: break-word;
      word-break: normal;
      hyphens: auto;
      max-width: ${titleStyle.maxWidth};
    ">${escapeHtml(safeTitle)}</h1>
  `
}

function renderDate(theme: PdfThemeConfig): string {
  const dateStr = new Date().toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return `
    <span style="
      font-size: 9pt;
      opacity: 0.75;
      font-family: ${theme.typography.bodyFont};
    ">Создано ${dateStr}</span>
  `
}

function renderQuote(quote: { text: string; author: string }, textColor?: string): string {
  const usesDarkText = isDarkTextColor(textColor)
  return `
    <div style="
      margin-top: 11mm;
      max-width: 100%;
      font-style: italic;
      color: ${textColor || 'rgba(255,255,255,0.85)'};
      padding: 10px 14px 10px 16px;
      background: ${usesDarkText ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.08)'};
      border-radius: 14px;
      border-left: 3px solid ${usesDarkText ? 'rgba(15,23,42,0.22)' : 'rgba(255,255,255,0.3)'};
      position: relative;
    ">
      <span style="
        position: absolute;
        top: -2mm;
        left: 8px;
        font-size: 36pt;
        line-height: 1;
        font-family: Georgia, 'Times New Roman', serif;
        opacity: 0.25;
        font-style: normal;
        color: ${textColor || 'rgba(255,255,255,0.85)'};
      ">«</span>
      <div style="font-size: 11pt; margin-bottom: 4mm; line-height: 1.55; padding-top: 4mm;">
        ${escapeHtml(quote.text)}
      </div>
      <div style="font-size: 9pt; opacity: 0.7; letter-spacing: 0.04em; font-style: normal;">
        — ${escapeHtml(quote.author)}
      </div>
    </div>
  `
}

function isDarkTextColor(textColor?: string): boolean {
  const normalized = String(textColor || '').trim().toLowerCase()
  if (
    normalized === '#000' ||
    normalized === '#000000' ||
    normalized === 'black' ||
    normalized === 'rgb(0, 0, 0)' ||
    normalized === 'rgb(0,0,0)'
  ) return true

  // Проверяем hex-цвета на тёмность (luminance < 50%)
  const hexMatch = normalized.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/)
  if (hexMatch) {
    const r = parseInt(hexMatch[1], 16)
    const g = parseInt(hexMatch[2], 16)
    const b = parseInt(hexMatch[3], 16)
    return (r * 299 + g * 587 + b * 114) / 1000 < 128
  }
  return false
}

function renderFooterRail(theme: PdfThemeConfig, metaLine: string): string {
  const { colors } = theme
  const g0 = colors.cover.backgroundGradient[0]
  const g1 = colors.cover.backgroundGradient[1]
  return `
    <div class="cover-footer-rail" style="
      margin: 0 24mm 16mm 24mm;
      padding: 8mm 10mm;
      position: relative;
      z-index: 2;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 10mm;
      border-radius: 18px;
      background: linear-gradient(135deg, ${g0}cc, ${g1}bb);
      border: 1px solid rgba(255,255,255,0.18);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
    ">
      <div style="
        display: flex;
        flex-direction: column;
        gap: 2mm;
        min-width: 0;
      ">
        <div style="
          font-size: 8.5pt;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.62);
          font-weight: 600;
        ">Книга путешествий</div>
        <div style="
          font-size: 11pt;
          letter-spacing: 0.02em;
          color: rgba(255,255,255,0.92);
          font-weight: 500;
          overflow-wrap: anywhere;
          word-break: break-word;
          hyphens: auto;
        ">${metaLine}</div>
      </div>
      <div style="
        text-align: right;
        min-width: 30mm;
      ">
        <div style="
          font-size: 10pt;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: rgba(255,255,255,0.92);
          text-transform: uppercase;
          margin-bottom: 2mm;
        ">MeTravel.by</div>
        ${renderDate(theme)}
      </div>
    </div>
  `
}
