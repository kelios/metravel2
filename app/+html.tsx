// app/_document.tsx
import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';
import { DESIGN_COLORS } from '@/constants/designSystem';

const METRIKA_ID = process.env.EXPO_PUBLIC_METRIKA_ID ? parseInt(process.env.EXPO_PUBLIC_METRIKA_ID, 10) : 0;
const GA_ID = process.env.EXPO_PUBLIC_GOOGLE_GA4 || '';

if (!METRIKA_ID && typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.error('[Analytics] EXPO_PUBLIC_METRIKA_ID is not set. Analytics will be disabled.');
}
if (!GA_ID && typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.error('[Analytics] EXPO_PUBLIC_GOOGLE_GA4 is not set. Analytics will be disabled.');
}

export const getAnalyticsInlineScript = (metrikaId: number, gaId: string) => {
  if (!metrikaId && !gaId) {
    return String.raw`(function(){
  // Analytics disabled: missing both EXPO_PUBLIC_METRIKA_ID and EXPO_PUBLIC_GOOGLE_GA4
})();`;
  }
  return String.raw`
(function(){
  var host = window.location.hostname;
  var isProdHost = host === 'metravel.by' || host === 'www.metravel.by';
  if (!isProdHost) return;

  var CONSENT_KEY = 'metravel_consent_v1';
  var HAS_METRIKA = ${metrikaId ? 'true' : 'false'};
  var HAS_GA = ${gaId ? 'true' : 'false'};
  var GA_ID = '${gaId || ''}';
  
  if (HAS_METRIKA) window.__metravelMetrikaId = ${metrikaId || 0};
  if (HAS_GA) window.__metravelGaId = GA_ID;

  function readConsent(){
    try {
      var raw = window.localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      if (!data.necessary) return null;
      // Backward compat: older stored objects might not have the analytics field.
      // In opt-out model, missing field means "not decided" => allow analytics.
      var analytics = (typeof data.analytics === 'boolean') ? data.analytics : true;
      return { necessary: !!data.necessary, analytics: !!analytics };
    } catch (e) {
      return null;
    }
  }

  function isAnalyticsAllowed(){
    // Opt-out model:
    // - if no saved consent yet -> allow analytics (so metrics don't drop to zero)
    // - if user explicitly disabled analytics -> do not track
    var c = readConsent();
    if (!c) return true;
    return !!c.analytics;
  }

  function bootstrapGa(){
    if (!HAS_GA || !GA_ID) return;
    // Respect explicit user opt-out.
    if (!isAnalyticsAllowed()) {
      try { window['ga-disable-' + GA_ID] = true; } catch(_e) {}
      return;
    }

    if (window.__metravelGaBootstrapped) return;
    window.__metravelGaBootstrapped = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', GA_ID, { transport_type: 'beacon' });

    var ga = document.createElement('script');
    ga.async = true;
    ga.defer = true;
    ga.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(ga);
  }

  function trackPage(){
    try {
      var url = window.location.href;
      if (window.__metravelLastTrackedUrl === url) return;
      window.__metravelLastTrackedUrl = url;
      if (HAS_METRIKA && window.ym) {
        window.ym(${metrikaId || 0}, 'hit', url, {
          title: document.title,
          referer: document.referrer
        });
      }
      if (HAS_GA && GA_ID && window.gtag && isAnalyticsAllowed() && !window['ga-disable-' + GA_ID]) {
        window.gtag('event', 'page_view', {
          page_title: document.title,
          page_location: url
        });
      }
    } catch(_){}
  }

  // Патчим history (SPA pageviews)
  (function patchHistory(){
    try {
      var _ps = window.history && window.history.pushState;
      var _rs = window.history && window.history.replaceState;
      if (_ps && _rs) {
        window.history.pushState = function(){ var r=_ps.apply(this, arguments); trackPage(); return r; };
        window.history.replaceState = function(){ var r=_rs.apply(this, arguments); trackPage(); return r; };
      }
      window.addEventListener('popstate', trackPage);
    } catch(_e) {}
  })();

  // Отложенная загрузка аналитики после idle (Metрика + гарантированный первичный page_view)
  function loadAnalytics() {
    if (!isAnalyticsAllowed()) return;
    if (window.__metravelAnalyticsLoaded) return;
    window.__metravelAnalyticsLoaded = true;

    // GA bootstrap (may be skipped if explicitly disabled)
    bootstrapGa();

    // ---------- Yandex Metrika (официальный сниппет) ----------
    if (HAS_METRIKA && isAnalyticsAllowed()) {
      (function(m,e,t,r,i,k,a){
          m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
          m[i].l=1*new Date();
          k=e.createElement(t),a=e.getElementsByTagName(t)[0],
          k.async=1;k.src=r;
          if (a && a.parentNode) {
            a.parentNode.insertBefore(k,a);
          } else if (e.head) {
            e.head.appendChild(k);
          } else if (e.documentElement) {
            e.documentElement.appendChild(k);
          }
      })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

      if (window.ym) {
          window.ym(${metrikaId || 0}, "init", {
              clickmap:true,
              trackLinks:true,
              accurateTrackBounce:true,
              webvisor:true,
              defer:true
          });
      }
    }

    // Первичный хит после загрузки / после принятия баннера
    try {
      if (document.readyState === 'complete') setTimeout(trackPage, 0);
      else window.addEventListener('load', function(){ setTimeout(trackPage, 0); }, { once:true });
    } catch(_e) {}
  }

  // Делаем функцию доступной глобально для React-баннера
  window.metravelLoadAnalytics = loadAnalytics;

  // Synchronously set GA opt-out flag if user explicitly disabled analytics.
  // This must happen before any GA script loads to prevent tracking.
  if (HAS_GA && GA_ID && !isAnalyticsAllowed()) {
    try { window['ga-disable-' + GA_ID] = true; } catch(_e) {}
  }

  // Автозагрузка:
  // - GA + Метрика: по idle (если не было явного opt-out)
  // Defer all analytics to avoid blocking the main thread during initial render.
  if (isAnalyticsAllowed()) {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(loadAnalytics, { timeout: 3000 });
    } else {
      setTimeout(loadAnalytics, 3000);
    }
  }
})();
`;
};

