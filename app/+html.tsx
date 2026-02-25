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
    var path = window.location && window.location.pathname;
    if (!path || path.indexOf('/travels/') !== 0) return;
    if (window.__metravelTravelPreloadScriptLoaded) return;
    window.__metravelTravelPreloadScriptLoaded = true;
    window.__METRAVEL_API_URL__ = ${JSON.stringify(process.env.EXPO_PUBLIC_API_URL || '')};
    var s = document.createElement('script');
    s.src = '/travel-hero-preload.js';
    s.defer = true;
    s.crossOrigin = 'anonymous';
    document.body.appendChild(s);
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
