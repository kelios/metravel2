// app/_document.tsx
import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';
import { DESIGN_COLORS } from '@/constants/designSystem';
import { getAnalyticsInlineScript } from '@/utils/analyticsInlineScript';
import { buildCriticalCSS } from '@/utils/criticalCSSBuilder';
import { getStaleRecoveryInlineScript } from '@/utils/recovery/staleRecoveryInlineScript';
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
    function isPrivateHost(h){
      try {
        if (!h) return false;
        h = String(h).toLowerCase();
        if (h === 'localhost' || h === '127.0.0.1') return true;
        if (/^10\./.test(h)) return true;
        if (/^192\.168\./.test(h)) return true;
        if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
        return false;
      } catch (_e) {
        return false;
      }
    }
    var isProdHost = host === 'metravel.by' || host === 'www.metravel.by' || isPrivateHost(host);
    if (!isProdHost) return;
    var path = window.location && window.location.pathname;
    if (!path || path.indexOf('/travels/') !== 0) return;
    var slug = path.replace(/^\/travels\//, '').replace(/\/+$/, '');
    if (!slug) return;

    var isId = /^[0-9]+$/.test(slug);
    var apiBaseEnv = ${JSON.stringify(process.env.EXPO_PUBLIC_API_URL || '')};
    function normalizeApiOrigin(raw){
      try {
        if (!raw) return '';
        var s = String(raw);
        s = s.replace(/\s+/g, '');
        s = s.replace(/\/api\/?$/i, '');
        if (!s) return '';
        var u = new URL(s);
        return u.origin;
      } catch (_e) {
        try {
          var s2 = String(raw).replace(/\/api\/?$/i, '');
          return s2;
        } catch (_e2) {
          return '';
        }
      }
    }
    var sameOriginApiHost = isPrivateHost(host);
    var apiOrigin = sameOriginApiHost
      ? ((window.location && window.location.origin) || '')
      : (normalizeApiOrigin(apiBaseEnv) || ((window.location && window.location.origin) || ''));
    if (!apiOrigin) return;
    var endpoint = isId
      ? apiOrigin + '/api/travels/' + encodeURIComponent(slug) + '/'
      : apiOrigin + '/api/travels/by-slug/' + encodeURIComponent(slug) + '/';

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
    function buildOptimizedUrl(rawUrl, width, quality, updatedAt, id, explicitDpr) {
      try {
        var resolved = new URL(rawUrl, window.location.origin);

        // If backend returns private-host images, remap to public API origin
        // to avoid slow/unreachable requests in prod-like environments.
        var rh = (resolved.hostname || '').toLowerCase();
        var isPrivateResolvedHost =
          rh === 'localhost' ||
          rh === '127.0.0.1' ||
          /^10\./.test(rh) ||
          /^192\.168\./.test(rh) ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(rh);
        if (isPrivateResolvedHost && apiOrigin) {
          try {
            var publicApi = new URL(apiOrigin);
            var ph = (publicApi.hostname || '').toLowerCase();
            var isPrivatePublicApi =
              ph === 'localhost' ||
              ph === '127.0.0.1' ||
              /^10\./.test(ph) ||
              /^192\.168\./.test(ph) ||
              /^172\.(1[6-9]|2\d|3[0-1])\./.test(ph);
            if (!isPrivatePublicApi) {
              resolved = new URL(resolved.pathname + resolved.search, publicApi.origin);
            }
          } catch (_e0) {}
        }

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
        var isWeserv = rHost === 'images.weserv.nl';
        var isAllowedHost = rHost === 'images.weserv.nl';
        if (rHost === 'metravel.by' || rHost === 'cdn.metravel.by' || rHost === 'api.metravel.by') {
          var p = (resolved.pathname || '').toLowerCase();
          var isImagePath = /^\/(travel-image|gallery|uploads|media)\//i.test(p);
          isAllowedHost = !isImagePath;
        }

        var preferredFormat = getPreferredFormat();
        var dpr = typeof explicitDpr === 'number' ? explicitDpr : Math.min(window.devicePixelRatio || 1, 2);
        var actualWidth = width ? Math.round(width * dpr) : width;

        if (!isAllowedHost) {
          // Check if host is private/local - don't proxy private IPs through weserv
          var isPrivateHost =
            rHost === 'localhost' ||
            rHost === '127.0.0.1' ||
            /^10\./.test(rHost) ||
            /^192\.168\./.test(rHost) ||
            /^172\.(1[6-9]|2\d|3[0-1])\./.test(rHost);
          
          if (isPrivateHost) {
            // Return direct URL for private hosts (local dev)
            if (actualWidth) resolved.searchParams.set('w', String(actualWidth));
            if (quality && quality !== 100) resolved.searchParams.set('q', String(quality));
            return resolved.toString();
          }
          
          // Proxy through weserv for non-allowed external hosts
          var OPTIMIZATION_PARAMS = ['w', 'h', 'q', 'f', 'fit', 'auto', 'output', 'blur', 'dpr'];
          for (var pIndex = 0; pIndex < OPTIMIZATION_PARAMS.length; pIndex++) {
            try { resolved.searchParams.delete(OPTIMIZATION_PARAMS[pIndex]); } catch (_e0) {}
          }
          var proxy = new URL('https://images.weserv.nl/');
          var cleanUrl = resolved.toString().replace(/^https?:\/\//i, '');
          proxy.searchParams.set('url', cleanUrl);
          if (actualWidth) proxy.searchParams.set('w', String(actualWidth));
          if (quality) proxy.searchParams.set('q', String(quality));
          proxy.searchParams.set('output', preferredFormat);
          proxy.searchParams.set('fit', 'inside');
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
        resolved.searchParams.set('fit', 'contain');

        return resolved.toString();
      } catch (_e) {
        return null;
      }
    }

    function run(){
      var controller = window.AbortController ? new AbortController() : null;
      var timeout = setTimeout(function(){
        try { if (controller) controller.abort(); } catch (_e) {}
      }, 8000);

      try { window.__metravelTravelPreloadPending = true; } catch (_e) {}

      var preloadPromise = fetch(endpoint, {
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

        // ── SEO: patch meta tags BEFORE React hydration so crawlers see real data ──
        try {
          var siteOrigin = 'https://metravel.by';

          function patchMeta(sel, attr, val) {
            try {
              var el = document.querySelector(sel);
              if (el) { el.setAttribute(attr, val); }
            } catch (_e2) {}
          }

          function upsertJsonLd(id, payload) {
            try {
              if (!payload) return;
              var el = document.getElementById(id);
              if (!el) {
                el = document.createElement('script');
                el.type = 'application/ld+json';
                el.id = id;
                document.head.appendChild(el);
              }
              el.textContent = JSON.stringify(payload);
            } catch (_e3) {}
          }

          // Title
          var travelName = data.name || data.title || '';
          if (travelName) {
            var fullTitle = travelName + ' | MeTravel';
            try { document.title = fullTitle; } catch (_e2) {}
            patchMeta('meta[property="og:title"]', 'content', fullTitle);
            patchMeta('meta[name="twitter:title"]', 'content', fullTitle);
            var titleEl = document.querySelector('title');
            if (titleEl) titleEl.textContent = fullTitle;
          }

          // Description — strip HTML tags
          var rawDesc = data.description || '';
          if (rawDesc) {
            var plainDesc = rawDesc.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
            if (plainDesc) {
              patchMeta('meta[name="description"]', 'content', plainDesc);
              patchMeta('meta[property="og:description"]', 'content', plainDesc);
              patchMeta('meta[name="twitter:description"]', 'content', plainDesc);
            }
          }

          // Image — must be absolute URL for Google/social crawlers
          var ogImgUrl = data.travel_image_thumb_url || '';
          if (!ogImgUrl && data.gallery && data.gallery.length) {
            var gFirst = data.gallery[0];
            ogImgUrl = typeof gFirst === 'string' ? gFirst : (gFirst && gFirst.url) || '';
          }
          if (ogImgUrl) {
            // Make absolute
            if (ogImgUrl.indexOf('http') !== 0) {
              ogImgUrl = siteOrigin + (ogImgUrl.charAt(0) === '/' ? '' : '/') + ogImgUrl;
            }
            // Force HTTPS
            ogImgUrl = ogImgUrl.replace(/^http:\/\//, 'https://');
            patchMeta('meta[property="og:image"]', 'content', ogImgUrl);
            patchMeta('meta[name="twitter:image"]', 'content', ogImgUrl);
          }

          // Canonical & og:url — fix [param] placeholder or create if missing
          var correctPath = '/travels/' + slug;
          var correctUrl = siteOrigin + correctPath;
          var ogUrlEl = document.querySelector('meta[property="og:url"]');
          if (ogUrlEl) { ogUrlEl.setAttribute('content', correctUrl); }
          else { ogUrlEl = document.createElement('meta'); ogUrlEl.setAttribute('property', 'og:url'); ogUrlEl.setAttribute('content', correctUrl); document.head.appendChild(ogUrlEl); }
          // Remove ALL existing canonical links to prevent duplicates (react-helmet-async may inject a second one)
          var canEls = document.querySelectorAll('link[rel="canonical"]');
          for (var ci = canEls.length - 1; ci >= 0; ci--) { canEls[ci].parentNode && canEls[ci].parentNode.removeChild(canEls[ci]); }
          var canEl = document.createElement('link'); canEl.rel = 'canonical'; canEl.href = correctUrl; document.head.appendChild(canEl);
          // Watch for react-helmet-async injecting a duplicate canonical after hydration
          if (typeof MutationObserver !== 'undefined') {
            var canObs = new MutationObserver(function() {
              var allCan = document.querySelectorAll('link[rel="canonical"]');
              if (allCan.length > 1) {
                for (var di = allCan.length - 1; di >= 1; di--) { try { allCan[di].parentNode && allCan[di].parentNode.removeChild(allCan[di]); } catch (_e4) {} }
                if (allCan[0] && allCan[0].getAttribute('href') !== correctUrl) { allCan[0].setAttribute('href', correctUrl); }
              }
            });
            canObs.observe(document.head, { childList: true });
            setTimeout(function() { try { canObs.disconnect(); } catch (_e5) {} }, 5000);
          }

          // og:type for travel pages
          patchMeta('meta[property="og:type"]', 'content', 'article');

          // Breadcrumb structured data for travel pages
          var breadcrumbName = travelName || 'Путешествие';
          upsertJsonLd('travel-breadcrumb-jsonld', {
            "@context": 'https://schema.org',
            "@type": 'BreadcrumbList',
            itemListElement: [
              {
                "@type": 'ListItem',
                position: 1,
                name: 'Главная',
                item: siteOrigin + '/',
              },
              {
                "@type": 'ListItem',
                position: 2,
                name: 'Путешествия',
                item: siteOrigin + '/travelsby',
              },
              {
                "@type": 'ListItem',
                position: 3,
                name: breadcrumbName,
                item: correctUrl,
              },
            ],
          });
        } catch (_e) {}
        // ── end SEO patch ──

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

        var isMobile = (window.innerWidth || 0) < 768;
        var quality = isMobile ? 35 : 45;

        // Match TravelDetailsHero.tsx: lcpWidths = isMobile ? [320, 400] : [480, 720]
        var widths = isMobile ? [320, 400] : [480, 720];

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
        var sizesAttr = isMobile ? '100vw' : '(max-width: 1024px) 92vw, 720px';

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
        try { window.__metravelTravelPreloadPending = false; } catch (_e) {}
        clearTimeout(timeout);
      });

      try { window.__metravelTravelPreloadPromise = preloadPromise; } catch (_e) {}
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

	      {/* Consolidated critical head script: title fallback + theme detection + canonical fix */}
      <script
        dangerouslySetInnerHTML={{
          __html: String.raw`(function(){try{var f='MeTravel';var t=document.querySelector('head title[data-rh="true"]');if(t&&!t.textContent)t.textContent=f;if(!document.title)document.title=f}catch(_){}try{var s=null;try{s=window.localStorage.getItem('theme')}catch(_){}var th=(s==='light'||s==='dark'||s==='auto')?s:'auto';var d=false;if(th==='dark')d=true;else if(th!=='light')d=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches;var r=document.documentElement;r.setAttribute('data-theme',d?'dark':'light');r.style.colorScheme=d?'dark':'light'}catch(_){}window.__EXPO_ROUTER_INSPECTOR=false;try{var p=window.location.pathname||'';if(p.length>1)p=p.replace(/\/+$/,'');var o='https://metravel.by';var correctUrl=o+p;var cl=document.querySelector('link[rel="canonical"]');if(cl){var h=cl.getAttribute('href')||'';if(h!==correctUrl){cl.setAttribute('href',correctUrl)}}else{cl=document.createElement('link');cl.rel='canonical';cl.href=correctUrl;document.head.appendChild(cl)}var ou=document.querySelector('meta[property="og:url"]');if(ou){var oc=ou.getAttribute('content')||'';if(/\[|\%5B/.test(oc)||oc!==correctUrl){ou.setAttribute('content',correctUrl)}}else{ou=document.createElement('meta');ou.setAttribute('property','og:url');ou.setAttribute('content',correctUrl);document.head.appendChild(ou)}try{if(typeof MutationObserver!=='undefined'){var _canUrl=correctUrl;var _canObs=new MutationObserver(function(){var all=document.querySelectorAll('link[rel="canonical"]');if(all.length>1){for(var i=all.length-1;i>=1;i--){try{all[i].parentNode&&all[i].parentNode.removeChild(all[i])}catch(e){}}if(all[0]&&all[0].getAttribute('href')!==_canUrl){all[0].setAttribute('href',_canUrl)}}});_canObs.observe(document.head,{childList:true});setTimeout(function(){try{_canObs.disconnect()}catch(e){}},8000)}}catch(_2){}}catch(_){}})();`,
        }}
      />
      
      {/* Fallback SEO tags for static HTML (Googlebot sees these before React hydration).
          NOTE: description and canonical are NOT duplicated here — React Helmet (data-rh="true")
          injects them per-page at build time. The inline JS above fixes [param] canonical URLs.
          Only tags that React Helmet does NOT inject on every page are kept as fallbacks. */}
      <meta property="og:locale" content="ru_RU" />
      <meta property="og:image" content="https://metravel.by/assets/icons/logo_yellow_512x512.png" />
      <meta name="twitter:site" content="@metravel_by" />

      {!isProduction && <meta name="robots" content="noindex,nofollow" />}

      {/* Schema.org structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'Organization',
                '@id': 'https://metravel.by/#organization',
                name: 'MeTravel',
                url: 'https://metravel.by',
                logo: {
                  '@type': 'ImageObject',
                  url: 'https://metravel.by/assets/icons/logo_yellow.png',
                },
                sameAs: [],
              },
              {
                '@type': 'WebSite',
                '@id': 'https://metravel.by/#website',
                url: 'https://metravel.by',
                name: 'MeTravel',
                description: 'Маршруты, заметки и фото путешествий по Беларуси',
                publisher: { '@id': 'https://metravel.by/#organization' },
                inLanguage: 'ru',
                potentialAction: {
                  '@type': 'SearchAction',
                  target: {
                    '@type': 'EntryPoint',
                    urlTemplate: 'https://metravel.by/search?q={search_term_string}',
                  },
                  'query-input': 'required name=search_term_string',
                },
              },
              {
                '@type': 'Service',
                '@id': 'https://metravel.by/#service',
                name: 'MeTravel',
                serviceType: 'Платформа для поиска и публикации маршрутов путешествий',
                url: 'https://metravel.by',
                provider: { '@id': 'https://metravel.by/#organization' },
                areaServed: 'Worldwide',
                inLanguage: 'ru',
              },
            ],
          }),
        }}
      />

      {/* Resource hints - only the 2 most critical origins (dns-prefetch removed: preconnect implies it).
          images.weserv.nl preconnect deferred to when content images actually load. */}
      <link rel="preconnect" href="https://metravel.by" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://cdn.metravel.by" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://api.metravel.by" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://mc.yandex.ru" />
      <link rel="dns-prefetch" href="https://www.googletagmanager.com" />

      {/* Icon fonts (Feather, etc.) are loaded by expo-font at runtime.
          Avoid hard-coding Metro's dev asset URLs here: they are not stable and can 404. */}
      
      {/* Icons */}
      <link rel="icon" href="/favicon.ico" sizes="any" type="image/x-icon" />
      <link rel="icon" href="/assets/icons/logo_yellow_60x60.png" sizes="60x60" type="image/png" />
      <link rel="apple-touch-icon" href="/assets/icons/logo_yellow_60x60.png" />
      <link rel="manifest" href="/manifest.json" />

      {/* Critical CSS */}
      <style dangerouslySetInnerHTML={{ __html: buildCriticalCSS() }} />
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html:not(.rnw-styles-ready) #root {
              visibility: hidden;
            }
          `,
        }}
      />

      {/* Ensure font-display=swap for dynamically injected icon fonts */}
      <script
        dangerouslySetInnerHTML={{ __html: getFontFaceSwapScript() }}
      />

      <script
        dangerouslySetInnerHTML={{ __html: getEntryPreloadScript() }}
      />
	      <script
	        dangerouslySetInnerHTML={{
	          __html: String.raw`(function(){try{if(typeof document==='undefined')return;var root=document.documentElement;var done=false;function finish(){if(done)return;done=true;root.classList.add('rnw-styles-ready')}var inlineSheet=document.getElementById('react-native-stylesheet');if(inlineSheet){if(typeof requestAnimationFrame==='function'){requestAnimationFrame(function(){requestAnimationFrame(finish)})}else{finish()}}else{setTimeout(finish,500)}}catch(_){}})();`,
	        }}
	      />

      <ScrollViewStyleReset />

      {/* Consolidated non-critical head script: stale chunk recovery + console suppression */}
      <script dangerouslySetInnerHTML={{ __html: getStaleRecoveryInlineScript() }} />
      {false && <script
        dangerouslySetInnerHTML={{ __html: String.raw`(function(){if(typeof window==='undefined')return;var KEY='__metravel_chunk_reload';var COUNT_KEY='__metravel_chunk_reload_count';var COOLDOWN=30000;var MAX_RETRIES=2;var inRecoveryLoop=false;try{inRecoveryLoop=new URL(window.location.href).searchParams.has('_cb')}catch(_){}function isStale(m){return/requiring unknown module|cannot find module|loading chunk|failed to fetch dynamically imported module|loading module.*failed|ChunkLoadError|AsyncRequireError|iterable|spread/i.test(m)}function cbNav(){try{var u=new URL(window.location.href);u.searchParams.set('_cb',String(Date.now()));window.location.replace(u.toString())}catch(_){try{window.location.reload()}catch(_2){}}}function doReload(){try{sessionStorage.setItem(KEY,Date.now().toString());var c=parseInt(sessionStorage.getItem(COUNT_KEY)||'0',10);sessionStorage.setItem(COUNT_KEY,String(c+1))}catch(_){}var p1=('serviceWorker' in navigator)?navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister()}))}):Promise.resolve();var p2=(typeof caches!=='undefined')?caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k.indexOf('metravel-')===0}).map(function(k){return caches.delete(k)}))}):Promise.resolve();Promise.all([p1,p2]).catch(function(){}).then(cbNav)}function handler(e){var m=String((e&&e.message)||(e&&e.reason&&e.reason.message)||'');if(!isStale(m))return;if(inRecoveryLoop){console.warn('[Recovery] Already in recovery loop (_cb present), skipping auto-reload');return}try{var count=parseInt(sessionStorage.getItem(COUNT_KEY)||'0',10);var last=sessionStorage.getItem(KEY);var elapsed=last?(Date.now()-parseInt(last,10)):Infinity;if(count>=MAX_RETRIES){if(elapsed>=COOLDOWN){count=0;sessionStorage.setItem(COUNT_KEY,'0')}else{console.warn('[Recovery] Max retries reached ('+MAX_RETRIES+'), not reloading');return}}if(elapsed<COOLDOWN){console.warn('[Recovery] Stale chunk detected but cooldown active, skipping reload');return}}catch(_){}e.preventDefault&&e.preventDefault();doReload()}window.addEventListener('error',handler);window.addEventListener('unhandledrejection',function(e){var r=e&&e.reason;var m=String((r&&r.message)||r||'');if(!isStale(m))return;handler({message:m,preventDefault:function(){e.preventDefault&&e.preventDefault()}})});try{var last=sessionStorage.getItem(KEY);if(last){var elapsed=Date.now()-parseInt(last,10);if(elapsed>COOLDOWN){sessionStorage.removeItem(KEY);sessionStorage.removeItem(COUNT_KEY)}}}catch(_){}setTimeout(function(){try{sessionStorage.removeItem(KEY);sessionStorage.removeItem(COUNT_KEY);sessionStorage.removeItem('__metravel_sw_stale_reload');sessionStorage.removeItem('__metravel_sw_stale_reload_count');sessionStorage.removeItem('metravel:eb:reload_ts');sessionStorage.removeItem('metravel:eb:reload_count');sessionStorage.removeItem('__metravel_exhausted_autoretry_ts');sessionStorage.removeItem('__metravel_exhausted_autoretry_count')}catch(_){}},10000);var h=window.location&&window.location.hostname;if(h==='metravel.by'||h==='www.metravel.by'||h==='localhost'||h==='127.0.0.1'){var re=/Indexed property setter is not supported|shadow\*.*deprecated|pointerEvents is deprecated|useNativeDriver.*native animated module|useLayoutEffect does nothing on the server/;var oe=console.error,ow=console.warn;console.error=function(){var m=arguments[0];if(typeof m==='string'&&re.test(m))return;oe.apply(console,arguments)};console.warn=function(){var m=arguments[0];if(typeof m==='string'&&re.test(m))return;ow.apply(console,arguments)}}})();` }}
      />}
      {false && <script
        dangerouslySetInnerHTML={{
          __html: String.raw`(function(){if(typeof window==='undefined')return;var inLoop=false;try{inLoop=new URL(window.location.href).searchParams.has('_cb')}catch(_){}if(inLoop)return;var KEY='__metravel_chunk_reload';var COUNT_KEY='__metravel_chunk_reload_count';var EMERGENCY_KEY='__metravel_emergency_recovery_ts';var COOLDOWN=30000;var MAX_RETRIES=2;var EMERGENCY_COOLDOWN=60000;function isStale(m){return/requiring unknown module|cannot find module|loading chunk|failed to fetch dynamically imported module|loading module.*failed|ChunkLoadError|AsyncRequireError|iterable|spread/i.test(m)}function markEmergency(){try{var now=Date.now();var prevRaw=sessionStorage.getItem(EMERGENCY_KEY);var prev=prevRaw?parseInt(prevRaw,10):0;var elapsed=prev?(now-prev):Infinity;if(elapsed<EMERGENCY_COOLDOWN)return false;sessionStorage.setItem(EMERGENCY_KEY,String(now));sessionStorage.removeItem(KEY);sessionStorage.removeItem(COUNT_KEY);sessionStorage.removeItem('__metravel_sw_stale_reload');sessionStorage.removeItem('__metravel_sw_stale_reload_count');sessionStorage.removeItem('metravel:eb:reload_ts');sessionStorage.removeItem('metravel:eb:reload_count')}catch(_){}return true}function hardReload(){var p1=('serviceWorker' in navigator)?navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){return r.unregister()}))}):Promise.resolve();var p2=(typeof caches!=='undefined')?caches.keys().then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k)}))}):Promise.resolve();Promise.all([p1,p2]).catch(function(){}).finally(function(){try{var u=new URL(window.location.href);u.searchParams.set('_cb',String(Date.now()));window.location.replace(u.toString())}catch(_){try{window.location.reload()}catch(_2){}}})}function maybeEmergency(message){var m=String(message||'');if(!isStale(m))return;try{var count=parseInt(sessionStorage.getItem(COUNT_KEY)||'0',10);var lastRaw=sessionStorage.getItem(KEY);var last=lastRaw?parseInt(lastRaw,10):0;var elapsed=last?(Date.now()-last):Infinity;if(count>=MAX_RETRIES&&elapsed<COOLDOWN&&markEmergency())hardReload()}catch(_){}}window.addEventListener('error',function(e){maybeEmergency((e&&e.message)||'')},true);window.addEventListener('unhandledrejection',function(e){var r=e&&e.reason;maybeEmergency((r&&r.message)||r||'')},true)})();`,
        }}
      />}
    </head>

    <body>

    {/* Travel hero preload — moved to body to avoid blocking head parsing on non-travel pages */}
    <script
      dangerouslySetInnerHTML={{ __html: getTravelHeroPreloadScript() }}
    />

    {children}

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
