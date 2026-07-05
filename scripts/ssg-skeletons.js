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
#ssg-skeleton{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;position:fixed;inset:0;z-index:99999;overflow:hidden;background:${COLORS.light.bg};color:${COLORS.light.text}}
#ssg-skeleton *{box-sizing:border-box}
.ssg-bar{width:100%;height:56px;background:${COLORS.light.surface};border-bottom:1px solid ${COLORS.light.border};display:flex;align-items:center;padding:0 16px}
.ssg-bar-logo{font:700 20px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.text};letter-spacing:-0.01em}
.ssg-hero{max-width:1200px;margin:0 auto;padding:24px 16px 8px;display:flex;flex-direction:column;align-items:flex-start;gap:12px}
.ssg-hero-title{margin:0;font:700 32px/40px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;letter-spacing:-0.8px;color:${COLORS.light.text};max-width:640px;text-align:left}
.ssg-hero-title .ssg-accent{color:#f5842c;font-weight:800}
@media(min-width:768px){.ssg-hero-title{font-size:36px;line-height:44px}}
.ssg-hero-sub{margin:0;font:400 16px/24px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLORS.light.textMuted};max-width:520px;text-align:left}
@media(min-width:768px){.ssg-hero-sub{font-size:17px;line-height:27px}}
.ssg-hero-search{width:100%;max-width:640px;height:48px;border-radius:12px;background:${COLORS.light.surface};border:1px solid ${COLORS.light.border};margin-top:4px}
.ssg-search-intro{max-width:1200px;margin:0 auto;padding:20px 16px 8px}
.ssg-search-h1{margin:0 0 12px;font:700 28px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.text};letter-spacing:-0.02em;max-width:720px}
@media(min-width:768px){.ssg-search-h1{font-size:36px}}
.ssg-search-lead{margin:0;font:400 16px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.textMuted};max-width:720px}
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
.ssg-sidebar-group{margin-bottom:18px}
.ssg-sidebar-title{margin:0 0 10px;font:600 12px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.text};text-transform:uppercase;letter-spacing:0.08em}
.ssg-sidebar-line{height:14px;border-radius:4px;margin-bottom:10px}
.ssg-search-layout{max-width:1200px;margin:0 auto;display:flex}
.ssg-search-main{flex:1;padding:16px}
.ssg-search-bar{height:48px;border-radius:12px;background:${COLORS.light.surface};border:1px solid ${COLORS.light.border};margin-bottom:16px;display:flex;align-items:center;padding:0 16px;font:400 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.textMuted}}
.ssg-travel-spacer{height:88px}
.ssg-travel-wrap{max-width:1200px;margin:0 auto;padding:0 6px}
.ssg-travel-hero{position:relative;width:100%;height:70vh;min-height:360px;max-height:750px;border-radius:12px;overflow:hidden;background:${COLORS.light.bgSecondary};margin:8px 0 16px}
@media(max-width:767px){.ssg-travel-hero{height:min(56vh,520px);min-height:260px;max-height:520px;border-radius:0;margin:0 -6px 16px;width:calc(100% + 12px)}}
.ssg-travel-hero-blur{position:absolute;inset:0;background-position:center;background-repeat:no-repeat;background-size:cover;filter:blur(18px) saturate(1.08) brightness(0.82);transform:scale(1.08);transform-origin:center;pointer-events:none;z-index:0}
.ssg-blur-mobile{display:block}.ssg-blur-desktop{display:none}
@media(min-width:768px){.ssg-blur-mobile{display:none}.ssg-blur-desktop{display:block}}
.ssg-travel-hero-img{position:relative;width:100%;height:100%;object-fit:contain;object-position:center;display:block;z-index:1}
.ssg-travel-hero-bg{position:absolute;inset:0;background:rgba(7,12,19,0.24);pointer-events:none;z-index:1}
.ssg-travel-title{height:32px;width:70%;border-radius:8px;margin:0 0 12px}
.ssg-travel-meta{height:16px;width:40%;border-radius:6px;margin:0 0 24px}
.ssg-travel-line{height:14px;border-radius:4px;margin-bottom:10px}
.ssg-travel-line.w90{width:90%}.ssg-travel-line.w75{width:75%}.ssg-travel-line.w60{width:60%}
.ssg-travel-h1{margin:0 0 14px;font:700 28px/1.25 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.text};letter-spacing:-0.02em;max-width:760px}
@media(min-width:768px){.ssg-travel-h1{font-size:34px}}
.ssg-travel-article{max-width:760px;font:400 16px/1.65 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.text}}
.ssg-travel-article p{margin:0 0 16px}
.ssg-travel-article h2{margin:28px 0 12px;font:700 22px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:-0.01em;color:${COLORS.light.text}}
.ssg-travel-article h3{margin:22px 0 10px;font:700 18px/1.35 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.text}}
.ssg-travel-article ul,.ssg-travel-article ol{margin:0 0 16px;padding-left:22px}
.ssg-travel-article li{margin:0 0 6px}
.ssg-travel-article a{color:#1f6feb;text-decoration:underline}
.ssg-travel-article blockquote{margin:0 0 16px;padding-left:14px;border-left:3px solid ${COLORS.light.border};color:${COLORS.light.textMuted}}
.ssg-travel-related{max-width:760px;margin:32px 0 8px;padding-top:20px;border-top:1px solid ${COLORS.light.border}}
.ssg-travel-related h2{margin:0 0 12px;font:700 20px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.light.text}}
.ssg-travel-related ul{margin:0;padding-left:20px;font:400 16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.ssg-travel-related li{margin:0 0 8px}
.ssg-travel-related a{color:#1f6feb;text-decoration:underline}
.ssg-pulse{animation:ssg-shimmer 1.5s ease-in-out infinite}
@keyframes ssg-shimmer{0%,100%{background:${COLORS.light.shimmerFrom}}50%{background:${COLORS.light.shimmerTo}}}
html[data-theme="dark"] #ssg-skeleton{background:${COLORS.dark.bg};color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-bar{background:${COLORS.dark.surface};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-bar-logo{color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-search-h1{color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-search-lead{color:${COLORS.dark.textMuted}}
html[data-theme="dark"] .ssg-sidebar-title{color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-hero-title{color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-hero-title .ssg-accent{color:#f0a060}
html[data-theme="dark"] .ssg-hero-sub{color:${COLORS.dark.textMuted}}
html[data-theme="dark"] .ssg-hero-search{background:${COLORS.dark.surface};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-card{background:${COLORS.dark.surface};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-sidebar{background:${COLORS.dark.surface};border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-search-bar{background:${COLORS.dark.surface};border-color:${COLORS.dark.border};color:${COLORS.dark.textMuted}}
html[data-theme="dark"] .ssg-travel-hero{background:${COLORS.dark.bgSecondary}}
html[data-theme="dark"] .ssg-travel-h1{color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-travel-article{color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-travel-article h2,html[data-theme="dark"] .ssg-travel-article h3{color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-travel-article a{color:#5aa7ff}
html[data-theme="dark"] .ssg-travel-article blockquote{border-color:${COLORS.dark.border};color:${COLORS.dark.textMuted}}
html[data-theme="dark"] .ssg-travel-related{border-color:${COLORS.dark.border}}
html[data-theme="dark"] .ssg-travel-related h2{color:${COLORS.dark.text}}
html[data-theme="dark"] .ssg-travel-related a{color:#5aa7ff}
html[data-theme="dark"] .ssg-pulse{animation-name:ssg-shimmer-dark}
@keyframes ssg-shimmer-dark{0%,100%{background:${COLORS.dark.shimmerFrom}}50%{background:${COLORS.dark.shimmerTo}}}
#ssg-skeleton{transition:opacity .2s ease-out}
#ssg-skeleton.ssg-hiding{opacity:0;pointer-events:none}
</style>`;
}

/**
 * Skeleton auto-removal script.
 *
 * The SSG hero <img> (inside #ssg-skeleton, a sibling BEFORE #root) is the LCP
 * element — it paints ~FCP. React's own hero <img data-lcp> renders later
 * INSIDE #root. If the skeleton is torn down as soon as #root gets any child
 * (React's loading shell), the SSG hero disappears and React's hero becomes a
 * new, late LCP candidate that only paints after full hydration (>15s on
 * throttled mobile) — wrecking LCP.
 *
 * Fix (travel pages): keep the SSG hero on screen until React's own hero image
 * (#root img[data-lcp]) is actually loaded. The large full-bleed SSG hero
 * stays the largest contentful paint the whole time, so Chrome keeps the
 * early (~FCP) paint as the final LCP instead of resetting it to hydration
 * time.
 *
 * Home/search skeletons have NO img[data-lcp] (their LCP is the hero TEXT block
 * that paints at ~FCP and is already locked by then). For those, waiting on a
 * non-existent hero image meant the skeleton lingered until the 20s safety net,
 * covering the already-hydrated, interactive app for up to 20s. So for non-travel
 * skeletons we tear down as soon as the app reports hydration+paint (the
 * `app-hydrated` class set by RootWebDeferredChrome after a rAF) — the early text
 * LCP is already captured, so this only removes a stale overlay.
 *
 * 20s safety net: by then LCP is long settled, so the only question is whether
 * React actually mounted. The old check (`#root has childNodes`) could not tell:
 * the static export ALWAYS prerenders a shell inside #root, so the skeleton —
 * the only visible content on travel pages — was force-removed even when the JS
 * bundle never loaded (stale deploy, flaky network), leaving a white screen.
 * Now after 20s we tear down only on real mount signals: the `app-hydrated`
 * class (allowed for travel skeletons too at this point) or an img[data-lcp]
 * EXISTING in #root (React rendered the travel page; no need to wait for the
 * image bytes anymore). If React never mounts, the skeleton stays — readable
 * content instead of a blank page (the global chunk-reload handler does its own
 * one-shot recovery in parallel). A 45s deep fallback covers "mounted but both
 * signals missed": if #root accumulated real text (>200 chars; the dead static
 * shell is ~60), the app is clearly rendering and the skeleton is torn down.
 *
 * Parse-order guard: this <script> lives INSIDE #ssg-skeleton, which is injected
 * right after <body> — i.e. BEFORE <div id="root">. So at first execution #root
 * is not parsed yet and getElementById('root') is null. We must NOT treat that as
 * "orphan skeleton, remove it" (that bug made the skeleton self-destruct in ~30ms,
 * before it could ever be the FCP/LCP paint). Instead, if #root is missing while
 * the document is still loading, defer until DOMContentLoaded and re-check; only
 * remove as an orphan if #root is still absent after the DOM is fully parsed.
 */
function buildRemovalScript() {
  return `<script>(function(){try{var s=document.getElementById('ssg-skeleton');if(!s)return;function begin(){if(s.__b)return;var r=document.getElementById('root');if(!r){if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',begin,{once:true});return}s.remove();return}s.__b=1;var travelSkel=!!s.querySelector('.ssg-travel-hero');var done=false;var late=false;function killCss(){var c=document.getElementById('ssg-skeleton-css');if(c&&c.parentNode)c.parentNode.removeChild(c)}function teardown(){if(done)return;done=true;try{s.classList.add('ssg-hiding')}catch(e){}setTimeout(function(){try{if(s.parentNode)s.parentNode.removeChild(s)}catch(e){}killCss()},300)}function heroReady(){var i=r.querySelector('img[data-lcp]');return !!(i&&i.complete&&i.naturalWidth>0)}function appReady(){return (!travelSkel||late)&&document.documentElement.classList.contains('app-hydrated')}function lateHero(){return late&&!!r.querySelector('img[data-lcp]')}function check(){if(done)return false;if(heroReady()||appReady()||lateHero()){teardown();return true}return false}if(check())return;var o=new MutationObserver(function(){if(check()){o.disconnect()}});o.observe(r,{childList:true,subtree:true});var iv=setInterval(function(){if(done){clearInterval(iv);return}if(check()){clearInterval(iv);try{o.disconnect()}catch(e){}}},120);setTimeout(function(){late=true;check()},20000);setTimeout(function(){if(done)return;var t=(r.textContent||'').replace(/\\s+/g,' ').trim();if(t.length>200){teardown()}},45000)}begin()}catch(e){}})();</script>`;
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
  // Real hero text (not empty pulse bars) so Chrome's FCP fires on render and
  // the LCP candidate is locked to this large title block BEFORE hydration.
  // Without it the home LCP only fires after full hydration (>8s on throttled
  // mobile). NOT an <h1>: the single semantic <h1> is the out-of-flow one in
  // #root (index.tsx), so the raw HTML keeps exactly one H1. Mirrors the
  // /search and /travels skeleton approach.
  return `<div id="ssg-skeleton">
<div class="ssg-bar"><div class="ssg-bar-logo">MeTravel</div></div>
<div class="ssg-hero">
<div class="ssg-hero-title">Куда поехать <span class="ssg-accent">в эти выходные?</span></div>
<p class="ssg-hero-sub">Реальные маршруты по Беларуси и Европе — с фото и GPS-треками.</p>
<div class="ssg-hero-search"></div>
</div>
<div class="ssg-cards">${buildCards(6)}</div>
${buildRemovalScript()}
</div>`;
}

/**
 * Build search page skeleton HTML.
 *
 * Contains visible text (H1 + lead + sidebar titles + search placeholder) so
 * that Chrome's First Contentful Paint fires on skeleton render (~FCP), and
 * so the Largest Contentful Paint candidate is locked to the hero text block
 * before React hydration. Without visible text, Chrome's FCP/LCP only fire
 * after hydration renders real content (>6s on mobile).
 */
function buildSearchSkeletonHtml() {
  const leadText =
    'Ищите маршруты по странам, категориям и уровню сложности. ' +
    'Подбирайте идеи для поездок на выходные, сохраняйте путешествия ' +
    'с фото и заметками и собирайте личную книгу путешествий в PDF. ' +
    'Тысячи готовых маршрутов по Беларуси, Европе и миру — от однодневных ' +
    'прогулок рядом с домом до многодневных трипов с семьёй, друзьями ' +
    'или в одиночку. Фильтруйте поездки по сезону, бюджету, типу транспорта ' +
    'и уровню физической нагрузки: пешие маршруты, велопоходы, автопутешествия, ' +
    'поездки на общественном транспорте, водные и горные маршруты. ' +
    'Смотрите фотографии от путешественников, карты с точками интереса, ' +
    'трек-файлы GPX и подробные заметки — всё, что нужно, чтобы собраться и поехать.';
  return `<div id="ssg-skeleton">
<div class="ssg-bar"><div class="ssg-bar-logo">MeTravel</div></div>
<div class="ssg-search-intro">
<h1 class="ssg-search-h1">Поиск путешествий и маршрутов</h1>
<p class="ssg-search-lead">${leadText}</p>
</div>
<div class="ssg-search-layout">
<div class="ssg-sidebar">
<div class="ssg-sidebar-group"><div class="ssg-sidebar-title">Страны</div>${buildSidebarLines(3)}</div>
<div class="ssg-sidebar-group"><div class="ssg-sidebar-title">Категории</div>${buildSidebarLines(3)}</div>
<div class="ssg-sidebar-group"><div class="ssg-sidebar-title">Сложность</div>${buildSidebarLines(2)}</div>
</div>
<div class="ssg-search-main">
<div class="ssg-search-bar">Найти маршрут…</div>
<div class="ssg-cards">${buildCards(6)}</div>
</div>
</div>
${buildRemovalScript()}
</div>`;
}

function escapeHtmlAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Tags kept (with their text) when sanitizing the article body for crawlers.
const SSG_ALLOWED_TAGS = new Set([
  'p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'br', 'blockquote', 'a',
]);

/** Truncate sanitized HTML at a block boundary so no tag is cut mid-way. */
function clampHtmlAtBlock(html, max) {
  if (html.length <= max) return html;
  const slice = html.slice(0, max);
  const boundary = Math.max(
    slice.lastIndexOf('</p>'),
    slice.lastIndexOf('</li>'),
    slice.lastIndexOf('</h2>'),
    slice.lastIndexOf('</h3>'),
    slice.lastIndexOf('</h4>'),
    slice.lastIndexOf('</blockquote>')
  );
  if (boundary > 0) {
    const gt = html.indexOf('>', boundary);
    if (gt > 0) return html.slice(0, gt + 1);
  }
  const lastGt = slice.lastIndexOf('>');
  return lastGt > 0 ? html.slice(0, lastGt + 1) : '';
}

/**
 * Sanitize a travel's stored description HTML into a compact, crawler-safe
 * fragment: drops scripts/styles/media, keeps semantic text tags, strips all
 * attributes (except safe <a href>), and clamps length. External links get
 * rel="nofollow noopener"; internal (site-relative / metravel.by) links stay
 * followable so internal link equity flows (helps indexing & crawl depth).
 */
function sanitizeArticleBodyHtml(rawHtml, maxChars = 9000) {
  let html = String(rawHtml || '');
  if (!html.trim()) return '';

  // 1. Remove dangerous and heavy blocks together with their content.
  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<picture[\s\S]*?<\/picture>/gi, '')
    .replace(/<video[\s\S]*?<\/video>/gi, '')
    .replace(/<img[^>]*>/gi, '')
    .replace(/<source[^>]*>/gi, '');

  // 2. Whitelist tags; drop everything else but keep its inner text.
  html = html.replace(/<(\/?)([a-zA-Z0-9]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (m, slash, tag, attrs) => {
    const t = tag.toLowerCase();
    if (!SSG_ALLOWED_TAGS.has(t)) return '';
    if (t === 'br') return '<br/>';
    if (slash) return `</${t}>`;
    if (t === 'a') {
      const hrefMatch = attrs.match(/\shref\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
      let href = hrefMatch ? (hrefMatch[2] || hrefMatch[3] || hrefMatch[4] || '').trim() : '';
      if (/^\s*(javascript:|data:|vbscript:)/i.test(href)) href = '';
      // Keep only absolute http(s) or site-relative links; drop other relatives.
      if (href && !/^https?:\/\//i.test(href) && !href.startsWith('/')) href = '';
      if (!href) return '<a>';
      const isInternal = href.startsWith('/') || /^https?:\/\/(www\.)?metravel\.by/i.test(href);
      const rel = isInternal ? '' : ' rel="nofollow noopener"';
      return `<a href="${escapeHtmlAttr(href)}"${rel}>`;
    }
    return `<${t}>`; // strip all attributes from other allowed tags
  });

  // 3. Collapse whitespace, drop empty blocks, trim.
  html = html
    .replace(/\s+/g, ' ')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<li>\s*<\/li>/gi, '')
    .replace(/>\s+</g, '><')
    .trim();

  return clampHtmlAtBlock(html, maxChars);
}


/**
 * Build travel detail skeleton HTML with inline LCP <img>.
 *
 * The <img> is the LCP element — Chrome paints it before any JS runs,
 * so LCP fires immediately after the preload-link image arrives.
 * After React hydrates, the removal script tears the skeleton down and
 * React's own hero (same image, already cached) takes over.
 *
 * @param {object} opts
 * @param {object|null} opts.heroPreload - { mobile: { href, srcSet, sizes }, desktop: {...} }
 * @param {string} opts.name - Travel name (used as alt + visually-hidden h1)
 */
/** Build a crawlable "Похожие путешествия" internal-links block (FE-IDX-3). */
function buildRelatedBlock(related) {
  if (!Array.isArray(related) || related.length === 0) return '';
  const items = related
    .filter((r) => r && r.path && r.name)
    .map((r) => `<li><a href="${escapeHtmlAttr(r.path)}">${escapeHtmlAttr(r.name)}</a></li>`)
    .join('');
  if (!items) return '';
  return `<nav class="ssg-travel-related" aria-label="Похожие путешествия"><h2>Похожие путешествия</h2><ul>${items}</ul></nav>`;
}

function buildTravelSkeletonHtml({ heroPreload, name, descriptionHtml, related } = {}) {
  let heroImg = '';
  if (heroPreload?.mobile?.href || heroPreload?.desktop?.href) {
    const desktop = heroPreload.desktop || heroPreload.mobile;
    const mobile = heroPreload.mobile || heroPreload.desktop;
    const sources = [];
    if (mobile?.href) {
      sources.push(
        `<source media="(max-width: 767px)" srcset="${escapeHtmlAttr(mobile.srcSet || mobile.href)}" sizes="${escapeHtmlAttr(mobile.sizes || '100vw')}"/>`
      );
    }
    if (desktop?.href) {
      sources.push(
        `<source media="(min-width: 768px)" srcset="${escapeHtmlAttr(desktop.srcSet || desktop.href)}" sizes="${escapeHtmlAttr(desktop.sizes || '720px')}"/>`
      );
    }
    const fallback = desktop?.href || mobile?.href;
    heroImg =
      `<picture>${sources.join('')}` +
      `<img class="ssg-travel-hero-img" src="${escapeHtmlAttr(fallback)}" alt="${escapeHtmlAttr(name || 'Фотография маршрута')}" decoding="async" fetchpriority="high" data-lcp data-ssg-lcp="true"/></picture>`;
  }
  let blurLayers = '';
  if (heroPreload?.mobile?.href || heroPreload?.desktop?.href) {
    const mobileBlurHref = heroPreload.mobile?.href || heroPreload.desktop?.href;
    const desktopBlurHref = heroPreload.desktop?.href || heroPreload.mobile?.href;
    // Backdrop image URLs match the preloaded hero variants exactly, so the
    // browser serves them from cache — no extra network request.
    blurLayers =
      `<div class="ssg-travel-hero-blur ssg-blur-mobile" style="background-image:url(&quot;${escapeHtmlAttr(mobileBlurHref)}&quot;)" aria-hidden="true"></div>` +
      `<div class="ssg-travel-hero-blur ssg-blur-desktop" style="background-image:url(&quot;${escapeHtmlAttr(desktopBlurHref)}&quot;)" aria-hidden="true"></div>`;
  }
  const heroBlock = heroImg
    ? `<div class="ssg-travel-hero">${blurLayers}${heroImg}<div class="ssg-travel-hero-bg"></div></div>`
    : `<div class="ssg-travel-hero ssg-pulse"></div>`;

  // FE-IDX-1: render the REAL article text into the pre-hydration shell so
  // crawlers see substantive, indexable content (not just placeholder bars).
  // The shell is a sibling before #root and is torn down on hydration, so this
  // is visible-but-transient: no duplicate UX, no #root flex-layout conflict.
  // Visible pre-hydration title. NOT an <h1>: the single semantic <h1> stays the
  // out-of-flow one injected before #root by injectHiddenH1 (so raw HTML keeps
  // exactly one H1 — post-deploy SEO check enforces travel.h1.count === 1).
  // Styled identically via the .ssg-travel-h1 class.
  const titleText = String(name || '').trim();
  const titleBlock = titleText ? `<div class="ssg-travel-h1">${escapeHtmlAttr(titleText)}</div>` : '';
  const articleHtml = sanitizeArticleBodyHtml(descriptionHtml);
  const contentBlock = articleHtml
    ? `<div class="ssg-travel-article">${articleHtml}</div>`
    : `<div class="ssg-travel-title ssg-pulse"></div>
<div class="ssg-travel-meta ssg-pulse"></div>
<div class="ssg-travel-line w90 ssg-pulse"></div>
<div class="ssg-travel-line w75 ssg-pulse"></div>
<div class="ssg-travel-line w60 ssg-pulse"></div>
<div class="ssg-travel-line w90 ssg-pulse"></div>
<div class="ssg-travel-line w75 ssg-pulse"></div>`;

  return `<div id="ssg-skeleton">
<div class="ssg-bar"><div class="ssg-bar-logo">MeTravel</div></div>
<div class="ssg-travel-spacer"></div>
<div class="ssg-travel-wrap">
${heroBlock}
${titleBlock}
${contentBlock}
${buildRelatedBlock(related)}
</div>
${buildRemovalScript()}
</div>`;
}

/**
 * Inject a skeleton shell into an HTML string for a given route.
 * Routes with skeletons: `/`, `/search`, `/travels/[slug]`.
 *
 * @param {string} html - Base HTML string
 * @param {string} route - Route path (e.g. '/', '/search', '/travels/<slug>')
 * @param {object} [ctx] - Route-specific context (heroPreload, name for travel)
 * @returns {string} HTML with skeleton injected (or unchanged)
 */
function injectSkeletonShell(html, route, ctx) {
  let skeleton = '';
  if (route === '/') {
    skeleton = buildHomeSkeletonHtml();
  } else if (route === '/search') {
    skeleton = buildSearchSkeletonHtml();
  } else if (typeof route === 'string' && route.startsWith('/travels/')) {
    skeleton = buildTravelSkeletonHtml(ctx || {});
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
  buildTravelSkeletonHtml,
  injectSkeletonShell,
  buildRemovalScript,
  sanitizeArticleBodyHtml,
  COLORS,
};
