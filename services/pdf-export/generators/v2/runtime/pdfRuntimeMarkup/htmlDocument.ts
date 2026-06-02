import type { BuildHtmlDocumentParams } from './types'

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
