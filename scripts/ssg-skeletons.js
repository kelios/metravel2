#!/usr/bin/env node
/**
 * SSG Skeleton Shells for P3.5 — pre-rendered HTML visible before JS loads.
 *
 * Generates lightweight HTML skeletons for `/` (home) and `/search` pages,
 * injected by generate-seo-pages.js into the static HTML output.
 *
 * Colors from MODERN_MATTE_PALETTE / MODERN_MATTE_PALETTE_DARK (hardcoded
 * to avoid importing TS modules at build time).
 */

// Hardcoded color tokens from modernMattePalette.ts
const COLORS = {
  light: {
    bg: '#fdfcfb',
    bgSecondary: '#f9f8f6',
    surface: '#ffffff',
    text: '#3a3a3a',
    textMuted: '#636363',
    border: '#e8e6e1',
    shimmerFrom: '#f5f4f2',
    shimmerTo: '#e8e6e1',
  },
  dark: {
    bg: '#1a1a1a',
    bgSecondary: '#202020',
    surface: '#2a2a2a',
    text: '#e8e8e8',
    textMuted: '#b8b8b8',
    border: '#3a3a3a',
    shimmerFrom: '#282828',
    shimmerTo: '#3a3a3a',
  },
};

/**
 * Build skeleton CSS (shared by home and search).
 * Uses data-theme="dark" on <html> for theme switching (set by +html.tsx inline script).
 */
function buildSkeletonCSS() {
  return `<style id="ssg-skeleton-css">
#ssg-skeleton{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;position:relative;z-index:1}
#ssg-skeleton *{box-sizing:border-box}
.ssg-bar{width:100%;height:56px;background:${COLORS.light.surface};border-bottom:1px solid ${COLORS.light.border};display:flex;align-items:center;padding:0 16px}
.ssg-bar-logo{width:120px;height:28px;border-radius:6px;background:${COLORS.light.shimmerFrom}}
.ssg-hero{max-width:1200px;margin:0 auto;padding:24px 16px;display:flex;flex-direction:column;gap:16px}
.ssg-hero-title{width:60%;height:32px;border-radius:8px}
.ssg-hero-sub{width:40%;height:20px;border-radius:6px}
.ssg-hero-search{width:100%;height:48px;border-radius:12px;background:${COLORS.light.surface};border:1px solid ${COLORS.light.border}}
.ssg-cards{max-width:1200px;margin:0 auto;padding:0 16px 32px;display:grid;grid-template-columns:1fr;gap:16px}
@media(min-width:640px){.ssg-cards{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1024px){.ssg-cards{grid-template-columns:repeat(3,1fr)}}
.ssg-card{border-radius:12px;overflow:hidden;background:${COLORS.light.surface};border:1px solid ${COLORS.light.border}}
.ssg-card-img{width:100%;height:180px}
.ssg-card-body{padding:12px;display:flex;flex-direction:column;gap:8px}
.ssg-card-line{height:14px;border-radius:4px}
.ssg-card-line.w70{width:70%}.ssg-card-line.w50{width:50%}.ssg-card-line.w30{width:30%}
.ssg-sidebar{display:none;width:240px;min-height:400px;background:${COLORS.light.surface};border-right:1px solid ${COLORS.light.border};padding:16px;flex-shrink:0}
@media(min-width:1024px){.ssg-sidebar{display:block}}
.ssg-sidebar-line{height:14px;border-radius:4px;margin-bottom:12px}
.ssg-search-layout{max-width:1200px;margin:0 auto;display:flex}
.ssg-search-main{flex:1;padding:16px}
.ssg-search-bar{height:48px;border-radius:12px;background:${COLORS.light.surface};border:1px solid ${COLORS.light.border};margin-bottom:16px}
.ssg-pulse{animation:ssg-shimmer 1.5s ease-in-out infinite}
@keyframes ssg-shimmer{0%,100%{background:${COLORS.light.shimmerFrom}}50%{background:${COLORS.light.shimmerTo}}}
html[data-theme="dark"] .ssg-bar{background:${COLORS.dark.surface};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-bar-logo{background:${COLORS.dark.shimmerFrom}}
html[data-theme="dark"] .ssg-hero-search{background:${COLORS.dark.surface};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-card{background:${COLORS.dark.surface};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-sidebar{background:${COLORS.dark.surface};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-search-bar{background:${COLORS.dark.surface};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-pulse{animation-name:ssg-shimmer-dark}
@keyframes ssg-shimmer-dark{0%,100%{background:${COLORS.dark.shimmerFrom}}50%{background:${COLORS.dark.shimmerTo}}}
#ssg-skeleton{transition:opacity .2s ease-out}
#ssg-skeleton.ssg-hiding{opacity:0;pointer-events:none}
</style>`;
}

