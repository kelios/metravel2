import type { BuildHtmlDocumentParams } from './types'

// Узкая нижняя полоса печатной страницы под нативный номер (@page @bottom-center).
// Печатная высота фиксированных страниц уменьшается на эту величину, чтобы каждая
// .pdf-page по-прежнему занимала ровно один физический лист A4.
const PAGE_FOOTER_BAND = '12mm'
const PRINT_PAGE_HEIGHT = 'calc(297mm - 12mm)'

export function buildPdfHtmlDocument({
  pages,
  settings,
  theme,
  isPremium = true,
  escapeHtml,
}: BuildHtmlDocumentParams): string {
  const { colors, typography } = theme

  // Водяной знак для free-тиров (#297). Деликатная полоска в правом нижнем углу,
  // не перекрывает кадр значимо; на каждой печатной странице (position: fixed).
  const watermarkLabel = escapeHtml('Создано на metravel.by')
  const watermarkHtml = isPremium
    ? ''
    : `\n  <div class="metravel-watermark" aria-hidden="true">${watermarkLabel}</div>`
  const watermarkStyles = isPremium
    ? ''
    : `
      .metravel-watermark {
        position: fixed;
        right: 6mm;
        bottom: 4mm;
        z-index: 30;
        padding: 1.5mm 3mm;
        font-family: ${typography.bodyFont};
        font-size: 7pt;
        letter-spacing: 0.3pt;
        color: ${colors.textMuted};
        background: rgba(255, 255, 255, 0.62);
        border-radius: 3pt;
        pointer-events: none;
        opacity: 0.85;
      }
      @media print {
        .metravel-watermark {
          position: fixed;
          right: 6mm;
          bottom: 4mm;
        }
      }`

  const styles = `
      @page {
        size: A4;
        margin: 0 0 ${PAGE_FOOTER_BAND} 0;
        @bottom-center {
          content: counter(page);
          font-family: ${typography.bodyFont};
          font-size: 8pt;
          font-weight: 600;
          letter-spacing: 0.06em;
          color: ${colors.textMuted};
        }
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
          min-height: ${PRINT_PAGE_HEIGHT};
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
          height: ${PRINT_PAGE_HEIGHT};
          max-height: ${PRINT_PAGE_HEIGHT};
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
      ${watermarkStyles}
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
  <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&family=Comfortaa:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Inter:wght@400;500;600;700;800&family=Jost:wght@400;500;600;700&family=Libre+Franklin:wght@400;600;700;800&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Manrope:wght@400;500;600;700;800&family=Merriweather:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;600;700;800&family=Nunito:wght@400;500;600;700;800&family=Open+Sans:wght@400;500;600;700&family=Oswald:wght@400;500;600;700&family=PT+Serif:ital,wght@0,400;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400&family=Roboto:wght@400;500;700&family=Source+Sans+3:wght@400;500;600;700&family=Source+Serif+4:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
  
  <style>${styles}</style>
</head>
<body>
  ${pages.join('\n')}${watermarkHtml}
</body>
</html>
    `
}