const getEntryPreloadScript = () => String.raw`
(function(){
  try {
    if (typeof document === 'undefined') return;
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      var src = s && s.getAttribute ? s.getAttribute('src') : '';
      if (!src) continue;
      if (src.indexOf('/_expo/static/js/web/entry-') !== -1 && src.indexOf('.js') !== -1) {
        try {
          if (!s.getAttribute('fetchPriority')) {
            s.setAttribute('fetchPriority', 'high');
          }
          if (typeof s.fetchPriority !== 'undefined') {
            s.fetchPriority = 'high';
          }
        } catch (_e) {}
        break;
      }
    }
  } catch (_e) {}
})();
`;

const getFontFaceSwapScript = () => String.raw`
(function(){
  try {
    // 1. Patch CSSStyleSheet.insertRule (catches dynamically inserted rules)
    if (window.CSSStyleSheet) {
      var proto = window.CSSStyleSheet.prototype;
      if (proto && !proto.__metravelFontSwapPatched && typeof proto.insertRule === 'function') {
        var originalInsertRule = proto.insertRule;
        proto.insertRule = function(rule, index) {
          try {
            if (typeof rule === 'string' && rule.indexOf('@font-face') !== -1 && rule.indexOf('font-display') === -1) {
              rule = rule.replace(/\}\s*$/, ';font-display:swap;}');
            }
          } catch (_e) {}
          return originalInsertRule.call(this, rule, index);
        };
        proto.__metravelFontSwapPatched = true;
      }
    }

    // 2. MutationObserver to catch <style> elements injected via textContent/innerHTML
    //    (e.g. @expo/vector-icons injects icon font-face this way)
    function patchFontDisplay(css) {
      return css.replace(/@font-face\s*\{([^}]*)\}/g, function(match, body) {
        if (body.indexOf('font-display') !== -1) return match;
        return match.replace(/\}\s*$/, ';font-display:swap;}');
      });
    }
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var nodes = mutations[i].addedNodes;
          for (var j = 0; j < nodes.length; j++) {
            var node = nodes[j];
            if (node.tagName === 'STYLE' && node.textContent && node.textContent.indexOf('@font-face') !== -1) {
              var patched = patchFontDisplay(node.textContent);
              if (patched !== node.textContent) node.textContent = patched;
            }
          }
        }
      }).observe(document.head || document.documentElement, { childList: true, subtree: true });
    }
  } catch (_e) {}
})();
`;

