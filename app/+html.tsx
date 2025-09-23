// app/_document.tsx
import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';

const METRIKA_ID = 62803912;
const GA_ID = 'G-GBT9YNPXKB';

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

    {/* Analytics: грузим только если домен metravel.by */}
    <script
      dangerouslySetInnerHTML={{
        __html: `
if (window.location.hostname === 'metravel.by' || window.location.hostname === 'www.metravel.by') {
  // --- Yandex Metrika ---
  (function(m,e,t,r,i,k,a){
      m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
      m[i].l=1*new Date();
      k=e.createElement(t),a=e.getElementsByTagName(t)[0],
      k.async=1;k.src=r;a.parentNode.insertBefore(k,a)
  })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

  ym(${METRIKA_ID}, "init", {
       clickmap:true,
       trackLinks:true,
       accurateTrackBounce:true,
       webvisor:true
  });

  // --- Google Analytics ---
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_ID}');

  var gaScript = document.createElement('script');
  gaScript.async = true;
  gaScript.src = "https://www.googletagmanager.com/gtag/js?id=${GA_ID}";
  document.head.appendChild(gaScript);
}
            `,
      }}
    />

    {/* Noscript fallback */}
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
/* Critical CSS */
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;min-height:100vh;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased;text-rendering:optimizeSpeed}
img,picture,video,canvas,svg{display:block;max-width:100%}
img{height:auto}
input,button,textarea,select{font:inherit}
button{cursor:pointer}
[hidden]{display:none !important}

@font-face{font-family:'Roboto';src:url('/fonts/roboto-var.woff2') format('woff2-variations');font-weight:100 900;font-display:swap;font-style:normal}

img[data-lcp]{content-visibility:auto;contain:layout style paint}

@media (prefers-reduced-motion: reduce){
  html{scroll-behavior:auto}
  *,*::before,*::after{
    animation-duration:0.01ms !important;
    animation-iteration-count:1 !important;
    transition-duration:0.01ms !important
  }
}

@media (prefers-color-scheme: dark){
  body{background:#000;color:#fff}
}

:focus-visible{outline:2px solid #007bff;outline-offset:2px}
`;
