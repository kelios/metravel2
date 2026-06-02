import type { BuildLocationCardsParams } from './types'

export function buildPdfLocationCards({
  locations,
  qrCodes = [],
  theme,
  showCoordinates,
  escapeHtml,
  getImageFilterStyle,
}: BuildLocationCardsParams): string[] {
  const { colors, typography } = theme

  return locations.map((location, index) => {
    const rawAddress = location.address || ''
    const addressParts = rawAddress
      .split(/\s*[·,]\s*/)
      .map((segment) => segment.trim())
      .filter(Boolean)
    const title = addressParts[0] || rawAddress
    const subtitle =
      addressParts.length > 2
        ? addressParts.slice(1, 3).join(', ')
        : addressParts.length > 1
          ? addressParts[1]
          : ''
    const qrCode = qrCodes[index]
    const hasThumbnail = Boolean(location.thumbnailUrl)

    return `
        <div class="map-location-card" style="
          display: flex;
          gap: 0;
          align-items: stretch;
          border: 1px solid ${colors.border};
          background: ${colors.surface};
          border-radius: 14px;
          margin-bottom: 5px;
          break-inside: avoid;
          page-break-inside: avoid;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          overflow: hidden;
          min-height: ${hasThumbnail ? '72px' : 'auto'};
        ">
          ${hasThumbnail ? `
            <div style="
              width: 80px;
              flex-shrink: 0;
              background: ${colors.surfaceAlt};
              position: relative;
            ">
              <img src="${escapeHtml(location.thumbnailUrl!)}" alt="Точка ${index + 1}"
                style="width: 100%; height: 100%; object-fit: cover; display: block; ${getImageFilterStyle()}" />
              <div style="
                position: absolute;
                top: 5px;
                left: 5px;
                min-width: 20px;
                height: 20px;
                border-radius: 999px;
                background: ${colors.accent};
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
                font-size: 8pt;
                font-family: ${typography.headingFont};
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              ">${index + 1}</div>
            </div>
          ` : ''}
          <div style="flex: 1; min-width: 0; padding: 7px 10px; display: flex; flex-direction: column; justify-content: center;">
            <div style="
              display: flex;
              align-items: center;
              gap: 6px;
            ">
              ${!hasThumbnail ? `
                <div style="
                  min-width: 20px;
                  height: 20px;
                  border-radius: 999px;
                  background: ${colors.accentSoft};
                  color: ${colors.accentStrong};
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-weight: 700;
                  font-size: 8pt;
                  flex-shrink: 0;
                  font-family: ${typography.headingFont};
                ">${index + 1}</div>
              ` : ''}
              <div style="min-width: 0; flex: 1;">
                <div style="
                  font-weight: 700;
                  color: ${colors.text};
                  font-size: 9pt;
                  line-height: 1.25;
                  font-family: ${typography.bodyFont};
                  overflow: hidden;
                  text-overflow: ellipsis;
                  display: -webkit-box;
                  -webkit-line-clamp: 2;
                  -webkit-box-orient: vertical;
                ">${escapeHtml(title)}</div>
                ${subtitle ? `
                  <div style="
                    font-size: 7.5pt;
                    color: ${colors.textMuted};
                    margin-top: 1px;
                    line-height: 1.2;
                    font-family: ${typography.bodyFont};
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  ">${escapeHtml(subtitle)}</div>
                ` : ''}
              </div>
            </div>
            <div style="
              display: flex;
              flex-wrap: wrap;
              align-items: center;
              gap: 3px 5px;
              margin-top: 4px;
            ">
              ${location.categoryName ? `
                <span style="
                  display: inline-flex;
                  align-items: center;
                  padding: 1px 6px;
                  border-radius: 999px;
                  background: ${colors.accentLight};
                  color: ${colors.textSecondary};
                  font-size: 7pt;
                  line-height: 1.3;
                  font-family: ${typography.bodyFont};
                  font-weight: 600;
                ">${escapeHtml(location.categoryName)}</span>
              ` : ''}
              ${location.coord && showCoordinates ? `
                <span style="
                  font-size: 6.5pt;
                  color: ${colors.textMuted};
                  opacity: 0.7;
                  font-family: ${typography.monoFont};
                ">${escapeHtml(location.coord)}</span>
              ` : ''}
            </div>
          </div>
          ${qrCode ? `
            <div style="
              width: 46px;
              padding: 6px;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              border-left: 1px solid ${colors.border};
              background: ${colors.surfaceAlt};
            ">
              <img src="${escapeHtml(qrCode)}" alt="QR точки ${index + 1}"
                style="width: 34px; height: 34px; display: block;" />
            </div>
          ` : ''}
        </div>
      `
  })
}
