// app/_document.tsx
import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';

const METRIKA_ID = 62803912;
const GA_ID = 'G-GBT9YNPXKB';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />

      {/* Critical Meta Tags */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://metravel.by" />
      <meta property="og:image" content="https://metravel.by/og-preview.jpg" />
      <meta name="twitter:card" content="summary_large_image" />

      {/* DNS Prefetch */}
      <link rel="dns-prefetch" href="//www.googletagmanager.com" />
      <link rel="dns-prefetch" href="//mc.yandex.ru" />

      {/* Preconnect */}
      <link rel="preconnect" href="https://metravel.by" />
      <link rel="preconnect" href="https://www.googletagmanager.com" />
      <link rel="preconnect" href="https://mc.yandex.ru" />

      {/* Favicon */}
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

      {/* Critical Font Preload */}
      <link
        rel="preload"
        href="/fonts/roboto-var.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />

      {/* LCP Image Preload */}
      <link
        rel="preload"
        href="/images/hero.avif"
        as="image"
        type="image/avif"
        fetchpriority="high"
      />

      {/* Inline Critical CSS */}
      <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />
      <ScrollViewStyleReset />

      {/* Отключение Expo Router Inspector */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__EXPO_ROUTER_INSPECTOR=false;`,
        }}
      />
    </head>

    <body>
    {children}

    {/* LCP Optimization Script */}
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function() {
  function optimizeLCP() {
    const lcpImg = document.querySelector('[data-lcp]');
    if (!lcpImg) return;
    lcpImg.fetchpriority = 'high';
    if (lcpImg.decode && lcpImg.complete) {
      lcpImg.decode().catch(() => {});
    }
  }
  if (document.readyState !== 'loading') optimizeLCP();
  else document.addEventListener('DOMContentLoaded', optimizeLCP);
})();
            `,
      }}
    />

    {/* Analytics Loader - ТОЛЬКО ДЛЯ ПРОДАКШЕНА */}
    {IS_PRODUCTION && (
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function() {
  'use strict';

  var __DEV__ = ${!IS_PRODUCTION};

  // Promise-based script loader (устойчив к дубликатам и query-парам)
  function loadScript(src, attrs) {
    if (!src) return Promise.resolve(null);
    var exists = Array.from(document.scripts).some(function(s){
      try {
        var u1 = new URL(s.src || '', location.origin);
        var u2 = new URL(src, location.origin);
        return u1.origin === u2.origin && u1.pathname === u2.pathname;
      } catch(_) { return false; }
    });
    if (exists) return Promise.resolve(null);

    return new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      if (attrs) {
        if (attrs.defer) s.defer = true;
        if (attrs.crossOrigin) s.crossOrigin = attrs.crossOrigin;
      }
      s.onload = function(){ resolve(s); };
      s.onerror = function(){ reject(new Error('Failed to load ' + src)); };
      (document.head || document.body).appendChild(s);
    });
  }

  // GA: dataLayer/gtag bootstrap + consent defaults (denied -> later granted)
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ dataLayer.push(arguments); };

  // Start with denied (GDPR-friendly). Если есть CMP — он может перевести в granted.
  gtag('consent', 'default', {
    'ad_storage': 'denied',
    'analytics_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'functionality_storage': 'granted',
    'security_storage': 'granted'
  });

  // Yandex Metrika bootstrap через onload (без ранней инициализации)
  // Создадим лёгкий буфер, чтобы hit/события не терялись до загрузки:
  var ymQueue = [];
  function ymBuffer(){ ymQueue.push([].slice.call(arguments)); }
  window.ym = window.ym || ymBuffer;

  // SPA pageview
  function trackPageView() {
    try {
      // Metrika
      window.ym(${METRIKA_ID}, 'hit', window.location.href, {
        title: document.title,
        referer: document.referrer
      });
      // GA
      gtag('event', 'page_view', {
        page_title: document.title,
        page_location: window.location.href
      });
    } catch(e) { /* no-op */ }
  }

  // Патчим History для SPA
  (function(){
    var push = history.pushState;
    var replace = history.replaceState;
    history.pushState = function() {
      var r = push.apply(this, arguments);
      setTimeout(trackPageView, 10);
      return r;
    };
    history.replaceState = function() {
      var r = replace.apply(this, arguments);
      setTimeout(trackPageView, 10);
      return r;
    };
    window.addEventListener('popstate', trackPageView);
  })();

  function initAnalytics() {
    // Загружаем GA
    var gaPromise = loadScript('https://www.googletagmanager.com/gtag/js?id=${GA_ID}', { crossOrigin: 'anonymous' })
      .then(function(){
        gtag('js', new Date());
        gtag('config', '${GA_ID}', {
          page_title: document.title,
          page_location: window.location.href,
          transport_type: 'beacon'
        });
      })
      .catch(function(err){
        if (__DEV__) console.warn('[GA]', err && err.message);
      });

    // Загружаем Metrika и инициализируем ПОСЛЕ загрузки tag.js
    var ymPromise = loadScript('https://mc.yandex.ru/metrika/tag.js', { defer: true })
      .then(function(){
        // Превращаем буфер в реальную ym и прокидываем накопленное
        var realYm = window.ym;
        if (realYm === ymBuffer) {
          (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
          })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
          realYm = window.ym;
        }
        realYm(${METRIKA_ID}, 'init', {
          clickmap: false,
          trackLinks: true,
          accurateTrackBounce: true,
          ecommerce: 'dataLayer',
          defer: true,
          webvisor: true
        });
        if (ymQueue.length) {
          ymQueue.forEach(function(args){ try { realYm.apply(null, args); } catch(_){} });
          ymQueue.length = 0;
        }
      })
      .catch(function(err){
        if (__DEV__) console.warn('[Metrika]', err && err.message);
      });

    // Первый pageview после обеих инициализаций (или через таймаут как fallback)
    Promise.allSettled([gaPromise, ymPromise]).then(function(){ trackPageView(); });
    setTimeout(trackPageView, 2000);
  }

  // Загружаем аналитики по onload/idle, без блокировки согласием.
  function run() {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(initAnalytics, { timeout: 2000 });
    } else {
      setTimeout(initAnalytics, 500);
    }
  }

  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });

  // ==== OPTIONAL: интеграция с CMP (Termly/иное) ====
  // window.addEventListener('cmp_consent_granted', function(){
  //   gtag('consent', 'update', {
  //     'ad_storage': 'granted',
  //     'analytics_storage': 'granted',
  //     'ad_user_data': 'granted',
  //     'ad_personalization': 'granted'
  //   });
  // });

})();
              `,
        }}
      />
    )}

    {/* Noscript fallbacks - ТОЛЬКО ДЛЯ ПРОДАКШЕНА */}
    {IS_PRODUCTION && (
      <noscript>
        <div>
          {/* Yandex Metrika noscript */}
          <img src={`https://mc.yandex.ru/watch/${METRIKA_ID}`} style={{position:'absolute',left:'-9999px'}} alt="" />
          {/* Google Analytics noscript */}
          <iframe src={`https://www.googletagmanager.com/ns.html?id=${GA_ID}`} height="0" width="0" style={{display:'none',visibility:'hidden'}} />
        </div>
      </noscript>
    )}
    </body>
    </html>
  );
}

const criticalCSS = `
/* Critical CSS with optimization */
*,*::before,*::after{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-height:100vh;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased;text-rendering:optimizeSpeed}img,picture,video,canvas,svg{display:block;max-width:100%}img{height:auto}input,button,textarea,select{font:inherit}button{cursor:pointer}[hidden]{display:none !important}

/* Font faces */
@font-face{font-family:'Roboto';src:url('/fonts/roboto-var.woff2') format('woff2-variations');font-weight:100 900;font-display:swap;font-style:normal}

/* LCP image optimization */
img[data-lcp]{content-visibility:auto;contain:layout style paint}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce){html{scroll-behavior:auto}*,*::before,*::after{animation-duration:0.01ms !important;animation-iteration-count:1 !important;transition-duration:0.01ms !important}}

/* Dark mode support */
@media (prefers-color-scheme: dark){body{background:#000;color:#fff}}

/* Focus styles for accessibility */
:focus-visible{outline:2px solid #007bff;outline-offset:2px}
`;
