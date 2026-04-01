import type { BookSettings } from '@/components/export/BookSettingsModal'
import type { TravelForBook } from '@/types/pdf-export'
import type { NormalizedLocation } from './types'
import { getThemeConfig } from '../../../themes/PdfThemeConfig'

type RuntimeTheme = ReturnType<typeof getThemeConfig>
type RuntimeColors = RuntimeTheme['colors']
type RuntimeTypography = RuntimeTheme['typography']
type RuntimeSpacing = RuntimeTheme['spacing']

type BuildHtmlDocumentParams = {
  pages: string[]
  settings: BookSettings
  theme: RuntimeTheme
  escapeHtml: (value: string | null | undefined) => string
}

type BuildLocationCardsParams = {
  locations: NormalizedLocation[]
  qrCodes?: string[]
  theme: RuntimeTheme
  showCoordinates: boolean
  escapeHtml: (value: string | null | undefined) => string
  getImageFilterStyle: () => string
}

type RuntimeIconName =
  | 'camera'
  | 'pen'
  | 'bulb'
  | 'warning'
  | 'sparkle'
  | 'globe'
  | 'calendar'
  | 'clock'
  | 'map-pin'

type BuildStatsMiniCardParams = {
  travel: TravelForBook
  theme: RuntimeTheme
  colors: RuntimeColors
  typography: RuntimeTypography
  spacing: RuntimeSpacing
  escapeHtml: (value: string | null | undefined) => string
  formatDays: (days?: number | null) => string
  renderPdfIcon: (name: RuntimeIconName, color: string, sizePt: number) => string
}

type BuildRunningHeaderParams = {
  travelName: string
  pageNumber: number
  theme: RuntimeTheme
  escapeHtml: (value: string | null | undefined) => string
}

type BuildSeparatorPageParams = {
  travel: TravelForBook
  travelIndex: number
  totalTravels: number
  theme: RuntimeTheme
  thumbUrl?: string
  formattedDays: string
  escapeHtml: (value: string | null | undefined) => string
  getImageFilterStyle: () => string
}

