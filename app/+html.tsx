// app/_document.tsx
import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';

const METRIKA_ID = 62803912;          // твой счётчик Метрики
const GA_ID = 'G-GBT9YNPXKB';         // твой GA4 id

export const getAnalyticsInlineScript = (metrikaId: number, gaId: string) => String.raw`
(function(){
  var host = window.location.hostname;
  var isProdHost = host === 'metravel.by' || host === 'www.metravel.by';
  if (!isProdHost) return;

  var CONSENT_KEY = 'metravel_consent_v1';

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
        if (window.ym) {
          window.ym(${metrikaId}, 'hit', window.location.href, {
            title: document.title,
            referer: document.referrer
          });
        }
        if (window.gtag) {
          window.gtag('event', 'page_view', {
            page_title: document.title,
            page_location: window.location.href
          });
        }
      } catch(_){}
    }

    // Патчим history
    var _ps = history.pushState;
    var _rs = history.replaceState;
    history.pushState = function(){ var r=_ps.apply(this, arguments); setTimeout(trackPage, 10); return r; };
    history.replaceState = function(){ var r=_rs.apply(this, arguments); setTimeout(trackPage, 10); return r; };
    window.addEventListener('popstate', trackPage);

    // Первичный хит после загрузки
    if (document.readyState === 'complete') setTimeout(trackPage, 0);
    else window.addEventListener('load', function(){ setTimeout(trackPage, 0); }, { once:true });

    // ---------- Google Analytics (GA4) ----------
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
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

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-theme="light" suppressHydrationWarning>
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=5" />

      {/* Icons */}
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <link rel="preconnect" href="https://cdn.metravel.by" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://api.metravel.by" crossOrigin="anonymous" />

      {/* Critical CSS */}
      <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />

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