const getIconFontPreloadScript = () => String.raw`
(function(){
  try {
    if (typeof document === 'undefined') return;
    // Find the Feather icon font injected by @expo/vector-icons and preload it.
    // The font is typically loaded via a dynamically inserted @font-face rule;
    // preloading it avoids FOIT and reduces the font-loading penalty.
    var sheets = document.styleSheets;
    for (var i = 0; i < sheets.length; i++) {
      try {
        var rules = sheets[i].cssRules || sheets[i].rules;
        if (!rules) continue;
        for (var j = 0; j < rules.length; j++) {
          var rule = rules[j];
          if (rule.type === CSSRule.FONT_FACE_RULE) {
            var src = rule.style.getPropertyValue('src') || '';
            if (src.indexOf('Feather') !== -1 || src.indexOf('feather') !== -1) {
              var match = src.match(/url\(["']?([^"')]+)["']?\)/);
              if (match && match[1]) {
                var link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'font';
                link.type = 'font/ttf';
                link.href = match[1];
                link.crossOrigin = 'anonymous';
                document.head.appendChild(link);
                return;
              }
            }
          }
        }
      } catch (_e) { /* cross-origin sheets */ }
    }

    // Fallback: scan <style> elements for @font-face with feather in the src
    var styles = document.querySelectorAll('style');
    for (var k = 0; k < styles.length; k++) {
      var text = styles[k].textContent || '';
      if (text.indexOf('@font-face') === -1) continue;
      if (text.indexOf('feather') === -1 && text.indexOf('Feather') === -1) continue;
      var m = text.match(/url\(["']?([^"')]+(?:Feather|feather)[^"')]*)["']?\)/);
      if (!m) m = text.match(/url\(["']?([^"')]+\.ttf[^"')]*)["']?\)/);
      if (m && m[1]) {
        var l = document.createElement('link');
        l.rel = 'preload';
        l.as = 'font';
        l.type = 'font/ttf';
        l.href = m[1];
        l.crossOrigin = 'anonymous';
        document.head.appendChild(l);
        return;
      }
    }
  } catch (_e) {}
})();
`;

const getHomeHeroPreloadScript = () => String.raw`
(function(){
  try {
    var path = window.location && window.location.pathname;
    // Only run on the home page
    if (path && path !== '/' && path !== '/index') return;

    // Preload the home hero image (pdf.webp) for faster LCP.
    // The image is a static asset bundled by Expo, so we look for it in the
    // rendered HTML or construct the known asset path.
    function findAssetUrl() {
      // In production builds, Expo hashes static assets into /_expo/static/...
      // We can't know the exact hash at HTML-generation time, but we can
      // discover it from <script> or <link> tags, or just preconnect to self.
      // The most reliable approach: create an early <link rel="preload"> once
      // we find the image in the DOM after first paint.
      return null;
    }

    // Instead of preloading the image (which we can't resolve the hashed URL for),
    // we ensure the entry JS bundle gets high priority so React renders the hero faster.
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      var src = s && s.getAttribute ? s.getAttribute('src') : '';
      if (!src) continue;
      if (src.indexOf('/_expo/static/js/web/entry-') !== -1) {
        try {
          s.setAttribute('fetchPriority', 'high');
          if (typeof s.fetchPriority !== 'undefined') s.fetchPriority = 'high';
        } catch (_e) {}

        // Also add a modulepreload/preload link for the entry bundle
        if (!document.querySelector('link[rel="modulepreload"][href="' + src + '"]') &&
            !document.querySelector('link[rel="preload"][href="' + src + '"]')) {
          var link = document.createElement('link');
          link.rel = s.type === 'module' ? 'modulepreload' : 'preload';
          if (link.rel === 'preload') link.as = 'script';
          link.href = src;
          try {
            link.fetchPriority = 'high';
            link.setAttribute('fetchPriority', 'high');
          } catch (_e) {}
          document.head.appendChild(link);
        }
        break;
      }
    }
  } catch (_e) {}
})();
`;

