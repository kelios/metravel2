import type { BuildSeparatorPageParams } from './types'

export function buildPdfSeparatorPage({
  travel,
  travelIndex,
  totalTravels,
  theme,
  thumbUrl,
  formattedDays,
  escapeHtml,
  getImageFilterStyle,
}: BuildSeparatorPageParams): string {
  const { colors, typography } = theme
  const country = travel.countryName || ''
  const year = travel.year ? String(travel.year) : ''
  const metaParts = [country, year, formattedDays].filter(Boolean)
  const titleLength = travel.name.trim().length
  const separatorTitleFontSize =
    titleLength > 140 ? '24pt' : titleLength > 100 ? '28pt' : typography.h1.size
  const separatorTitleLineHeight =
    titleLength > 140 ? '1.08' : titleLength > 100 ? '1.12' : typography.h1.lineHeight

  return `
    <section class="pdf-page separator-page" style="
      padding: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 285mm;
      text-align: center;
      background: ${colors.surface};
      position: relative;
      overflow: hidden;
    ">
      <div style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, ${colors.accentSoft}, ${colors.accent}, ${colors.accentSoft});
      "></div>

      ${thumbUrl ? `
        <div style="
          width: 88px;
          height: 88px;
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 6mm;
          box-shadow: 0 6px 24px rgba(0,0,0,0.14);
          border: 4px solid ${colors.surface};
          outline: 2px solid ${colors.accentSoft};
          background: ${colors.surfaceAlt};
        ">
          <img src="${escapeHtml(thumbUrl)}" alt=""
            style="width: 100%; height: 100%; object-fit: cover; display: block; ${getImageFilterStyle()}"
            onerror="this.style.display='none';this.parentElement.style.background='${colors.accentSoft}';" />
        </div>
      ` : ''}

      <div style="
        width: 44px;
        height: 44px;
        border-radius: 999px;
        background: ${colors.accentSoft};
        color: ${colors.accent};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18pt;
        font-weight: 800;
        font-family: ${typography.headingFont};
        margin-bottom: 4mm;
      ">${travelIndex}</div>

      <div style="
        width: 20mm;
        height: 2px;
        background: linear-gradient(90deg, transparent, ${colors.accent}, transparent);
        border-radius: 999px;
        margin-bottom: 6mm;
        opacity: 0.4;
      "></div>

      <h2 style="
        font-size: ${separatorTitleFontSize};
        font-weight: ${typography.h1.weight};
        color: ${colors.text};
        margin-bottom: 5mm;
        max-width: 176mm;
        font-family: ${typography.headingFont};
        line-height: ${separatorTitleLineHeight};
        overflow-wrap: break-word;
        word-break: normal;
        hyphens: auto;
        text-wrap: balance;
      ">${escapeHtml(travel.name)}</h2>

      ${metaParts.length ? `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6mm;
          flex-wrap: wrap;
        ">
          ${metaParts.map((part) => `
            <span style="
              font-size: 10pt;
              color: ${colors.textMuted};
              font-family: ${typography.bodyFont};
              padding: 3px 10px;
              background: ${colors.surfaceAlt};
              border-radius: 999px;
              border: 1px solid ${colors.border};
            ">${escapeHtml(part)}</span>
          `).join('')}
        </div>
      ` : ''}

      <div style="
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, ${colors.accentSoft}, ${colors.accent}, ${colors.accentSoft});
      "></div>

      <div style="
        position: absolute;
        bottom: 22mm;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: ${typography.caption.size};
        color: ${colors.textMuted};
        font-family: ${typography.bodyFont};
        opacity: 0.6;
      ">
        <span style="font-weight: 600;">${travelIndex}</span>
        <span style="color: ${colors.border};">/</span>
        <span>${totalTravels}</span>
      </div>
    </section>
  `
}
