// app/_document.tsx
import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';

const METRIKA_ID = process.env.EXPO_PUBLIC_METRIKA_ID ? parseInt(process.env.EXPO_PUBLIC_METRIKA_ID, 10) : 62803912;
const GA_ID = process.env.EXPO_PUBLIC_GOOGLE_GA4 || 'G-GBT9YNPXKB';

export const getAnalyticsInlineScript = (metrikaId: number, gaId: string) => String.raw`
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
    var isProdHost = host === 'metravel.by' || host === 'www.metravel.by';
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

    function buildOptimizedUrl(rawUrl, width, quality) {
      try {
        var resolved = new URL(rawUrl, window.location.origin);
        var host = resolved.hostname || '';
        var allowed =
          host === 'metravel.by' ||
          host === 'cdn.metravel.by' ||
          host === 'api.metravel.by';
        if (!allowed) return null;
        if (width) resolved.searchParams.set('w', String(Math.round(width)));
        if (quality) resolved.searchParams.set('q', String(quality));
        resolved.searchParams.set('f', 'auto');
        resolved.searchParams.set('fit', 'contain');
        return resolved.toString();
      } catch (_e) {
        return null;
      }
    }

    // Defer API fetch to idle time and skip on constrained networks to avoid hurting LCP/TBT.
    var conn = (navigator && (navigator.connection || navigator.mozConnection || navigator.webkitConnection)) || null;
    var effectiveType = conn && conn.effectiveType ? String(conn.effectiveType) : '';
    var saveData = conn && conn.saveData ? true : false;
    var isConstrained = saveData || effectiveType.indexOf('2g') !== -1 || effectiveType.indexOf('slow-2g') !== -1;
    if (isConstrained) return;

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
        var gallery = data.gallery;
        if (!gallery || !gallery.length) return;
        var first = gallery[0];
        var url = typeof first === 'string' ? first : first && first.url;
        if (!url || typeof url !== 'string') return;

        var viewport = Math.max(320, Math.min(window.innerWidth || 480, 960));
        var isMobile = (window.innerWidth || 0) <= 540;
        var targetWidth = isMobile ? Math.min(viewport, 480) : Math.min(viewport, 960);
        var quality = isMobile ? 55 : 60;
        var highWidth = Math.min(isMobile ? 720 : 1280, Math.round(targetWidth * 2));
        var optimizedHref = buildOptimizedUrl(url, targetWidth, quality);
        if (!optimizedHref) return;
        var optimizedHrefHigh = highWidth !== targetWidth
          ? buildOptimizedUrl(url, highWidth, quality)
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
        if (optimizedHrefHigh) {
          link.setAttribute('imagesrcset', optimizedHref + ' ' + Math.round(targetWidth) + 'w, ' + optimizedHrefHigh + ' ' + Math.round(highWidth) + 'w');
          link.setAttribute('imagesizes', '100vw');
        }
        link.fetchPriority = 'high';
        link.setAttribute('fetchpriority', 'high');
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }).catch(function(){}).finally(function(){
        clearTimeout(timeout);
      });
    }

    if (window.requestIdleCallback) {
      window.requestIdleCallback(run, { timeout: 2500 });
    } else {
      setTimeout(run, 1800);
    }
  } catch (_e) {}
})();
`;

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=5" />

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

      {/* Icons */}
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <link rel="preconnect" href="https://cdn.metravel.by" crossOrigin="anonymous" />

      {/* Critical CSS */}
      <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />

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

    {/* Noscript (не условный — это нормально) */}
    <noscript>
      <div>
        <img
          src={`https://mc.yandex.ru/watch/${METRIKA_ID}`}
          style={{ position: 'absolute', left: '-9999px' }}
          alt=""
        />
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${GA_ID}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
        />
      </div>
    </noscript>
    </body>
    </html>
  );
}

const criticalCSS = `
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;height:100%;scrollbar-gutter:stable}
body{
  margin:0;
  min-height:100vh;
  min-height:-webkit-fill-available;
  font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
  font-display:swap;
  line-height:1.6;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeSpeed;
  color:var(--color-text);
  background:linear-gradient(180deg,var(--color-background) 0%,var(--color-backgroundSecondary) 40%,var(--color-surface) 100%);
  padding-bottom:env(safe-area-inset-bottom);
  overflow-y:scroll;
}
img,picture,video,canvas{display:block;max-width:100%}
 /* Prevent react-native-web ActivityIndicator SVG from stretching to full container size */
 svg[viewBox="0 0 32 32"][width="100%"][height="100%"]{width:32px;height:32px;max-width:none;max-height:none;display:inline-block}
img{height:auto;width:100%;object-fit:cover}
input,button,textarea,select{font:inherit}
button{cursor:pointer}
[hidden]{display:none !important}
img[data-lcp]{content-visibility:auto;contain:layout style paint}
/* Предотвращение CLS - фиксированные размеры для изображений */
img[width][height]{aspect-ratio:attr(width)/attr(height)}
/* Оптимизация для LCP */
img[fetchpriority="high"]{content-visibility:auto;will-change:auto}
/* Предотвращение CLS для контейнеров с фиксированной высотой */
[style*="minHeight"]{contain:layout style paint}
/* Оптимизация загрузки */
[loading="lazy"]{content-visibility:auto}
/* Критический CSS для страницы travels - предотвращение layout shift */
@media (prefers-reduced-motion: reduce){
  html{scroll-behavior:auto}
  *,*::before,*::after{animation-duration:0.01ms !important;animation-iteration-count:1 !important;transition-duration:0.01ms !important}
}
html[data-theme="dark"]{color-scheme:dark}
html[data-theme="light"]{color-scheme:light}
:focus-visible{outline:2px solid var(--color-focus);outline-offset:2px}
/* ✅ ИСПРАВЛЕНИЕ: Оптимизация для мобильных устройств (320-430px) */
@media (max-width:768px){
  html{height:100%;height:-webkit-fill-available}
  body{min-height:100vh;min-height:-webkit-fill-available;padding-bottom:calc(env(safe-area-inset-bottom) + 80px)}
  img[data-lcp]{min-height:200px;background:var(--color-backgroundTertiary)}
  /* Предотвращаем обрезку карточек */
  [data-card]{margin-bottom:16px;width:100%;max-width:100%}
  [data-card] img{height:200px;object-fit:cover;width:100%}
}
/* ✅ ИСПРАВЛЕНИЕ: Поддержка iOS Safari safe area */
@supports (padding-bottom: env(safe-area-inset-bottom)){
  body{padding-bottom:env(safe-area-inset-bottom)}
}
[data-testid="footer-dock-row"],
[data-testid="footer-desktop-bar"]{display:flex !important;flex-direction:row !important;flex-wrap:nowrap !important;align-items:center !important}
[data-testid="footer-dock-row"]{justify-content:center !important}
[data-testid="footer-desktop-bar"]{justify-content:space-between !important}
[data-testid^="footer-item-"]{display:inline-flex !important;flex-direction:column !important;align-items:center !important;justify-content:center !important;flex:0 0 auto !important}
`;