const getTravelHeroPreloadScript = () => String.raw`
(function(){
  try {
    var host = window.location && window.location.hostname;
    var isProdHost = host === 'metravel.by' || host === 'www.metravel.by' || host === 'localhost' || host === '127.0.0.1';
    if (!isProdHost) return;
    var path = window.location && window.location.pathname;
    if (!path || path.indexOf('/travels/') !== 0) return;
    var slug = path.replace(/^\/travels\//, '').replace(/\/+$/, '');
    if (!slug) return;

    var isId = /^[0-9]+$/.test(slug);
    var apiBase = (window.location && window.location.origin) || '';
    if (!apiBase) return;
    var endpoint = isId
      ? apiBase + '/api/travels/' + encodeURIComponent(slug) + '/'
      : apiBase + '/api/travels/by-slug/' + encodeURIComponent(slug) + '/';

    function supportsAvif() {
      try {
        var canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
      } catch (_e) {
        return false;
      }
    }

    function supportsWebP() {
      try {
        var canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
      } catch (_e) {
        return false;
      }
    }

    var _preferredFormat = null;
    function getPreferredFormat() {
      if (_preferredFormat) return _preferredFormat;
      _preferredFormat = supportsAvif() ? 'avif' : (supportsWebP() ? 'webp' : 'jpg');
      return _preferredFormat;
    }

    // Must match optimizeImageUrl() in utils/imageOptimization.ts exactly.
    // Key difference from old code: metravel.by/cdn.metravel.by/api.metravel.by are
    // "allowed transform hosts" — params are added directly (using 'f' for format),
    // NOT proxied through images.weserv.nl (which uses 'output' for format).
    function buildOptimizedUrl(rawUrl, width, quality, updatedAt, id, explicitDpr) {
      try {
        var resolved = new URL(rawUrl, window.location.origin);

        // Force HTTPS for non-local hosts (matches optimizeImageUrl)
        if (resolved.protocol === 'http:') {
          var h = resolved.hostname.toLowerCase();
          if (h !== 'localhost' && h !== '127.0.0.1' && !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(h)) {
            resolved.protocol = 'https:';
          }
        }

        // Add version param (matches buildVersionedImageUrl)
        if (updatedAt) {
          var ts = Date.parse(updatedAt);
          if (!isNaN(ts)) resolved.searchParams.set('v', String(ts));
        } else if (id) {
          resolved.searchParams.set('v', String(id));
        }

        var rHost = (resolved.hostname || '').toLowerCase();
        var isAllowedHost = rHost === 'metravel.by' || rHost === 'cdn.metravel.by' || rHost === 'api.metravel.by' || rHost === 'images.weserv.nl';
        var isWeserv = rHost === 'images.weserv.nl';

        var preferredFormat = getPreferredFormat();
        var dpr = typeof explicitDpr === 'number' ? explicitDpr : Math.min(window.devicePixelRatio || 1, 2);
        var actualWidth = width ? Math.round(width * dpr) : width;

        if (!isAllowedHost) {
          // Proxy through weserv for non-allowed external hosts
          var proxy = new URL('https://images.weserv.nl/');
          var cleanUrl = resolved.toString().replace(/^https?:\/\//i, '');
          proxy.searchParams.set('url', cleanUrl);
          if (actualWidth) proxy.searchParams.set('w', String(actualWidth));
          if (quality) proxy.searchParams.set('q', String(quality));
          proxy.searchParams.set('output', preferredFormat);
          proxy.searchParams.set('fit', 'cover');
          return proxy.toString();
        }

        // For allowed hosts, add params directly (matching optimizeImageUrl exactly)
        if (actualWidth) resolved.searchParams.set('w', String(actualWidth));
        if (quality && quality !== 100) resolved.searchParams.set('q', String(quality));

        if (isWeserv) {
          resolved.searchParams.set('output', preferredFormat);
        } else {
          resolved.searchParams.set('f', preferredFormat);
        }
        resolved.searchParams.set('fit', 'cover');

        return resolved.toString();
      } catch (_e) {
        return null;
      }
    }

    function run(){
      var controller = window.AbortController ? new AbortController() : null;
      var timeout = setTimeout(function(){
        try { if (controller) controller.abort(); } catch (_e) {}
      }, 2500);

      fetch(endpoint, {
        method: 'GET',
        credentials: 'omit',
        signal: controller ? controller.signal : undefined
      }).then(function(res){
        if (!res || !res.ok) return null;
        return res.json();
      }).then(function(data){
        if (!data) return;

        // Cache API response globally so React Query can reuse it (avoids double fetch)
        try { window.__metravelTravelPreload = { data: data, slug: slug, isId: isId }; } catch (_e) {}

        var url = data.travel_image_thumb_url;
        var updatedAt = data.updated_at;
        var id = data.id;

        if (!url) {
            var gallery = data.gallery;
            if (gallery && gallery.length) {
                var first = gallery[0];
                url = typeof first === 'string' ? first : first && first.url;
                updatedAt = typeof first === 'string' ? undefined : first.updated_at;
                id = typeof first === 'string' ? undefined : first.id;
            }
        }

        if (!url || typeof url !== 'string') return;

        // Skip preload if the LCP image is already rendered and loaded
        var existingLcp = document.querySelector('img[data-lcp]');
        if (existingLcp && existingLcp.complete && existingLcp.naturalWidth > 0) return;

        var isMobile = (window.innerWidth || 0) <= 540;
        var quality = isMobile ? 60 : 65;

        // Match TravelDetailsHero.tsx: lcpWidths = isMobile ? [320, 400] : [640, 860]
        var widths = isMobile ? [320, 400] : [640, 860];

        // Build srcSet entries with dpr=1 (matches generateSrcSet in buildResponsiveImageProps)
        var srcSetParts = [];
        for (var i = 0; i < widths.length; i++) {
          var u = buildOptimizedUrl(url, widths[i], quality, updatedAt, id, 1);
          if (u) srcSetParts.push(u + ' ' + widths[i] + 'w');
        }

        // The main src uses the widest breakpoint with DEFAULT dpr (matches buildResponsiveImageProps)
        var widest = widths[widths.length - 1];
        var preloadHref = buildOptimizedUrl(url, widest, quality, updatedAt, id);
        if (!preloadHref) return;

        try {
          var resolved = new URL(preloadHref, window.location.origin);
          var origin = resolved.origin;
          if (origin && !document.querySelector('link[rel="preconnect"][href="' + origin + '"]')) {
            var pre = document.createElement('link');
            pre.rel = 'preconnect';
            pre.href = origin;
            pre.crossOrigin = 'anonymous';
            document.head.appendChild(pre);
          }
        } catch (_e) {}

        if (document.querySelector('link[rel="preload"][href="' + preloadHref + '"]')) return;
        var link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = preloadHref;

        // Exact match with TravelDetailsHero.tsx sizes
        var sizesAttr = isMobile ? '100vw' : '(max-width: 1024px) 92vw, 860px';

        if (srcSetParts.length > 0) {
          link.setAttribute('imagesrcset', srcSetParts.join(', '));
          link.setAttribute('imagesizes', sizesAttr);
        }
        try {
          link.fetchPriority = 'high';
          link.setAttribute('fetchPriority', 'high');
        } catch (_e) {}
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }).catch(function(){}).finally(function(){
        clearTimeout(timeout);
      });
    }

    // Run immediately to start fetching API data for LCP image as soon as possible
    // independent of React hydration.
    run();
  } catch (_e) {}
})();
`;

