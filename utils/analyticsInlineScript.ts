/**
 * Generates the inline analytics script for Yandex Metrika and Google Analytics.
 * Extracted from app/+html.tsx so that Jest tests can import it without
 * pulling in the full +html.tsx file (which contains String.raw templates
 * that confuse babel's TypeScript parser).
 */
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
    // We send page_view manually in trackPage() for SPA navigation,
    // so disable GA automatic page_view to avoid duplicates.
    window.gtag('config', GA_ID, { transport_type: 'beacon', send_page_view: false });

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