/**
 * Skeleton auto-removal script: watches #root, removes skeleton when React mounts.
 */
function buildRemovalScript() {
  return `<script>(function(){try{var s=document.getElementById('ssg-skeleton');if(!s)return;var r=document.getElementById('root');if(!r){s.remove();return}if(r.childNodes.length>0){s.classList.add('ssg-hiding');setTimeout(function(){s.remove();var c=document.getElementById('ssg-skeleton-css');if(c)c.remove()},300);return}var o=new MutationObserver(function(){if(r.childNodes.length>0){o.disconnect();s.classList.add('ssg-hiding');setTimeout(function(){s.remove();var c=document.getElementById('ssg-skeleton-css');if(c)c.remove()},300)}});o.observe(r,{childList:true});setTimeout(function(){try{o.disconnect();if(s.parentNode)s.remove();var c=document.getElementById('ssg-skeleton');if(c&&c.parentNode)c.remove()}catch(e){}},10000)}catch(e){}})();</script>`;
}

function buildCards(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `<div class="ssg-card"><div class="ssg-card-img ssg-pulse"></div><div class="ssg-card-body"><div class="ssg-card-line w70 ssg-pulse"></div><div class="ssg-card-line w50 ssg-pulse"></div><div class="ssg-card-line w30 ssg-pulse"></div></div></div>`;
  }
  return html;
}

function buildSidebarLines(count) {
  let html = '';
  const widths = ['80%', '60%', '90%', '70%', '50%', '85%', '65%', '75%'];
  for (let i = 0; i < count; i++) {
    html += `<div class="ssg-sidebar-line ssg-pulse" style="width:${widths[i % widths.length]}"></div>`;
  }
  return html;
}

/**
 * Build home page skeleton HTML.
 */
function buildHomeSkeletonHtml() {
  return `<div id="ssg-skeleton">
<div class="ssg-bar"><div class="ssg-bar-logo ssg-pulse"></div></div>
<div class="ssg-hero">
<div class="ssg-hero-title ssg-pulse"></div>
<div class="ssg-hero-sub ssg-pulse"></div>
<div class="ssg-hero-search"></div>
</div>
<div class="ssg-cards">${buildCards(6)}</div>
${buildRemovalScript()}
</div>`;
}

/**
 * Build search page skeleton HTML.
 */
function buildSearchSkeletonHtml() {
  return `<div id="ssg-skeleton">
<div class="ssg-bar"><div class="ssg-bar-logo ssg-pulse"></div></div>
<div class="ssg-search-layout">
<div class="ssg-sidebar">${buildSidebarLines(8)}</div>
<div class="ssg-search-main">
<div class="ssg-search-bar ssg-pulse"></div>
<div class="ssg-cards">${buildCards(6)}</div>
</div>
</div>
${buildRemovalScript()}
</div>`;
}

/**
 * Inject a skeleton shell into an HTML string for a given route.
 * Only `/` and `/search` get skeletons; all other routes pass through unchanged.
 *
 * @param {string} html - Base HTML string
 * @param {string} route - Route path (e.g. '/', '/search')
 * @returns {string} HTML with skeleton injected (or unchanged)
 */
function injectSkeletonShell(html, route) {
  let skeleton = '';
  if (route === '/') {
    skeleton = buildHomeSkeletonHtml();
  } else if (route === '/search') {
    skeleton = buildSearchSkeletonHtml();
  }

  if (!skeleton) return html;

  // Inject CSS into <head>
  const css = buildSkeletonCSS();
  let result = html.replace('</head>', `${css}\n</head>`);

  // Inject skeleton HTML after <body...>
  result = result.replace(/(<body[^>]*>)/i, `$1\n${skeleton}`);

  return result;
}

module.exports = {
  buildSkeletonCSS,
  buildHomeSkeletonHtml,
  buildSearchSkeletonHtml,
  injectSkeletonShell,
  buildRemovalScript,
  COLORS,
};

