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

      {/* DNS Prefetch для критических внешних ресурсов */}
      <link rel="dns-prefetch" href="//www.googletagmanager.com" />
      <link rel="dns-prefetch" href="//mc.yandex.ru" />

      {/* Preconnect для ключевых доменов */}
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
    
    // Устанавливаем высокий приоритет загрузки
    lcpImg.fetchpriority = 'high';
    
    // Предзагрузка decode для изображений
    if (lcpImg.decode && lcpImg.complete) {
      lcpImg.decode().catch(() => {});
    }
  }
  
  if (document.readyState !== 'loading') {
    optimizeLCP();
  } else {
    document.addEventListener('DOMContentLoaded', optimizeLCP);
  }
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
  
  // Проверка что мы на проде (дополнительная страховка)
  const isProduction = ${IS_PRODUCTION};
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname.startsWith('192.168.') ||
                      window.location.hostname.startsWith('10.0.');
  
  if (!isProduction || isLocalhost) {
    // Логируем только в development для отладки
    if (!isProduction) {
      console.log('Analytics disabled: development mode');
    }
    return;
  }
  
  // Performance-aware utility functions
  const utils = {
    isIdle: () => 'requestIdleCallback' in window,
    runOnIdle: (fn, timeout = 2000) => {
      if (utils.isIdle()) {
        requestIdleCallback(fn, { timeout });
      } else {
        setTimeout(fn, 500);
      }
    },
    
    hasConsent: () => {
      try {
        const ls = localStorage.getItem('cookie_consent');
        const ck = document.cookie;
        return !!ls || /consent=opt/i.test(ck);
      } catch {
        return false;
      }
    },
    
    shouldBlock: () => {
      try {
        return navigator.globalPrivacyControl || 
               navigator.doNotTrack === '1' ||
               window.doNotTrack === '1';
      } catch {
        return false;
      }
    },
    
    loadScript: (src, options = {}) => {
      if (!src || document.querySelector('script[src*="' + src.split('/')[2] + '"]')) {
        return null;
      }
      
      const script = document.createElement('script');
      script.src = src;
      script.async = options.async || true;
      script.defer = options.defer || false;
      if (options.crossOrigin) script.crossOrigin = options.crossOrigin;
      
      (document.head || document.body).appendChild(script);
      return script;
    }
  };

  // Google Analytics Configuration
  window.dataLayer = window.dataLayer || [];
  window.gtag = function() { dataLayer.push(arguments); };
  gtag('js', new Date());

  // Yandex Metrika Configuration
  window.ym = window.ym || function() { (ym.a = ym.a || []).push(arguments); };
  ym.l = +new Date();

  // SPA Navigation Tracking
  const trackPageView = () => {
    try {
      ym(${METRIKA_ID}, 'hit', window.location.href, {
        title: document.title,
        referer: document.referrer
      });
      gtag('config', '${GA_ID}', {
        page_title: document.title,
        page_location: window.location.href,
        transport_type: 'beacon'
      });
    } catch (e) {
      // Silent fail in production
    }
  };

  // History patching for SPA
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    const result = originalPushState.apply(this, args);
    setTimeout(trackPageView, 10);
    return result;
  };
  
  history.replaceState = function(...args) {
    const result = originalReplaceState.apply(this, args);
    setTimeout(trackPageView, 10);
    return result;
  };
  
  window.addEventListener('popstate', trackPageView);

  // Load analytics after page is interactive
  const loadAnalytics = () => {
    if (utils.shouldBlock()) {
      return; // Respect privacy controls
    }

    if (!utils.hasConsent()) {
      // Load cookie consent manager
      utils.loadScript('https://app.termly.io/resource-blocker/031ae6f7-458d-4853-98e5-098ad6cee542?autoBlock=on', {
        defer: true
      });
      return;
    }

    // Load Google Analytics
    utils.loadScript('https://www.googletagmanager.com/gtag/js?id=${GA_ID}', {
      async: true,
      crossOrigin: 'anonymous'
    });

    // Load Yandex Metrika
    utils.loadScript('https://mc.yandex.ru/metrika/tag.js', {
      async: true,
      defer: true
    });

    // Initialize Metrika
    ym(${METRIKA_ID}, 'init', {
      clickmap: false,
      trackLinks: true,
      accurateTrackBounce: true,
      ecommerce: 'dataLayer',
      defer: true,
      webvisor: true
    });

    // Initial page view
    trackPageView();
  };

  // Start loading analytics on idle
  if (document.readyState === 'complete') {
    utils.runOnIdle(loadAnalytics);
  } else {
    window.addEventListener('load', () => {
      utils.runOnIdle(loadAnalytics);
    }, { once: true });
  }
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