export default function Root({ children }: { children: React.ReactNode }) {
  const isProduction = typeof process !== 'undefined' && 
    (process.env.EXPO_PUBLIC_SITE_URL === 'https://metravel.by' || 
     process.env.NODE_ENV === 'production');
  
  return (
    <html lang="ru" suppressHydrationWarning>
    <head>
      <meta charSet="utf-8" />
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=5" />
	      <meta name="theme-color" content={DESIGN_COLORS.themeColorDark} media="(prefers-color-scheme: dark)" />
	      <meta name="theme-color" content={DESIGN_COLORS.themeColorLight} media="(prefers-color-scheme: light)" />
	      <meta name="color-scheme" content="light dark" />

	      <script
	        dangerouslySetInnerHTML={{
	          __html: String.raw`
(function(){
  try {
    var fallback = 'MeTravel';
    var rhTitle = document.querySelector('head title[data-rh=\"true\"]');
    if (rhTitle && !rhTitle.textContent) rhTitle.textContent = fallback;
    if (!document.title) document.title = fallback;
  } catch (_e) {}
})();
`,
        }}
      />
      
      {!isProduction && <meta name="robots" content="noindex,nofollow" />}

      <script
        dangerouslySetInnerHTML={{
          __html: String.raw`
(function(){
  try {
    var stored = null;
    try { stored = window.localStorage.getItem('theme'); } catch (_e) {}
    var theme = (stored === 'light' || stored === 'dark' || stored === 'auto') ? stored : 'auto';
    var isDark = false;
    if (theme === 'dark') {
      isDark = true;
    } else if (theme === 'light') {
      isDark = false;
    } else {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    var root = document.documentElement;
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    root.style.colorScheme = isDark ? 'dark' : 'light';
  } catch (_e) {}
})();
`,
        }}
      />

      {/* Resource hints - critical domains */}
      <link rel="dns-prefetch" href="//cdn.metravel.by" />
      <link rel="dns-prefetch" href="//api.metravel.by" />
      <link rel="dns-prefetch" href="//tile.openstreetmap.org" />
      <link rel="preconnect" href="https://cdn.metravel.by" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://api.metravel.by" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://images.weserv.nl" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://tile.openstreetmap.org" crossOrigin="anonymous" />
      
      {/* Icons */}
      <link rel="icon" href="/assets/icons/logo_yellow.ico" sizes="any" type="image/x-icon" />
      <link rel="apple-touch-icon" href="/assets/icons/logo_yellow.ico" />
      <link rel="manifest" href="/manifest.json" />

      {/* Critical CSS */}
      <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />

      {/* Ensure font-display=swap for dynamically injected icon fonts */}
      <script
        dangerouslySetInnerHTML={{ __html: getFontFaceSwapScript() }}
      />

      <script
        dangerouslySetInnerHTML={{ __html: getEntryPreloadScript() }}
      />

      {/* Early home hero optimization: boost entry bundle priority on / */}
      <script
        dangerouslySetInnerHTML={{ __html: getHomeHeroPreloadScript() }}
      />

      {/* Early travel hero preload to improve LCP on /travels/* */}
      <script
        dangerouslySetInnerHTML={{ __html: getTravelHeroPreloadScript() }}
      />

      {/* Preload icon font once injected by @expo/vector-icons */}
      <script
        dangerouslySetInnerHTML={{ __html: getIconFontPreloadScript() }}
      />

      <ScrollViewStyleReset />

      {/* Выключаем Expo Router Inspector */}
      <script
        dangerouslySetInnerHTML={{ __html: `window.__EXPO_ROUTER_INSPECTOR=false;` }}
      />

      {/* Suppress known RN/SVG/navigation console noise */}
      <script
        dangerouslySetInnerHTML={{
          __html: String.raw`(function(){
  if(typeof window==='undefined')return;
  var h=window.location&&window.location.hostname;
  if(h!=='metravel.by'&&h!=='www.metravel.by'&&h!=='localhost'&&h!=='127.0.0.1')return;
  var re=/Indexed property setter is not supported|shadow\*.*deprecated|textShadow\*.*deprecated|pointerEvents is deprecated|useNativeDriver.*native animated module|useLayoutEffect does nothing on the server/;
  var oe=console.error,ow=console.warn;
  console.error=function(){var m=arguments[0];if(typeof m==='string'&&re.test(m))return;oe.apply(console,arguments)};
  console.warn=function(){var m=arguments[0];if(typeof m==='string'&&re.test(m))return;ow.apply(console,arguments)};
})();`,
        }}
      />
    </head>

    <body>
    {children}

    {/* LCP decode helper */}
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function () {
  // IMPORTANT: do not mutate DOM before React hydration.
  function optimizeLCP() {
    try {
      const lcpImg = document.querySelector('[data-lcp]');
      if (!lcpImg) return;
      if (!lcpImg.getAttribute('fetchPriority')) {
        lcpImg.setAttribute('fetchPriority', 'high');
      }
      if (lcpImg.decode && lcpImg.complete) {
        lcpImg.decode().catch(() => undefined);
      }
    } catch (_) {
      // noop
    }
  }

  function scheduleOptimize() {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(optimizeLCP, { timeout: 2000 });
    } else {
      setTimeout(optimizeLCP, 1500);
    }
  }

  // Run after full load to avoid hydration mismatch.
  if (document.readyState === 'complete') {
    scheduleOptimize();
  } else {
    window.addEventListener('load', scheduleOptimize, { once: true });
  }
})();
`,
      }}
    />

    {/* ===== Analytics (отложенная загрузка, только на metravel.by и только при согласии) ===== */}
    <script
      dangerouslySetInnerHTML={{
        __html: getAnalyticsInlineScript(METRIKA_ID, GA_ID),
      }}
    />
    </body>
    </html>
  );
}

const criticalCSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;height:100%;scrollbar-gutter:stable;-webkit-text-size-adjust:100%;-moz-text-size-adjust:100%;text-size-adjust:100%}
body{
  margin:0;
  min-height:100vh;
  min-height:-webkit-fill-available;
  font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen-Sans,Ubuntu,Cantarell,'Helvetica Neue',sans-serif;
  font-display:swap;
  line-height:1.6;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  text-rendering:optimizeSpeed;
  color:var(--color-text,${DESIGN_COLORS.criticalTextLight});
  background:linear-gradient(180deg,var(--color-background,${DESIGN_COLORS.criticalBgLight}) 0%,var(--color-backgroundSecondary,${DESIGN_COLORS.criticalBgSecondaryLight}) 40%,var(--color-surface,${DESIGN_COLORS.criticalSurfaceLight}) 100%);
  padding-bottom:env(safe-area-inset-bottom);
  overflow-y:scroll;
  overflow-x:hidden;
}
img,picture,video,canvas,svg{display:block;max-width:100%;height:auto}
svg[viewBox="0 0 32 32"][width="100%"][height="100%"]{width:32px;height:32px;max-width:none;max-height:none;display:inline-block}
img{width:100%;object-fit:cover;font-style:italic;vertical-align:middle}
input,button,textarea,select{font:inherit;color:inherit}
button{cursor:pointer;background:transparent;border:0}
button:focus-visible,a:focus-visible{outline:2px solid var(--color-focus,${DESIGN_COLORS.criticalFocusLight});outline-offset:2px}
a{color:inherit;text-decoration:none}
[hidden]{display:none !important}
img[data-lcp]{content-visibility:auto;contain:layout style paint;min-height:300px;background:var(--color-backgroundSecondary,${DESIGN_COLORS.criticalBgSecondaryLight});aspect-ratio:16/9}
img[width][height]{aspect-ratio:attr(width)/attr(height)}
img[fetchpriority="high"]{content-visibility:auto}
img[loading="lazy"]{content-visibility:auto}
[data-testid="travel-details-hero"]{min-height:300px;contain:layout style paint;background:var(--color-backgroundSecondary,${DESIGN_COLORS.criticalBgSecondaryLight})}
[data-testid="travel-details-hero"] img{aspect-ratio:16/9;width:100%;max-width:860px;object-fit:cover}
[data-testid="main-header"]{min-height:56px;contain:layout style;position:sticky;top:0;z-index:2000;width:100%}
[data-testid="home-hero"]{contain:layout style}
[data-testid="home-hero-stack"]{min-height:400px;contain:layout style paint;display:flex;flex-direction:column !important;width:100%}
@media (min-width:768px){[data-testid="home-hero-stack"]{flex-direction:row !important;align-items:center}}
[data-testid="home-hero-image-slot"]{display:none}
@media (min-width:768px){[data-testid="home-hero-image-slot"]{display:flex !important;justify-content:center;align-items:center;flex:1;min-width:320px}}
@media (min-width:768px){[data-testid="home-hero-image-slot"] > *{width:320px;height:400px}}
[data-testid="home-hero-stack"] img{width:320px;height:400px;aspect-ratio:4/5;object-fit:cover}
[data-testid*="travel-gallery"] img{aspect-ratio:16/9;contain:layout style paint;object-fit:cover}
[style*="minHeight"]{contain:layout style paint}
[role="img"]:not([aria-label]){font-size:0}
@media (prefers-reduced-motion: reduce){
  html{scroll-behavior:auto}
  *,*::before,*::after{animation-duration:0.01ms !important;animation-iteration-count:1 !important;transition-duration:0.01ms !important;scroll-behavior:auto !important}
}
html[data-theme="dark"]{color-scheme:dark;--color-text:${DESIGN_COLORS.criticalTextDark};--color-background:${DESIGN_COLORS.criticalBgDark};--color-backgroundSecondary:${DESIGN_COLORS.criticalBgSecondaryDark};--color-surface:${DESIGN_COLORS.criticalSurfaceDark};--color-focus:${DESIGN_COLORS.criticalFocusDark}}
html[data-theme="light"]{color-scheme:light;--color-text:${DESIGN_COLORS.criticalTextLight};--color-background:${DESIGN_COLORS.criticalBgLight};--color-backgroundSecondary:${DESIGN_COLORS.criticalBgSecondaryLight};--color-surface:${DESIGN_COLORS.criticalSurfaceLight};--color-focus:${DESIGN_COLORS.criticalFocusLight}}
:focus-visible{outline:2px solid var(--color-focus,${DESIGN_COLORS.criticalFocusLight});outline-offset:2px}
::selection{background-color:rgba(0,102,204,0.3);color:inherit}
@media (max-width:768px){
  html{height:100%;height:-webkit-fill-available;font-size:100%}
  body{min-height:100vh;min-height:-webkit-fill-available;padding-bottom:calc(env(safe-area-inset-bottom) + 80px)}
  img[data-lcp]{min-height:240px;aspect-ratio:16/9;background:var(--color-backgroundTertiary,${DESIGN_COLORS.criticalBgTertiaryLight})}
  [data-testid="travel-details-hero"]{min-height:240px}
  [data-card]{margin-bottom:16px;width:100%;max-width:100%;contain:layout style paint}
  [data-card] img{height:200px;object-fit:cover;width:100%;aspect-ratio:16/9}
}
@media (min-width:769px){
  body{font-size:16px}
}
@supports (padding-bottom: env(safe-area-inset-bottom)){
  body{padding-bottom:env(safe-area-inset-bottom)}
}
[data-testid="footer-dock-row"],[data-testid="footer-desktop-bar"]{display:flex !important;flex-direction:row !important;flex-wrap:nowrap !important;align-items:center !important}
[data-testid="footer-dock-row"]{justify-content:center !important}
[data-testid="footer-desktop-bar"]{justify-content:space-between !important}
[data-testid^="footer-item-"]{display:inline-flex !important;flex-direction:column !important;align-items:center !important;justify-content:center !important;flex:0 0 auto !important}
.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
[data-testid="map-container"]{min-height:400px;contain:layout style;background:var(--color-backgroundSecondary,${DESIGN_COLORS.criticalBgSecondaryLight})}
[data-testid="map-container"],[data-testid="map-leaflet-wrapper"],.leaflet-container,.leaflet-control-container{contain:none !important}
[data-testid="search-container"]{min-height:600px;contain:layout style paint}
[data-testid="travel-card"]{contain:layout style paint;will-change:auto}
[data-testid="map-skeleton"],[data-testid="search-skeleton"]{animation:pulse 1.5s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:0.7}}
`;
