// app/_document.tsx
import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';
import { DESIGN_COLORS } from '@/constants/designSystem';
import { getAnalyticsInlineScript } from '@/utils/analyticsInlineScript';
import { buildCriticalCSS } from '@/utils/criticalCSSBuilder';
export { getAnalyticsInlineScript };

const METRIKA_ID = process.env.EXPO_PUBLIC_METRIKA_ID ? parseInt(process.env.EXPO_PUBLIC_METRIKA_ID, 10) : 0;
const GA_ID = process.env.EXPO_PUBLIC_GOOGLE_GA4 || '';

if (!METRIKA_ID && typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.error('[Analytics] EXPO_PUBLIC_METRIKA_ID is not set. Analytics will be disabled.');
}
if (!GA_ID && typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.error('[Analytics] EXPO_PUBLIC_GOOGLE_GA4 is not set. Analytics will be disabled.');
}

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
    // Replace font-display:auto with font-display:swap in any @font-face rule string.
    function forceFontSwap(css) {
      return css.replace(/@font-face\s*\{([^}]*)\}/g, function(match, body) {
        if (body.indexOf('font-display:swap') !== -1) return match;
        if (body.indexOf('font-display') !== -1) {
          return match.replace(/font-display\s*:\s*[^;}"']+/g, 'font-display:swap');
        }
        return match.replace(/\}\s*$/, ';font-display:swap;}');
      });
    }

    // 1. Patch CSSStyleSheet.insertRule (catches dynamically inserted rules)
    if (window.CSSStyleSheet) {
      var proto = window.CSSStyleSheet.prototype;
      if (proto && !proto.__metravelFontSwapPatched && typeof proto.insertRule === 'function') {
        var originalInsertRule = proto.insertRule;
        proto.insertRule = function(rule, index) {
          try {
            if (typeof rule === 'string' && rule.indexOf('@font-face') !== -1) {
              rule = forceFontSwap(rule);
            }
          } catch (_e) {}
          return originalInsertRule.call(this, rule, index);
        };
        proto.__metravelFontSwapPatched = true;
      }
    }

    // 2. MutationObserver to catch <style> elements and text nodes injected into them
    //    (expo-font appends text nodes to an existing <style> element)
    function patchStyleElement(el) {
      if (!el || !el.textContent || el.textContent.indexOf('@font-face') === -1) return;
      var patched = forceFontSwap(el.textContent);
      if (patched !== el.textContent) el.textContent = patched;
    }
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          var nodes = m.addedNodes;
          for (var j = 0; j < nodes.length; j++) {
            var node = nodes[j];
            // New <style> element added
            if (node.tagName === 'STYLE') {
              patchStyleElement(node);
            }
            // Text node appended to an existing <style> (expo-font pattern)
            if (node.nodeType === 3 && m.target && m.target.tagName === 'STYLE') {
              patchStyleElement(m.target);
            }
          }
        }
      }).observe(document.head || document.documentElement, { childList: true, subtree: true });
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
        var quality = isMobile ? 40 : 55;

        // Match TravelDetailsHero.tsx: lcpWidths = isMobile ? [320, 400] : [640, 860]
        var widths = isMobile ? [320, 400] : [640, 860];

        // Build srcSet entries — dpr must match TravelDetailsHero.tsx buildResponsiveImageProps
        var srcSetDpr = isMobile ? 1 : 1.5;
        var srcSetParts = [];
        for (var i = 0; i < widths.length; i++) {
          var u = buildOptimizedUrl(url, widths[i], quality, updatedAt, id, srcSetDpr);
          if (u) srcSetParts.push(u + ' ' + widths[i] + 'w');
        }

        // The main src uses the widest breakpoint; on mobile use dpr=1 to match buildResponsiveImageProps
        var widest = widths[widths.length - 1];
        var preloadHref = buildOptimizedUrl(url, widest, quality, updatedAt, id, isMobile ? 1 : 1.5);
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

	      {/* Consolidated critical head script: title fallback + theme detection */}
      <script
        dangerouslySetInnerHTML={{
          __html: String.raw`(function(){try{var f='MeTravel';var t=document.querySelector('head title[data-rh="true"]');if(t&&!t.textContent)t.textContent=f;if(!document.title)document.title=f}catch(_){}try{var s=null;try{s=window.localStorage.getItem('theme')}catch(_){}var th=(s==='light'||s==='dark'||s==='auto')?s:'auto';var d=false;if(th==='dark')d=true;else if(th!=='light')d=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches;var r=document.documentElement;r.setAttribute('data-theme',d?'dark':'light');r.style.colorScheme=d?'dark':'light'}catch(_){}window.__EXPO_ROUTER_INSPECTOR=false})();`,
        }}
      />
      
      {!isProduction && <meta name="robots" content="noindex,nofollow" />}

      {/* Resource hints - critical domains only (map-specific hints moved to ensureLeafletCss) */}
      <link rel="dns-prefetch" href="//cdn.metravel.by" />
      <link rel="dns-prefetch" href="//api.metravel.by" />
      <link rel="preconnect" href="https://cdn.metravel.by" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://api.metravel.by" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://images.weserv.nl" crossOrigin="anonymous" />
      
      {/* Icons */}
      <link rel="icon" href="/assets/icons/logo_yellow.ico" sizes="any" type="image/x-icon" />
      <link rel="apple-touch-icon" href="/assets/icons/logo_yellow.ico" />
      <link rel="manifest" href="/manifest.json" />

      {/* Critical CSS */}
      <style dangerouslySetInnerHTML={{ __html: buildCriticalCSS() }} />

      {/* Ensure font-display=swap for dynamically injected icon fonts */}
      <script
        dangerouslySetInnerHTML={{ __html: getFontFaceSwapScript() }}
      />

      <script
        dangerouslySetInnerHTML={{ __html: getEntryPreloadScript() }}
      />

      <ScrollViewStyleReset />

      {/* Consolidated non-critical head script: stale chunk recovery + console suppression */}
      <script
        dangerouslySetInnerHTML={{ __html: String.raw`(function(){if(typeof window==='undefined')return;var KEY='__metravel_chunk_reload';function isStale(m){return/requiring unknown module|cannot find module|loading chunk|failed to fetch dynamically imported module/i.test(m)}function doReload(){try{sessionStorage.setItem(KEY,'1')}catch(_){}try{window.location.reload()}catch(_){}}function handler(e){var m=String((e&&e.message)||(e&&e.reason&&e.reason.message)||'');if(!isStale(m))return;try{if(sessionStorage.getItem(KEY))return}catch(_){}e.preventDefault&&e.preventDefault();if('caches' in window){caches.keys().then(function(ns){return Promise.all(ns.filter(function(n){return n.indexOf('metravel-js')===0||n.indexOf('metravel-critical')===0}).map(function(n){return caches.delete(n)}))}).then(doReload).catch(doReload)}else{doReload()}}window.addEventListener('error',handler);window.addEventListener('unhandledrejection',function(e){var r=e&&e.reason;var m=String((r&&r.message)||r||'');if(!isStale(m))return;handler({message:m,preventDefault:function(){e.preventDefault&&e.preventDefault()}})});try{sessionStorage.removeItem(KEY)}catch(_){}var h=window.location&&window.location.hostname;if(h==='metravel.by'||h==='www.metravel.by'||h==='localhost'||h==='127.0.0.1'){var re=/Indexed property setter is not supported|shadow\*.*deprecated|textShadow\*.*deprecated|pointerEvents is deprecated|useNativeDriver.*native animated module|useLayoutEffect does nothing on the server/;var oe=console.error,ow=console.warn;console.error=function(){var m=arguments[0];if(typeof m==='string'&&re.test(m))return;oe.apply(console,arguments)};console.warn=function(){var m=arguments[0];if(typeof m==='string'&&re.test(m))return;ow.apply(console,arguments)}}})();` }}
      />
    </head>

    <body>
    {children}

    {/* Travel hero preload — moved to body to avoid blocking head parsing on non-travel pages */}
    <script
      dangerouslySetInnerHTML={{ __html: getTravelHeroPreloadScript() }}
    />

    {/* LCP decode helper */}
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){function o(){try{var i=document.querySelector('[data-lcp]');if(!i)return;if(!i.getAttribute('fetchPriority'))i.setAttribute('fetchPriority','high');if(i.decode&&i.complete)i.decode().catch(function(){})}catch(_){}}function s(){if(window.requestIdleCallback)window.requestIdleCallback(o,{timeout:2000});else setTimeout(o,1500)}if(document.readyState==='complete')s();else window.addEventListener('load',s,{once:true})})();`,
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

// criticalCSS is now built by utils/criticalCSSBuilder.ts to avoid Babel parse errors with CSS selectors in template literals.
