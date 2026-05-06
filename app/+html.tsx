// app/_document.tsx
import { ScrollViewStyleReset } from 'expo-router/html';
import React from 'react';
import { DESIGN_COLORS } from '@/constants/designSystem';
import { getAnalyticsInlineScript } from '@/utils/analyticsInlineScript';
import { buildCriticalCSS } from '@/utils/criticalCSSBuilder';
import { getRootVisibilityGateCss, getTravelRouteClassScript } from '@/utils/htmlShell';
export { getAnalyticsInlineScript };

const METRIKA_ID = process.env.EXPO_PUBLIC_METRIKA_ID ? parseInt(process.env.EXPO_PUBLIC_METRIKA_ID, 10) : 0;
const GA_ID = process.env.EXPO_PUBLIC_GOOGLE_GA4 || '';
const SITE_BRAND = 'Metravel';
const HOME_TITLE = 'Идеи поездок на выходные и книга путешествий | Metravel';
const HOME_DESCRIPTION = 'Подбирайте маршруты по расстоянию и формату отдыха, сохраняйте поездки с фото и заметками и собирайте личную книгу путешествий в PDF.';
const DEFAULT_DESCRIPTION = 'Маршруты, заметки и фото путешествий по Беларуси и не только. Ищите идеи поездок, сохраняйте места и делитесь своими маршрутами в Metravel.';
const SEARCH_TITLE = 'Поиск маршрутов и идей путешествий по Беларуси | Metravel';
const SEARCH_DESCRIPTION = 'Ищите путешествия по странам, категориям и сложности. Фильтруйте маршруты и сохраняйте лучшие идеи в свою книгу путешествий.';
const MAP_TITLE = 'Карта маршрутов, мест и идей для поездок | Metravel';
const MAP_DESCRIPTION = 'Открывайте маршруты и интересные точки на интерактивной карте Metravel. Смотрите места поблизости и планируйте следующую поездку.';
const ARTICLES_TITLE = 'Статьи о путешествиях, маршрутах и советах в дорогу | Metravel';
const ARTICLES_DESCRIPTION = 'Читайте статьи Metravel о поездках, маршрутах, интересных местах и полезных советах для путешествий по Беларуси и не только.';
const ABOUT_TITLE = 'О проекте MeTravel — сообщество путешественников | Metravel';
const ABOUT_DESCRIPTION = 'Проект MeTravel — сообщество путешественников по Беларуси и не только. Делитесь маршрутами, пишите статьи, сохраняйте впечатления и вдохновляйтесь идеями.';
const CONTACT_TITLE = 'Контакты и обратная связь | Metravel';
const CONTACT_DESCRIPTION = 'Свяжитесь с командой Metravel: вопросы, предложения, идеи партнерства и обратная связь по маршрутам, статьям и сервису.';
const TRAVELSBY_TITLE = 'Маршруты по Беларуси, идеи поездок и маршрутов | Metravel';
const TRAVELSBY_DESCRIPTION = 'Подборка маршрутов и мест по Беларуси: идеи для выходных и больших поездок. Фото, точки на карте и советы путешественников.';
const QUESTS_TITLE = 'Городские квесты и маршруты с заданиями | Metravel';
const QUESTS_DESCRIPTION = 'Проходите городские квесты Metravel: маршруты с заданиями, точками на карте и идеями для прогулок и поездок.';
const ROULETTE_TITLE = 'Рулетка идей для спонтанной поездки | Metravel';
const ROULETTE_DESCRIPTION = 'Откройте случайный маршрут для спонтанного выезда и найдите новую идею путешествия на Metravel.';
const ARTICLE_FALLBACK_DESCRIPTION = 'Страница статьи в Metravel. Открывайте материалы о путешествиях, маршрутах и полезных находках.';

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
    if (${JSON.stringify(process.env.NODE_ENV)} !== 'production') return;
    var path = window.location && window.location.pathname;
    if (!path || path.indexOf('/travels/') !== 0) return;
    if (window.__metravelTravelPreload && window.__metravelTravelPreload.data) return;
    if (window.__metravelTravelPreloadScriptLoaded) return;
    window.__metravelTravelPreloadScriptLoaded = true;
    window.__METRAVEL_API_URL__ = ${JSON.stringify(process.env.EXPO_PUBLIC_API_URL || '')};
    var s = document.createElement('script');
    s.src = '/travel-hero-preload.js';
    s.async = true;
    try {
      s.fetchPriority = 'high';
      s.setAttribute('fetchPriority', 'high');
    } catch (_e) {}
    s.crossOrigin = 'anonymous';
    (document.head || document.body).appendChild(s);
  } catch (_e) {}
})();
`;

const getLegacyParamRedirectScript = () => String.raw`
(function(){
  try {
    if (typeof window === 'undefined') return;
    var path = String(window.location && window.location.pathname || '');
    if (path !== '/' && path !== '/index') return;

    var search = String(window.location && window.location.search || '');
    if (!search) return;
    var sp = new URLSearchParams(search);
    var raw = String(sp.get('param') || '').trim();
    if (!raw) return;

    var value = raw;
    try { value = decodeURIComponent(raw); } catch (_e) {}
    if (!value) return;
    // Guard against malformed values: allow only simple slug/id tokens.
    if (/[/?#\\]/.test(value)) return;

    var target = '/travels/' + encodeURIComponent(value);
    if (target === path) return;
    window.location.replace(target);
  } catch (_e) {}
})();
`;

const getCriticalHeadScript = () => String.raw`(function(){try{function decode(v){try{return decodeURIComponent(v)}catch(_){return v}}function normalizePath(path){var raw=String(path||'/').trim();if(!raw)return'/';var cleaned=raw.split('#')[0].split('?')[0]||'/';if(cleaned.length>1)cleaned=cleaned.replace(/\/+$/,'');return cleaned||'/'}function getLastSegment(path){var parts=normalizePath(path).split('/').filter(Boolean);return parts.length?parts[parts.length-1]:''}function humanizeSegment(value){var text=String(value||'').trim();if(!text)return'';text=decode(text).replace(/[-_+]+/g,' ').replace(/\s+/g,' ').trim();if(!text)return'';return text.charAt(0).toUpperCase()+text.slice(1)}function getRouteMeta(path){var normalized=normalizePath(path);var lastSegment=humanizeSegment(getLastSegment(normalized));if(normalized==='/'||normalized==='/index')return{title:${JSON.stringify(HOME_TITLE)},description:${JSON.stringify(HOME_DESCRIPTION)},ogType:'website'};if(normalized==='/search')return{title:${JSON.stringify(SEARCH_TITLE)},description:${JSON.stringify(SEARCH_DESCRIPTION)},ogType:'website'};if(normalized==='/map')return{title:${JSON.stringify(MAP_TITLE)},description:${JSON.stringify(MAP_DESCRIPTION)},ogType:'website'};if(normalized==='/articles')return{title:${JSON.stringify(ARTICLES_TITLE)},description:${JSON.stringify(ARTICLES_DESCRIPTION)},ogType:'website'};if(normalized==='/about')return{title:${JSON.stringify(ABOUT_TITLE)},description:${JSON.stringify(ABOUT_DESCRIPTION)},ogType:'website'};if(normalized==='/contact')return{title:${JSON.stringify(CONTACT_TITLE)},description:${JSON.stringify(CONTACT_DESCRIPTION)},ogType:'website'};if(normalized==='/travelsby')return{title:${JSON.stringify(TRAVELSBY_TITLE)},description:${JSON.stringify(TRAVELSBY_DESCRIPTION)},ogType:'website'};if(normalized==='/quests')return{title:${JSON.stringify(QUESTS_TITLE)},description:${JSON.stringify(QUESTS_DESCRIPTION)},ogType:'website'};if(normalized==='/roulette')return{title:${JSON.stringify(ROULETTE_TITLE)},description:${JSON.stringify(ROULETTE_DESCRIPTION)},ogType:'website'};if(normalized.indexOf('/travels/')===0)return{title:(lastSegment?lastSegment+' | ':'')+${JSON.stringify(SITE_BRAND)},description:lastSegment?('Маршрут '+lastSegment+' в Metravel. Смотрите описание поездки, фото, карту и советы путешественников.'):${JSON.stringify(DEFAULT_DESCRIPTION)},ogType:'article'};if(normalized.indexOf('/article/')===0)return{title:(lastSegment?lastSegment+' | ':'')+${JSON.stringify(SITE_BRAND)},description:lastSegment?('Статья '+lastSegment+' в Metravel. Открывайте материалы о путешествиях, маршрутах и полезных находках.'):${JSON.stringify(ARTICLE_FALLBACK_DESCRIPTION)},ogType:'article'};if(normalized.indexOf('/quests/')===0)return{title:(lastSegment?lastSegment+' | ':'')+${JSON.stringify(SITE_BRAND)},description:lastSegment?('Квест '+lastSegment+' в Metravel. Проходите маршрут, задания и точки на карте.'):${JSON.stringify(QUESTS_DESCRIPTION)},ogType:'article'};return{title:${JSON.stringify(SITE_BRAND)},description:${JSON.stringify(DEFAULT_DESCRIPTION)},ogType:'website'}}function upsertMeta(selector,attrs,content){var el=document.querySelector(selector);if(!el){el=document.createElement('meta');for(var key in attrs){if(Object.prototype.hasOwnProperty.call(attrs,key))el.setAttribute(key,attrs[key])}document.head.appendChild(el)}el.setAttribute('content',content);return el}var routeMeta=getRouteMeta(window.location&&window.location.pathname||'/');var titleEl=document.querySelector('head title[data-rh="true"]');if(titleEl){var currentTitle=titleEl.textContent||'';if(!currentTitle.trim()||currentTitle.trim()===${JSON.stringify(SITE_BRAND)})titleEl.textContent=routeMeta.title}else if(!document.title||!String(document.title).trim()||String(document.title).trim()===${JSON.stringify(SITE_BRAND)}){document.title=routeMeta.title}if(!document.title||!String(document.title).trim())document.title=routeMeta.title;var descriptionMeta=document.querySelector('meta[name="description"]');if(descriptionMeta){var currentDescription=descriptionMeta.getAttribute('content')||'';if(!currentDescription.trim()||currentDescription.trim()===${JSON.stringify(DEFAULT_DESCRIPTION)}||currentDescription.trim()===${JSON.stringify('Найди место для путешествия и поделись своим опытом.')})descriptionMeta.setAttribute('content',routeMeta.description)}else{descriptionMeta=document.createElement('meta');descriptionMeta.setAttribute('name','description');descriptionMeta.setAttribute('content',routeMeta.description);document.head.appendChild(descriptionMeta)}upsertMeta('meta[property="og:title"]',{property:'og:title'},routeMeta.title);upsertMeta('meta[property="og:description"]',{property:'og:description'},routeMeta.description);upsertMeta('meta[name="twitter:title"]',{name:'twitter:title'},routeMeta.title);upsertMeta('meta[name="twitter:description"]',{name:'twitter:description'},routeMeta.description);upsertMeta('meta[property="og:type"]',{property:'og:type'},routeMeta.ogType||'website')}catch(_){}try{var s=null;try{s=window.localStorage.getItem('theme')}catch(_){}var th=(s==='light'||s==='dark'||s==='auto')?s:'auto';var d=false;if(th==='dark')d=true;else if(th!=='light')d=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches;var r=document.documentElement;r.setAttribute('data-theme',d?'dark':'light');r.style.colorScheme=d?'dark':'light'}catch(_){}window.__EXPO_ROUTER_INSPECTOR=false;try{var p2=window.location.pathname||'';if(p2.length>1)p2=p2.replace(/\/+$/,'');var o='https://metravel.by';var correctUrl=o+p2;var cl=document.querySelector('link[rel="canonical"]');if(cl){var h2=cl.getAttribute('href')||'';if(h2!==correctUrl){cl.setAttribute('href',correctUrl)}}else{cl=document.createElement('link');cl.rel='canonical';cl.href=correctUrl;document.head.appendChild(cl)}var ou=document.querySelector('meta[property="og:url"]');if(ou){var oc2=ou.getAttribute('content')||'';if(/\[|\%5B/.test(oc2)||oc2!==correctUrl){ou.setAttribute('content',correctUrl)}}else{ou=document.createElement('meta');ou.setAttribute('property','og:url');ou.setAttribute('content',correctUrl);document.head.appendChild(ou)}try{if(typeof MutationObserver!=='undefined'){var _canUrl=correctUrl;var _canObs=new MutationObserver(function(){var all=document.querySelectorAll('link[rel="canonical"]');if(all.length>1){for(var i=all.length-1;i>=1;i--){try{all[i].parentNode&&all[i].parentNode.removeChild(all[i])}catch(e){}}if(all[0]&&all[0].getAttribute('href')!==_canUrl){all[0].setAttribute('href',_canUrl)}}});_canObs.observe(document.head,{childList:true});setTimeout(function(){try{_canObs.disconnect()}catch(e){}},1000)}}catch(_2){}}catch(_){}})();`;

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
      <title>{SITE_BRAND}</title>
      <meta name="description" content={DEFAULT_DESCRIPTION} />

      {/* Legacy URL guard: /?param=<id|slug> -> /travels/<id|slug> */}
      <script
        dangerouslySetInnerHTML={{ __html: getLegacyParamRedirectScript() }}
      />

      {/* Consolidated critical head script: title fallback + theme detection + canonical fix */}
      <script
        dangerouslySetInnerHTML={{
          __html: getCriticalHeadScript(),
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
                  url: 'https://metravel.by/assets/icons/logo_yellow_60x60.png',
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

      {/* Resource hints - only the origins used in the initial render.
          images.weserv.nl preconnect deferred to when content images actually load. */}
      <link rel="preconnect" href="https://metravel.by" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://cdn.metravel.by" crossOrigin="anonymous" />
      <link rel="dns-prefetch" href="https://mc.yandex.ru" />
      <link rel="dns-prefetch" href="https://www.googletagmanager.com" />

      {/* Home hero image preload — first slide of the book carousel.
          Only injected for home page; the inline script checks pathname. */}
      <script dangerouslySetInnerHTML={{ __html: `(function(){try{var p=window.location&&window.location.pathname;if(p!=='/'&&p!=='/index')return;var u='https://metravel.by/travel-image/544/conversions/26d572d144174803a61fe96f2d7aa142.webp?w=500&q=75&fit=contain';if(document.querySelector('link[rel="preload"][href="'+u+'"]'))return;var l=document.createElement('link');l.rel='preload';l.as='image';l.href=u;try{l.fetchPriority='high'}catch(_){}document.head.appendChild(l)}catch(_){}})();` }} />

      {/* Leaflet CSS early-load for map page — self-hosted, no CDN roundtrip.
          Applies stylesheet immediately (not just preload) so it is ready before JS hydration.
          Only injected on /map route; loads CSS in parallel with JS chunks. */}
      <script dangerouslySetInnerHTML={{ __html: `(function(){try{var p=window.location&&window.location.pathname;if(p!=='/map')return;function addSheet(id,href){if(document.getElementById(id))return;var l=document.createElement('link');l.id=id;l.rel='stylesheet';l.href=href;l.setAttribute('data-metravel-leaflet-css','preloaded');document.head.appendChild(l)}addSheet('metravel-leaflet-css','/vendor/leaflet.css');addSheet('metravel-markercluster-css','/vendor/MarkerCluster.css');var tc=document.createElement('link');tc.rel='preconnect';tc.href='https://tile.openstreetmap.org';tc.crossOrigin='anonymous';document.head.appendChild(tc)}catch(_){}})();` }} />

      {/* Font preloads removed: Roboto is loaded via expo-font on native only.
          On web the app uses system-ui / Inter from CSS; preloading unused .ttf files
          triggers "preloaded but not used" warnings in Chrome. */}

      {/* Icon fonts (Feather, etc.) are loaded by expo-font at runtime.
          Avoid hard-coding Metro's dev asset URLs here: they are not stable and can 404. */}
      
      {/* Icons */}
      <link rel="icon" href="/assets/icons/logo_yellow.ico" sizes="any" type="image/x-icon" />
      <link rel="icon" href="/assets/icons/logo_yellow_512x512.png" sizes="512x512" type="image/png" />
      <link rel="icon" href="/assets/icons/logo_yellow_192x192.png" sizes="192x192" type="image/png" />
      <link rel="icon" href="/assets/icons/logo_yellow_60x60.png" sizes="32x32" type="image/png" />
      <link rel="icon" href="/assets/icons/logo_yellow.png" sizes="16x16" type="image/png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon-180x180.png" />
      <link rel="manifest" href="/manifest.json" />

      {/* Critical CSS */}
      <style dangerouslySetInnerHTML={{ __html: buildCriticalCSS() }} />
      <style dangerouslySetInnerHTML={{ __html: '[data-testid="filter-scrollview"]::-webkit-scrollbar{display:none}' }} />
      <script
        dangerouslySetInnerHTML={{ __html: getTravelRouteClassScript() }}
      />
      <style
        dangerouslySetInnerHTML={{
          __html: getRootVisibilityGateCss(),
        }}
      />
      <noscript>
        <style dangerouslySetInnerHTML={{ __html: '#root { visibility: visible !important; }' }} />
      </noscript>

      {/* Ensure font-display=swap for dynamically injected icon fonts */}
      <script
        dangerouslySetInnerHTML={{ __html: getFontFaceSwapScript() }}
      />

      <script
        dangerouslySetInnerHTML={{ __html: getEntryPreloadScript() }}
      />
	      <script
	        dangerouslySetInnerHTML={{
	          __html: String.raw`(function(){try{if(typeof document==='undefined')return;var root=document.documentElement;var done=false;function finish(){if(done)return;done=true;root.classList.add('rnw-styles-ready')}var inlineSheet=document.getElementById('react-native-stylesheet');if(inlineSheet){if(typeof requestAnimationFrame==='function'){requestAnimationFrame(function(){requestAnimationFrame(finish)})}else{finish()}}else{setTimeout(finish,80)}}catch(_){}})();`,
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
        __html: `(function(){function o(){try{var i=document.querySelector('[data-lcp]');if(!i)return;if(!i.getAttribute('fetchPriority'))i.setAttribute('fetchPriority','high');if(i.decode&&i.complete)i.decode().catch(function(){})}catch(_){}}function s(){if(window.requestIdleCallback)window.requestIdleCallback(o,{timeout:1000});else setTimeout(o,1000)}if(document.readyState==='complete')s();else window.addEventListener('load',s,{once:true})})();`,
      }}
    />

    {/* ===== Analytics (отложенная загрузка, только на metravel.by и только при согласии) ===== */}
    <script
      dangerouslySetInnerHTML={{
        __html: getAnalyticsInlineScript(METRIKA_ID, GA_ID),
      }}
    />

    {/* Yandex Metrika fallback pixel for clients without JS (improves
        counter accuracy and reduces antifraud false-positives). */}
    {METRIKA_ID > 0 && isProduction && (
      <noscript>
        <div>
          <img
            src={`https://mc.yandex.ru/watch/${METRIKA_ID}`}
            style={{ position: 'absolute', left: '-9999px' }}
            alt=""
          />
        </div>
      </noscript>
    )}
    </body>
    </html>
  );
}

// criticalCSS is now built by utils/criticalCSSBuilder.ts to avoid Babel parse errors with CSS selectors in template literals.
