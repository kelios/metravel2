import type { BookSettings } from '@/components/export/BookSettingsModal'
import type { PdfThemeConfig } from '../../../../themes/PdfThemeConfig'
import { escapeHtml } from '../../../../utils/htmlUtils'
import { formatDays, getTravelLabel } from '../../../../utils/pluralize'

export { escapeHtml, formatDays, getTravelLabel }

export interface RuntimeRenderContext {
  theme: PdfThemeConfig
  settings?: BookSettings
}

export function buildRunningHeader(
  ctx: RuntimeRenderContext,
  travelName: string,
  pageNumber: number
): string {
  const { colors, typography } = ctx.theme
  return `
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 4mm;
      margin-bottom: 6mm;
      border-bottom: none;
      font-size: ${typography.caption.size};
      color: ${colors.textMuted};
      font-family: ${typography.bodyFont};
      letter-spacing: 0.02em;
      position: relative;
    ">
      <div style="
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 1.5px;
        background: linear-gradient(90deg, ${colors.accent}, ${colors.accentLight || colors.border} 40%, ${colors.border} 100%);
        border-radius: 999px;
      "></div>
      <div style="
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: 70%;
        min-width: 0;
      ">
        <span style="
          width: 14px;
          height: 2.5px;
          background: ${colors.accent};
          border-radius: 999px;
          flex-shrink: 0;
        "></span>
        <span style="
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-weight: 600;
        ">${escapeHtml(travelName)}</span>
      </div>
      <div style="
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <span style="
          font-size: 8pt;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          opacity: 0.65;
          font-weight: 600;
        ">MeTravel</span>
        <span style="
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
          line-height: 1;
        " data-page-num>${pageNumber}</span>
      </div>
    </div>
  `
}

export function getImageFilterStyle(ctx: RuntimeRenderContext): string {
  return ctx.theme.imageFilter ? `filter: ${ctx.theme.imageFilter};` : ''
}
