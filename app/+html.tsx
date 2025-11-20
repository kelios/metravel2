// app/_document.tsx
import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';

const METRIKA_ID = 62803912;          // твой счётчик Метрики
const GA_ID = 'G-GBT9YNPXKB';         // твой GA4 id

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />

      {/* Critical Meta */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://metravel.by" />
      <meta property="og:image" content="https://metravel.by/og-preview.jpg" />
      <meta name="twitter:card" content="summary_large_image" />

      {/* Perf hints - DNS prefetch и preconnect для внешних ресурсов */}
      <link rel="dns-prefetch" href="//www.googletagmanager.com" />
      <link rel="dns-prefetch" href="//mc.yandex.ru" />
      <link rel="dns-prefetch" href="//metravelprod.s3.eu-north-1.amazonaws.com" />
      <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://mc.yandex.ru" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://metravelprod.s3.eu-north-1.amazonaws.com" crossOrigin="anonymous" />

      {/* Icons */}
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

      {/* LCP image - предзагрузка главного изображения */}
      <link
        rel="preload"
        href="/images/hero.avif"
        as="image"
        type="image/avif"
        fetchpriority="high"
      />
      
      {/* Preload критичных ресурсов */}
      <link rel="modulepreload" href="/_expo/static/js/web/index.js" />

      {/* Critical CSS */}
      <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />

      <ScrollViewStyleReset />

      {/* Выключаем Expo Router Inspector */}
      <script
        dangerouslySetInnerHTML={{ __html: `window.__EXPO_ROUTER_INSPECTOR=false;` }}
      />
    </head>

    <body>
    {children}

    {/* LCP decode helper */}
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function () {
  function optimizeLCP() {
    const lcpImg = document.querySelector('[data-lcp]');
    if (!lcpImg) return;
    lcpImg.fetchpriority = 'high';
    if (lcpImg.decode && lcpImg.complete) lcpImg.decode().catch(()=>{});
  }
  if (document.readyState !== 'loading') optimizeLCP();
  else document.addEventListener('DOMContentLoaded', optimizeLCP);
})();
`,
      }}
    />

    {/* ===== Analytics (отложенная загрузка, только на metravel.by) ===== */}
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function(){
  var host = window.location.hostname;
  var isProdHost = host === 'metravel.by' || host === 'www.metravel.by';
  if (!isProdHost) return;
  
  // Отложенная загрузка аналитики после idle
  function loadAnalytics() {

  // ---------- Yandex Metrika (официальный сниппет) ----------
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
      webvisor:true,
      defer:true
  });

  // SPA-хиты для Метрики и GA
  function trackPage(){
    try {
      ym(${METRIKA_ID}, 'hit', window.location.href, {
        title: document.title,
        referer: document.referrer
      });
      if (window.gtag) {
        gtag('event', 'page_view', {
          page_title: document.title,
          page_location: window.location.href
        });
      }
    } catch(_){}
  }

  // Патчим history
  var _ps = history.pushState;
  var _rs = history.replaceState;
  history.pushState = function(){ var r=_ps.apply(this, arguments); setTimeout(trackPage, 10); return r; }
  history.replaceState = function(){ var r=_rs.apply(this, arguments); setTimeout(trackPage, 10); return r; }
  window.addEventListener('popstate', trackPage);

  // Первичный хит после загрузки
  if (document.readyState === 'complete') setTimeout(trackPage, 0);
  else window.addEventListener('load', function(){ setTimeout(trackPage, 0); }, { once:true });

  // ---------- Google Analytics (GA4) ----------
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', '${GA_ID}', { transport_type: 'beacon' });

  var ga = document.createElement('script');
  ga.async = true;
  ga.defer = true;
  ga.src = 'https://www.googletagmanager.com/gtag/js?id=${GA_ID}';
  document.head.appendChild(ga);
  }
  
  // Загружаем аналитику после idle или через 2 секунды
  if (window.requestIdleCallback) {
    window.requestIdleCallback(loadAnalytics, { timeout: 2000 });
  } else {
    setTimeout(loadAnalytics, 2000);
  }
})();
`,
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
html{scroll-behavior:smooth}
body{
  margin:0;
  min-height:100vh;
  font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
  line-height:1.6;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeSpeed;
  color:#1f2937;
  background:linear-gradient(180deg,rgba(246,244,239,0.9) 0%,rgba(249,248,244,0.8) 40%,rgba(255,255,255,0.9) 100%);
}
img,picture,video,canvas,svg{display:block;max-width:100%}
img{height:auto;width:100%}
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
@media (prefers-color-scheme: dark){body{background:#000;color:#fff}}
:focus-visible{outline:2px solid #007bff;outline-offset:2px}
/* Оптимизация для предотвращения CLS на мобильных */
@media (max-width:768px){
  img[data-lcp]{min-height:200px;background:#e9e7df}
}
`;
