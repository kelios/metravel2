// app/_document.tsx
import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';

const METRIKA_ID = process.env.EXPO_PUBLIC_METRIKA_ID ? parseInt(process.env.EXPO_PUBLIC_METRIKA_ID, 10) : 0;
const GA_ID = process.env.EXPO_PUBLIC_GOOGLE_GA4 || '';

if (!METRIKA_ID && typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.error('[Analytics] EXPO_PUBLIC_METRIKA_ID is not set. Analytics will be disabled.');
}
if (!GA_ID && typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.error('[Analytics] EXPO_PUBLIC_GOOGLE_GA4 is not set. Analytics will be disabled.');
}

export const getAnalyticsInlineScript = (metrikaId: number, gaId: string) => {
  if (!metrikaId || !gaId) {
    return '// Analytics disabled: missing EXPO_PUBLIC_METRIKA_ID or EXPO_PUBLIC_GOOGLE_GA4';
  }
  return String.raw`
(function(){
  var host = window.location.hostname;
  var isProdHost = host === 'metravel.by' || host === 'www.metravel.by';
  if (!isProdHost) return;

  var CONSENT_KEY = 'metravel_consent_v1';
  window.__metravelMetrikaId = ${metrikaId};
  window.__metravelGaId = '${gaId}';

  function hasAnalyticsConsent(){
    try {
      var raw = window.localStorage.getItem(CONSENT_KEY);
      if (!raw) return false;
      var data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return false;
      if (!data.necessary) return false;
      return !!data.analytics;
    } catch (e) {
      return false;
    }
  }

  // Отложенная загрузка аналитики после idle
  function loadAnalytics() {
    if (window.__metravelAnalyticsLoaded) return;
    window.__metravelAnalyticsLoaded = true;

    // ---------- Yandex Metrika (официальный сниппет) ----------
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
        window.ym(${metrikaId}, "init", {
            clickmap:true,
            trackLinks:true,
            accurateTrackBounce:true,
            webvisor:true,
            defer:true
        });
    }

    // SPA-хиты для Метрики и GA
    function trackPage(){
      try {
        var url = window.location.href;
        if (window.__metravelLastTrackedUrl === url) return;
        window.__metravelLastTrackedUrl = url;
        if (window.ym) {
          window.ym(${metrikaId}, 'hit', url, {
            title: document.title,
            referer: document.referrer
          });
        }
        if (window.gtag) {
          window.gtag('event', 'page_view', {
            page_title: document.title,
            page_location: url
          });
        }
      } catch(_){}
    }

    // Патчим history
    var _ps = window.history && window.history.pushState;
    var _rs = window.history && window.history.replaceState;
    if (_ps && _rs) {
      window.history.pushState = function(){ var r=_ps.apply(this, arguments); trackPage(); return r; };
      window.history.replaceState = function(){ var r=_rs.apply(this, arguments); trackPage(); return r; };
    }
    window.addEventListener('popstate', trackPage);

    // Первичный хит после загрузки
    if (document.readyState === 'complete') setTimeout(trackPage, 0);
    else window.addEventListener('load', function(){ setTimeout(trackPage, 0); }, { once:true });

    // ---------- Google Analytics (GA4) ----------
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){
      window.dataLayer.push(Array.prototype.slice.call(arguments));
    };
    window.gtag('js', new Date());
    window.gtag('config', '${gaId}', { transport_type: 'beacon' });

    var ga = document.createElement('script');
    ga.async = true;
    ga.defer = true;
    ga.src = 'https://www.googletagmanager.com/gtag/js?id=${gaId}';
    document.head.appendChild(ga);
  }

  // Делаем функцию доступной глобально для React-баннера
  window.metravelLoadAnalytics = loadAnalytics;

  // Если согласие уже дано ранее, автоматически загружаем аналитику
  if (hasAnalyticsConsent()) {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(loadAnalytics, { timeout: 2000 });
    } else {
      setTimeout(loadAnalytics, 2000);
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
    var entrySrc = '';
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      var src = s && s.getAttribute ? s.getAttribute('src') : '';
      if (!src) continue;
      if (src.indexOf('/_expo/static/js/web/entry-') !== -1 && src.indexOf('.js') !== -1) {
        entrySrc = src;
        try {
          if (!s.getAttribute('fetchpriority')) {
            s.setAttribute('fetchpriority', 'high');
          }
          if (typeof s.fetchPriority !== 'undefined') {
            s.fetchPriority = 'high';
          }
        } catch (_e) {}
        break;
      }
    }
    if (!entrySrc) return;
    if (document.querySelector('link[rel="preload"][as="script"][href="' + entrySrc + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = entrySrc;
    link.setAttribute('fetchpriority', 'high');
    try { link.fetchPriority = 'high'; } catch (_e) {}
    document.head.appendChild(link);
  } catch (_e) {}
})();
`;

const getFontFaceSwapScript = () => String.raw`
(function(){
  try {
    if (!window.CSSStyleSheet) return;
    var proto = window.CSSStyleSheet.prototype;
    if (!proto || proto.__metravelFontSwapPatched) return;
    var originalInsertRule = proto.insertRule;
    if (typeof originalInsertRule !== 'function') return;
    proto.insertRule = function(rule, index) {
      try {
        if (typeof rule === 'string' && rule.indexOf('@font-face') === 0 && rule.indexOf('font-display') === -1) {
          rule = rule.replace(/\}\s*$/, ';font-display:swap;}');
        }
      } catch (_e) {}
      return originalInsertRule.call(this, rule, index);
    };
    proto.__metravelFontSwapPatched = true;
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

    function buildOptimizedUrl(rawUrl, width, quality, updatedAt, id) {
      try {
        var resolved = new URL(rawUrl, window.location.origin);
        
        // Add version param to match React component logic
        if (updatedAt) {
          var ts = Date.parse(updatedAt);
          if (!isNaN(ts)) resolved.searchParams.set('v', String(ts));
        } else if (id) {
          resolved.searchParams.set('v', String(id));
        }

        var host = (resolved.hostname || '').toLowerCase();
        // Force proxy for metravel domains to ensure resizing
        var allowed = host === 'images.weserv.nl';
        
        if (allowed) {
          if (width) resolved.searchParams.set('w', String(Math.round(width)));
          if (quality) resolved.searchParams.set('q', String(quality));
          resolved.searchParams.set('f', 'webp');
          resolved.searchParams.set('fit', 'cover');
          return resolved.toString();
        } else {
          // Fallback to images.weserv.nl for external images
          var proxy = new URL('https://images.weserv.nl/');
          var cleanUrl = resolved.toString().replace(/^https?:\/\//i, '');
          proxy.searchParams.set('url', cleanUrl);
          if (width) proxy.searchParams.set('w', String(Math.round(width)));
          if (quality) proxy.searchParams.set('q', String(quality));
          proxy.searchParams.set('output', 'webp');
          proxy.searchParams.set('fit', 'cover');
          return proxy.toString();
        }
      } catch (_e) {
        return null;
      }
    }

    // Defer API fetch to idle time and skip on constrained networks to avoid hurting LCP/TBT.
    var conn = (navigator && (navigator.connection || navigator.mozConnection || navigator.webkitConnection)) || null;
    var effectiveType = conn && conn.effectiveType ? String(conn.effectiveType) : '';
    // REMOVED: Network constraint check that was blocking preload on Lighthouse throttled networks.
    // We want to prioritize the hero image even on slow networks for LCP.
    
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

        var viewport = Math.max(320, Math.min(window.innerWidth || 400, 860));
        var isMobile = (window.innerWidth || 0) <= 540;
        var targetWidth = isMobile ? Math.min(viewport, 400) : Math.min(viewport, 860);
        var quality = isMobile ? 45 : 50;
        // Desktop max width in component is 860, so we shouldn't preload 1080
        var highWidth = isMobile ? 400 : 860; 
        
        var optimizedHref = buildOptimizedUrl(url, targetWidth, quality, updatedAt, id);
        if (!optimizedHref) return;
        var optimizedHrefHigh = highWidth !== targetWidth
          ? buildOptimizedUrl(url, highWidth, quality, updatedAt, id)
          : null;

        try {
          var resolved = new URL(optimizedHref, window.location.origin);
          var origin = resolved.origin;
          if (origin && !document.querySelector('link[rel="preconnect"][href="' + origin + '"]')) {
            var pre = document.createElement('link');
            pre.rel = 'preconnect';
            pre.href = origin;
            pre.crossOrigin = 'anonymous';
            document.head.appendChild(pre);
          }
        } catch (_e) {}

        if (document.querySelector('link[rel="preload"][href="' + optimizedHref + '"]')) return;
        var link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = optimizedHref;
        
        // Exact match with TravelDetailsHero.tsx sizes
        var sizesAttr = isMobile ? '100vw' : '(max-width: 1024px) 92vw, 860px';
        
        if (optimizedHrefHigh) {
          link.setAttribute('imagesrcset', optimizedHref + ' ' + Math.round(targetWidth) + 'w, ' + optimizedHrefHigh + ' ' + Math.round(highWidth) + 'w');
          link.setAttribute('imagesizes', sizesAttr);
        }
        try {
          link.fetchPriority = 'high';
          link.setAttribute('fetchpriority', 'high');
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
      <meta name="theme-color" content="#1a1a1a" media="(prefers-color-scheme: dark)" />
      <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
      <meta name="color-scheme" content="light dark" />
      
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
      <link rel="preconnect" href="https://cdn.metravel.by" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://api.metravel.by" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://images.weserv.nl" crossOrigin="anonymous" />
      
      {/* Icons */}
      <link rel="icon" href="/favicon.ico" sizes="32x32" />
      <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <link rel="manifest" href="/manifest.json" />

      {process.env.NODE_ENV === 'production' ? (
        <link
          rel="preload"
          href="/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
      ) : null}

      {/* Critical CSS */}
      <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />

      {process.env.NODE_ENV === 'production' ? (
        <style
          dangerouslySetInnerHTML={{
            __html: `@font-face{font-family:feather;src:url(/assets/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf) format('truetype');font-weight:normal;font-style:normal;font-display:optional;}`,
          }}
        />
      ) : null}

      {/* Ensure font-display=swap for dynamically injected icon fonts */}
      <script
        dangerouslySetInnerHTML={{ __html: getFontFaceSwapScript() }}
      />

      <script
        dangerouslySetInnerHTML={{ __html: getEntryPreloadScript() }}
      />

      {/* Early travel hero preload to improve LCP on /travels/* */}
      <script
        dangerouslySetInnerHTML={{ __html: getTravelHeroPreloadScript() }}
      />

      <ScrollViewStyleReset />

      {/* Выключаем Expo Router Inspector */}
      <script
        dangerouslySetInnerHTML={{ __html: `window.__EXPO_ROUTER_INSPECTOR=false;` }}
      />

      {/* Suppress known react-native-svg console errors */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            '(function() {\n'
            + "  if (typeof window !== 'undefined') {\n"
            + "    var host = window.location && window.location.hostname;\n"
            + "    var isProdHost = host === 'metravel.by' || host === 'www.metravel.by';\n"
            + "    var isLocalHost = host === 'localhost' || host === '127.0.0.1';\n"
            + "    if (!isProdHost && !isLocalHost) return;\n"
            + '    const shouldSuppress = (args) => {\n'
            + '      const msg = args && args[0];\n'
            + "      if (!msg || typeof msg !== 'string') return false;\n"
            + "      if (msg.includes('CSSStyleDeclaration') && msg.includes('Indexed property setter is not supported')) {\n"
            + '        return true;\n'
            + '      }\n'
            + '      if (\n'
            + '        msg.includes("\\"shadow*\\" style props are deprecated") ||\n'
            + '        msg.includes("\\"textShadow*\\" style props are deprecated") ||\n'
            + "        msg.includes('props.pointerEvents is deprecated')\n"
            + '      ) {\n'
            + '        return true;\n'
            + '      }\n'
            + "      if (msg.includes('Animated:') && msg.includes('useNativeDriver') && msg.includes('native animated module is missing')) {\n"
            + '        return true;\n'
            + '      }\n'
            + '      return false;\n'
            + '    };\n'
            + '    const originalError = console.error;\n'
            + '    console.error = function(...args) {\n'
            + '      if (shouldSuppress(args)) return;\n'
            + '      originalError.apply(console, args);\n'
            + '    };\n'
            + '    const originalWarn = console.warn;\n'
            + '    console.warn = function(...args) {\n'
            + '      if (shouldSuppress(args)) return;\n'
            + '      originalWarn.apply(console, args);\n'
            + '    };\n'
            + '  }\n'
            + '})();\n',
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
      if (!lcpImg.getAttribute('fetchpriority')) {
        lcpImg.setAttribute('fetchpriority', 'high');
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
  color:var(--color-text,#1a1a1a);
  background:linear-gradient(180deg,var(--color-background,#fff) 0%,var(--color-backgroundSecondary,#f5f5f5) 40%,var(--color-surface,#fafafa) 100%);
  padding-bottom:env(safe-area-inset-bottom);
  overflow-y:scroll;
  overflow-x:hidden;
}
img,picture,video,canvas,svg{display:block;max-width:100%;height:auto}
svg[viewBox="0 0 32 32"][width="100%"][height="100%"]{width:32px;height:32px;max-width:none;max-height:none;display:inline-block}
img{width:100%;object-fit:cover;font-style:italic;vertical-align:middle}
input,button,textarea,select{font:inherit;color:inherit}
button{cursor:pointer;background:transparent;border:0}
button:focus-visible,a:focus-visible{outline:2px solid var(--color-focus,#0066cc);outline-offset:2px}
a{color:inherit;text-decoration:none}
[hidden]{display:none !important}
img[data-lcp]{content-visibility:auto;contain:layout style paint;min-height:300px;background:var(--color-backgroundSecondary,#f5f5f5);aspect-ratio:16/9}
img[width][height]{aspect-ratio:attr(width)/attr(height)}
img[fetchpriority="high"]{content-visibility:auto;will-change:transform}
img[loading="lazy"]{content-visibility:auto}
[data-testid="travel-details-hero"]{min-height:300px;contain:layout style paint;background:var(--color-backgroundSecondary,#f5f5f5)}
[data-testid="travel-details-hero"] img{aspect-ratio:16/9;width:100%;max-width:860px;object-fit:cover}
[data-testid="home-hero-stack"]{min-height:400px;contain:layout style paint}
[data-testid="home-hero-stack"] img{width:320px;height:400px;aspect-ratio:4/5;object-fit:cover}
[data-testid*="travel-gallery"] img{aspect-ratio:16/9;contain:layout style paint;object-fit:cover}
[style*="minHeight"]{contain:layout style paint}
[role="img"]:not([aria-label]){font-size:0}
@media (prefers-reduced-motion: reduce){
  html{scroll-behavior:auto}
  *,*::before,*::after{animation-duration:0.01ms !important;animation-iteration-count:1 !important;transition-duration:0.01ms !important;scroll-behavior:auto !important}
}
html[data-theme="dark"]{color-scheme:dark;--color-text:#fff;--color-background:#1a1a1a;--color-backgroundSecondary:#2a2a2a;--color-surface:#333;--color-focus:#66b3ff}
html[data-theme="light"]{color-scheme:light;--color-text:#1a1a1a;--color-background:#fff;--color-backgroundSecondary:#f5f5f5;--color-surface:#fafafa;--color-focus:#0066cc}
:focus-visible{outline:2px solid var(--color-focus,#0066cc);outline-offset:2px}
::selection{background-color:rgba(0,102,204,0.3);color:inherit}
@media (max-width:768px){
  html{height:100%;height:-webkit-fill-available;font-size:100%}
  body{min-height:100vh;min-height:-webkit-fill-available;padding-bottom:calc(env(safe-area-inset-bottom) + 80px)}
  img[data-lcp]{min-height:240px;aspect-ratio:16/9;background:var(--color-backgroundTertiary,#f0f0f0)}
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
`;
