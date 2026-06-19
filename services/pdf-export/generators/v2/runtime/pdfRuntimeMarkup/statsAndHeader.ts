import type {
  BuildStatsMiniCardParams,
  BuildRunningHeaderParams,
} from './types'

export function buildPdfStatsMiniCard({
  travel,
  theme,
  colors,
  typography,
  spacing,
  escapeHtml,
  formatDays,
  renderPdfIcon,
}: BuildStatsMiniCardParams): string {
  const items: Array<{ icon: string; value: string }> = []

  const iconColor = colors.accent
  const iconSize = 11

  if (travel.countryName) {
    items.push({ icon: renderPdfIcon('globe', iconColor, iconSize), value: travel.countryName })
  }
  if (travel.year) {
    items.push({ icon: renderPdfIcon('calendar', iconColor, iconSize), value: String(travel.year) })
  }
  if (typeof travel.number_days === 'number' && travel.number_days > 0) {
    items.push({ icon: renderPdfIcon('clock', iconColor, iconSize), value: formatDays(travel.number_days) })
  }

  const photoCount = (travel.gallery || []).length
  if (photoCount > 0) {
    items.push({ icon: renderPdfIcon('camera', iconColor, iconSize), value: `${photoCount} фото` })
  }

  const locationCount = (travel.travelAddress || []).length
  if (locationCount > 0) {
    items.push({
      icon: renderPdfIcon('map-pin', iconColor, iconSize),
      value: `${locationCount} ${locationCount === 1 ? 'место' : locationCount < 5 ? 'места' : 'мест'}`,
    })
  }

  if (!items.length) return ''

  return `
    <div style="
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      width: 100%;
      max-width: 100%;
      margin-bottom: ${spacing.sectionSpacing};
      align-items: center;
      padding: 10px 14px;
      background: ${colors.surfaceAlt};
      border-radius: ${theme.blocks.borderRadius};
      border-left: 3px solid ${colors.accent};
      box-sizing: border-box;
      overflow: hidden;
    ">
      ${items.map((item) => `
        <span style="
          display: inline-flex;
          align-items: center;
          gap: 5px;
          max-width: 100%;
          min-width: 0;
          white-space: nowrap;
          padding: 5px 10px;
          background: ${colors.surface};
          border: 1px solid ${colors.border};
          border-radius: 999px;
          font-size: ${typography.caption.size};
          line-height: 1.2;
          color: ${colors.textSecondary};
          font-family: ${typography.bodyFont};
          font-weight: 500;
        ">
          ${item.icon}
          <span>${escapeHtml(item.value)}</span>
        </span>
      `).join('')}
    </div>
  `
}

export function buildPdfRunningHeader({
  travelName,
  theme,
  escapeHtml,
}: BuildRunningHeaderParams): string {
  const { colors, typography } = theme

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
        flex-shrink: 0;
      ">
        <span style="
          font-size: 8pt;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          opacity: 0.65;
          font-weight: 600;
        ">MeTravel.by</span>
      </div>
    </div>
  `
}