export function buildPdfHtmlDocument({
  pages,
  settings,
  theme,
  escapeHtml,
}: BuildHtmlDocumentParams): string {
  const { colors, typography } = theme

  const styles = `
      @page {
        size: A4;
        margin: 0;
      }
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        margin: 0;
        font-family: ${typography.bodyFont};
        color: ${colors.text};
        background: ${colors.background};
        line-height: ${typography.body.lineHeight};
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        text-rendering: optimizeLegibility;
        font-feature-settings: "kern" 1;
        font-kerning: normal;
      }
      .pdf-page {
        width: 210mm;
        min-height: 297mm;
        background: ${colors.surface};
        margin: 0 auto 24px;
        box-shadow: 0 2px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04);
        position: relative;
        overflow: hidden;
        border-radius: 2px;
      }
      .pdf-page.travel-content-page {
        overflow: visible;
        height: auto;
      }
      .pdf-page + .pdf-page {
        page-break-before: always;
      }
      img {
        max-width: 100%;
        display: block;
        height: auto;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
      }
      h1, h2, h3, h4 {
        font-family: ${typography.headingFont};
        color: ${colors.text};
        page-break-after: avoid;
        page-break-inside: avoid;
        orphans: 3;
        widows: 3;
        text-rendering: optimizeLegibility;
        font-feature-settings: "kern" 1;
      }
      h1 + p, h2 + p, h3 + p, h4 + p {
        page-break-before: avoid;
      }
      p {
        orphans: 2;
        widows: 2;
        text-rendering: optimizeLegibility;
      }
      img, figure, blockquote, pre, table {
        page-break-inside: avoid;
        break-inside: avoid;
        page-break-after: auto;
      }
      .no-break {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .break-before {
        page-break-before: always;
      }
      .break-after {
        page-break-after: always;
      }
      .travel-content-page .description-block > p:first-of-type::first-letter {
        float: left;
        font-size: 3.2em;
        line-height: 0.85;
        padding-right: 4pt;
        font-weight: 700;
        color: ${colors.accent};
        font-family: ${typography.headingFont};
      }
      .img-row-2 {
        display: flex;
        gap: 8pt;
        margin: 12pt 0;
        page-break-inside: avoid;
      }
      .img-row-2 p {
        flex: 1;
        margin: 0;
      }
      .img-row-2 img {
        width: 100%;
        height: auto;
        max-height: 180pt;
        object-fit: cover;
        border-radius: 6pt;
      }
      .img-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 6pt;
        margin: 12pt 0;
        page-break-inside: avoid;
      }
      .img-grid p {
        flex: 1 1 30%;
        margin: 0;
      }
      .img-grid img {
        width: 100%;
        height: auto;
        max-height: 120pt;
        object-fit: cover;
        border-radius: 4pt;
      }
      .img-single-wide {
        margin: 12pt 0;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .img-single-wide img {
        width: 100%;
        height: auto;
        max-height: 220pt;
        object-fit: contain;
        border-radius: 6pt;
      }
      .img-float-right,
      .img-float-left {
        margin: 8pt 0;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .img-float-right img,
      .img-float-left img {
        max-width: 100%;
        height: auto;
        max-height: 200pt;
        object-fit: contain;
        border-radius: 6pt;
      }
      .cpn-marker-badge {
        display: none !important;
      }
      @media print {
        html, body {
          background: ${colors.background};
        }
        * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        a {
          color: inherit;
          text-decoration: none;
        }
        .pdf-page {
          box-shadow: none;
          margin: 0;
          width: 210mm;
          min-height: 297mm;
          border-radius: 0;
          overflow: visible;
        }
        .pdf-page.cover-page,
        .pdf-page.travel-photo-page,
        .pdf-page.gallery-page,
        .pdf-page.map-page,
        .pdf-page.separator-page,
        .pdf-page.toc-page,
        .pdf-page.final-page,
        .pdf-page.checklist-page {
          height: 297mm;
          max-height: 297mm;
          overflow: hidden;
        }
        .pdf-page.travel-content-page {
          height: auto;
          min-height: auto;
          overflow: visible;
        }
        .travel-content-page > div {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .travel-content-page .description-block {
          break-inside: auto;
          page-break-inside: auto;
        }
        .travel-content-page .description-block > * {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .travel-content-page img {
          max-height: 240mm;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .travel-content-page figure,
        .travel-content-page .img-single-wide,
        .travel-content-page .img-row-2,
        .travel-content-page .img-grid,
        .travel-content-page .img-float-right,
        .travel-content-page .img-float-left {
          break-inside: avoid;
          page-break-inside: avoid;
          max-height: 260mm;
          overflow: hidden;
        }
        .travel-content-page .travel-online-card {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .content-layout { border-collapse: collapse; }
        .content-layout thead { display: table-header-group; }
        .content-layout td { border: none; }
        .cpn-marker-badge {
          display: inline-flex !important;
          position: absolute;
          pointer-events: none;
          z-index: 20;
        }
        img {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
        }
        .cover-page {
          isolation: isolate;
        }
        .cover-page .cover-image-layer {
          z-index: 0 !important;
        }
        .cover-page .cover-smart-overlay {
          z-index: 1 !important;
        }
        .cover-page .cover-content-layer,
        .cover-page .cover-footer-rail {
          position: relative !important;
          z-index: 2 !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        .cover-page .cover-story-panel,
        .cover-page .cover-footer-rail {
          -webkit-backdrop-filter: none !important;
          backdrop-filter: none !important;
        }
      }
    `

  return `
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml((settings.title || '').trim() || 'MeTravel.by')}</title>
  
  <link rel="manifest" href='data:application/manifest+json,{"name":"MeTravel.by Print Preview","short_name":"MeTravel.by","display":"standalone","icons":[]}' />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E" />
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@400;600;700;800&family=Open+Sans:wght@400;500;600;700&family=Lora:wght@400;500;600;700&family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  <style>${styles}</style>
</head>
<body>
  ${pages.join('\n')}
  <script>
  window.__recalcPageNumbers = function() {
    var PAGE_H = 297 * (96 / 25.4);
    var getContentSectionMetrics = function(section) {
      var table = section.querySelector('.content-layout');
      var thead = table ? table.querySelector('thead') : null;
      var repeatHeaderH = thead ? (thead.getBoundingClientRect().height || thead.offsetHeight || 0) : 0;
      var rawHeight = section.scrollHeight || section.offsetHeight || PAGE_H;
      var continuationBodyH = Math.max(1, PAGE_H - repeatHeaderH);
      var extraHeight = Math.max(0, rawHeight - PAGE_H);
      var continuationPages = extraHeight > 0 ? Math.ceil((extraHeight - 2) / continuationBodyH) : 0;

      return {
        rawHeight: rawHeight,
        repeatHeaderH: repeatHeaderH,
        continuationBodyH: continuationBodyH,
        nPages: 1 + continuationPages,
      };
    };
    var sections = document.querySelectorAll('.pdf-page');
    if (!sections.length) return;

    var realPage = [];
    var cur = 1;
    for (var i = 0; i < sections.length; i++) {
      realPage.push(cur);
      var cls = sections[i].className || '';
      if (cls.indexOf('travel-content-page') !== -1) {
        cur += getContentSectionMetrics(sections[i]).nPages;
      } else {
        cur += 1;
      }
    }

    for (var i = 0; i < sections.length; i++) {
      var nums = sections[i].querySelectorAll('[data-page-num]');
      for (var j = 0; j < nums.length; j++) {
        nums[j].textContent = String(realPage[i]);
      }
    }

    var photoSections = [];
    for (var i = 0; i < sections.length; i++) {
      if ((sections[i].className || '').indexOf('travel-photo-page') !== -1) {
        photoSections.push(realPage[i]);
      }
    }
    var tocNums = document.querySelectorAll('[data-toc-page]');
    for (var t = 0; t < Math.min(tocNums.length, photoSections.length); t++) {
      tocNums[t].textContent = String(photoSections[t]);
    }

    try {
      var el = document.getElementById('print-status');
      if (el) el.textContent = (el.textContent || '') + ' \u2022 \u0441\u0442\u0440: ' + (cur - 1);
    } catch (e) {}
  };

  window.__syncContentPageBadges = function(forPrint) {
    var PAGE_H = 297 * (96 / 25.4);
    var getContentSectionMetrics = function(section) {
      var table = section.querySelector('.content-layout');
      var thead = table ? table.querySelector('thead') : null;
      var repeatHeaderH = thead ? (thead.getBoundingClientRect().height || thead.offsetHeight || 0) : 0;
      var rawHeight = section.scrollHeight || section.offsetHeight || PAGE_H;
      var continuationBodyH = Math.max(1, PAGE_H - repeatHeaderH);
      var extraHeight = Math.max(0, rawHeight - PAGE_H);
      var continuationPages = extraHeight > 0 ? Math.ceil((extraHeight - 2) / continuationBodyH) : 0;

      return {
        continuationBodyH: continuationBodyH,
        nPages: 1 + continuationPages,
      };
    };
    var sections = document.querySelectorAll('.pdf-page.travel-content-page');
    if (!sections.length) return;

    for (var i = 0; i < sections.length; i++) {
      var section = sections[i];
      var oldMarkers = section.querySelectorAll('.cpn-marker-badge');
      for (var om = oldMarkers.length - 1; om >= 0; om--) {
        oldMarkers[om].parentNode.removeChild(oldMarkers[om]);
      }

      var existingBadge = section.querySelector('[data-page-num]');
      if (!existingBadge) continue;
      existingBadge.style.visibility = forPrint ? 'hidden' : '';
      if (!forPrint) continue;

      var sectionPage = Number(existingBadge.textContent || 0) || 0;
      var metrics = getContentSectionMetrics(section);
      var badgeRect = existingBadge.getBoundingClientRect();
      var sectionRect = section.getBoundingClientRect();
      var badgeTopInSection = badgeRect.top - sectionRect.top;
      var badgeLeft = badgeRect.left - sectionRect.left;
      var badgeWidth = badgeRect.width || existingBadge.offsetWidth || 22;
      var badgeHeight = badgeRect.height || existingBadge.offsetHeight || 22;
      var badgeStyles = window.getComputedStyle(existingBadge);

      for (var p = 0; p < metrics.nPages; p++) {
        var marker = document.createElement('div');
        marker.className = 'cpn-marker-badge';
        marker.style.top = Math.round(p * PAGE_H + badgeTopInSection) + 'px';
        marker.style.left = Math.round(badgeLeft) + 'px';
        marker.style.width = Math.round(badgeWidth) + 'px';
        marker.style.height = Math.round(badgeHeight) + 'px';
        marker.style.display = 'inline-flex';
        marker.style.alignItems = 'center';
        marker.style.justifyContent = 'center';
        marker.style.borderRadius = badgeStyles.borderRadius || '6px';
        marker.style.background = badgeStyles.backgroundColor || '#f0f0f0';
        marker.style.color = badgeStyles.color || '#333';
        marker.style.fontSize = badgeStyles.fontSize || '8pt';
        marker.style.fontWeight = badgeStyles.fontWeight || '700';
        marker.style.fontFamily = badgeStyles.fontFamily || 'sans-serif';
        marker.style.lineHeight = '1';
        marker.textContent = String(sectionPage + p);
        section.appendChild(marker);
      }
    }
  };

  window.addEventListener('load', function() {
    setTimeout(function() {
      window.__recalcPageNumbers();
      window.__syncContentPageBadges(false);
    }, 300);
  });
  window.addEventListener('beforeprint', function() {
    window.__recalcPageNumbers();
    window.__syncContentPageBadges(true);
  });
  window.addEventListener('afterprint', function() {
    window.__syncContentPageBadges(false);
  });
  </script>
</body>
</html>
    `
}

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
  pageNumber,
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
