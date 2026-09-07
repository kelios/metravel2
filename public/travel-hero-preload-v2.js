/* eslint-disable no-empty, no-unused-vars */
(function(){
  try {
    var SITE_ORIGIN = 'https://metravel.by';
    var DEFAULT_OG_IMAGE = SITE_ORIGIN + '/og-default.png';
    var FALLBACK_DESCRIPTION = 'Путешествие на Metravel.';

    var host = window.location && window.location.hostname;
    function isPrivateHost(h){
      try {
        if (!h) return false;
        h = String(h).toLowerCase();
        if (h === 'localhost' || h === '127.0.0.1') return true;
        if (/^10\./.test(h)) return true;
        if (/^192\.168\./.test(h)) return true;
        if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
        return false;
      } catch (_e) {
        return false;
      }
    }
    var isProdHost = host === 'metravel.by' || host === 'www.metravel.by' || isPrivateHost(host);
    if (!isProdHost) return;
    var path = window.location && window.location.pathname;
    if (!path || path.indexOf('/travels/') !== 0) return;
    var slug = path.replace(/^\/travels\//, '').replace(/\/+$/, '');
    if (!slug) return;

    var isId = /^[0-9]+$/.test(slug);
    var apiBaseEnv = window.__METRAVEL_API_URL__ || "";
    function normalizeApiOrigin(raw){
      try {
        if (!raw) return '';
        var s = String(raw);
        s = s.replace(/\s+/g, '');
        s = s.replace(/\/api\/?$/i, '');
        if (!s) return '';
        var u = new URL(s);
        return u.origin;
      } catch (_e) {
        try {
          var s2 = String(raw).replace(/\/api\/?$/i, '');
          return s2;
        } catch (_e2) {
          return '';
        }
      }
    }
    var currentOrigin = ((window.location && window.location.origin) || '');
    function getHostname(raw){
      try {
        if (!raw) return '';
        return String(new URL(String(raw)).hostname || '').toLowerCase();
      } catch (_e) {
        return '';
      }
    }
    var sameOriginApiHost = isPrivateHost(host);
    var envApiOrigin = normalizeApiOrigin(apiBaseEnv);
    var envApiHost = getHostname(envApiOrigin);
    var shouldIgnoreEnvApiOrigin = !sameOriginApiHost && (!envApiOrigin || isPrivateHost(envApiHost));
    var apiOrigin = sameOriginApiHost || shouldIgnoreEnvApiOrigin
      ? currentOrigin
      : (envApiOrigin || currentOrigin);
    if (!apiOrigin) return;
    var endpoint = isId
      ? apiOrigin + '/api/travels/' + encodeURIComponent(slug) + '/'
      : apiOrigin + '/api/travels/by-slug/' + encodeURIComponent(slug) + '/';

    function stripHtml(raw) {
      try {
        return String(raw || '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#x27;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
      } catch (_e) {
        return '';
      }
    }

    function normalizeText(raw) {
      try {
        return String(raw || '').replace(/\s+/g, ' ').trim();
      } catch (_e) {
        return '';
      }
    }

    function buildTitle(base) {
      var normalized = normalizeText(base);
      if (!normalized) return 'Путешествие | Metravel';
      var suffix = ' | Metravel';
      var maxBaseLength = Math.max(10, 60 - suffix.length);
      if (normalized.length > maxBaseLength) {
        normalized = normalized.slice(0, maxBaseLength - 3).trimEnd() + '...';
      }
      return normalized + suffix;
    }

    function buildDescription(raw) {
      var normalized = stripHtml(raw);
      if (!normalized) return FALLBACK_DESCRIPTION;
      return normalized.slice(0, 160) || FALLBACK_DESCRIPTION;
    }

    function toAbsoluteUrl(rawUrl) {
      try {
        if (!rawUrl) return null;
        var resolved = new URL(String(rawUrl), SITE_ORIGIN);
        if (resolved.protocol === 'http:') {
          resolved.protocol = 'https:';
        }
        return resolved.toString();
      } catch (_e) {
        return null;
      }
    }

    /*
     * ЗЕРКАЛО `normalizeOgImageUrl` из `utils/seo.ts` (#1873).
     *
     * ПОЧЕМУ КОПИЯ, А НЕ ИМПОРТ. Скрипт шипится сырым файлом из `public/` и
     * выполняется ДО бандла — импортов у него нет вовсе, в этом весь его смысл:
     * краулер видит настоящую мету, не дожидаясь гидрации. Копия здесь ОДНА, и
     * её расхождение с TS-источником валит
     * `__tests__/public/travel-hero-preload-social-preview.test.ts`: тот же набор
     * входов гоняется через `normalizeOgImageUrl` и сравнивается посимвольно —
     * тем же приёмом, что `scripts/lib/readerMediaUrl.js` (#1854/#1868).
     *
     * ПОЧЕМУ ВООБЩЕ СЧИТАЕМ АДРЕС, А НЕ ПЕРЕСТАЁМ ПАТЧИТЬ МЕТУ. Оболочка SPA
     * (`app/+html.tsx`) `og:image` не объявляет вовсе, а SSG-страница есть не у
     * каждого адреса: свежая и переименованная статья живут без пререндера до
     * следующего деплоя. Перестань скрипт писать обложку — на таких страницах её
     * не было бы ни одного кадра до гидрации, а на пререндеренных он до этой
     * правки ЗАТИРАЛ верный SSG-адрес мастером без `?w=` (`no-store`, 0.4–1 МБ).
     * Нужен был не отказ от записи, а тот же адрес, что у SSG.
     */

    /* Зеркало `socialPreviewWidthForRoute` (`constants/imageContract.ts`). */
    var SOCIAL_PREVIEW_WIDTH_BY_ROUTE = {
      'avatar': 160,
      'badge-image': 160,
      'quest-cover': 800,
      'address-image': 960,
      'quest-step-image': 800,
      'quest-poster': 800,
      'trip-cover': 960,
      'travel-image': 1280,
      'gallery': 1280,
      'travel-description-image': 960
    };

    /* Зеркало `FIRST_PARTY_MEDIA_ROUTE` и правил ключа из `utils/mediaUrl.ts`. */
    var FIRST_PARTY_MEDIA_ROUTE = /^\/(?:gallery|travel-image|travel-description-image|address-image)\/(.+)$/i;
    var LEGACY_IMAGE_EXTENSIONS = ['gif', 'heic', 'heif', 'jpeg', 'jpg', 'png', 'webp'];
    var LEGACY_SIGNATURE_QUERY_PARAM = /^(?:x-amz-.+|awsaccesskeyid|signature|expires|policy|key-pair-id)$/i;
    var S3_HOST = /(?:^|\.)s3(?:[.-][a-z0-9-]+)*\.amazonaws\.com$/i;
    var OWN_SITE_HOST = /(?:^|\.)metravel\.by$/i;

    /* Зеркало `isFirstPartyMediaHost` + `resolveLegacyResizeOrigin`: ссылку в
     * бакет обслуживает наш backend, но origin для неё берётся из конфигурации,
     * а не из адреса, — придумывать его здесь нельзя, поэтому такой хост мимо. */
    function isFirstPartyMediaHost(hostname) {
      var h = String(hostname || '').toLowerCase();
      if (!h || S3_HOST.test(h)) return false;
      if (OWN_SITE_HOST.test(h)) return true;
      if (isPrivateHost(h)) return true;
      if (h === String(host || '').toLowerCase()) return true;
      return !!apiOrigin && h === getHostname(apiOrigin);
    }

    /* Зеркало `parseSupportedLegacyImageKey`: сегменты ключа либо `null`. */
    function parseLegacyImageKeyParts(key) {
      var decodedKey;
      try {
        decodedKey = decodeURIComponent(key);
      } catch (_e) {
        return null;
      }
      if (!decodedKey || decodedKey.indexOf('\\') !== -1 || decodedKey.indexOf('\0') !== -1) return null;

      var parts = decodedKey.split('/');
      for (var i = 0; i < parts.length; i++) {
        if (!parts[i] || parts[i] === '.' || parts[i] === '..') return null;
      }

      var last = parts[parts.length - 1].split('.');
      var extension = String(last[last.length - 1] || '').toLowerCase();
      return LEGACY_IMAGE_EXTENSIONS.indexOf(extension) === -1 ? null : parts;
    }

    /* Зеркало `isLegacyConversionKey`: сравнение идёт теми же `indexOf`/`lastIndexOf`,
     * что и в TS-источнике, — расхождение копии видно построчно, а не через свои
     * обёртки над теми же встроенными методами. */
    function isLegacyConversionKey(parts) {
      var conversionIndex = parts.indexOf('conversions');
      return conversionIndex > 0 &&
        conversionIndex === parts.lastIndexOf('conversions') &&
        conversionIndex < parts.length - 1 &&
        parts.indexOf('responsive-images') === -1 &&
        parts[0].indexOf(':') === -1;
    }

    /*
     * Адрес соцпревью: ступень семейства, затем тот же transform-роут, по
     * которому кадр запрашивает читатель.
     *
     * ПОРЯДОК НЕ КОММУТИРУЕТ. Семейство определяется по ПЕРВОМУ сегменту пути;
     * после переписывания это `media-resize`, такого семейства в контракте нет,
     * ширина не проставится вовсе, и краулер получит мастер с `no-store` —
     * регресс #1221. Поэтому сначала ширина, и только потом роут.
     */
    function toSocialPreviewUrl(absoluteUrl) {
      try {
        if (!absoluteUrl) return absoluteUrl;
        var url = new URL(String(absoluteUrl));

        if (!url.searchParams.has('w')) {
          var familyMatch = /^\/([a-z-]+)\//i.exec(url.pathname);
          var family = familyMatch ? familyMatch[1].toLowerCase() : '';
          var width = family && Object.prototype.hasOwnProperty.call(SOCIAL_PREVIEW_WIDTH_BY_ROUTE, family)
            ? SOCIAL_PREVIEW_WIDTH_BY_ROUTE[family]
            : 0;
          if (width) url.searchParams.set('w', String(width));
        }

        if (!isFirstPartyMediaHost(url.hostname)) return url.toString();

        var routeMatch = FIRST_PARTY_MEDIA_ROUTE.exec(url.pathname);
        if (!routeMatch) return url.toString();
        var keyParts = parseLegacyImageKeyParts(routeMatch[1]);
        if (!keyParts) return url.toString();

        var isUpload = keyParts[0] === 'uploads' && keyParts.length > 1;
        if (!isUpload && !isLegacyConversionKey(keyParts)) return url.toString();

        // Подпись S3 после переписывания бессмысленна и только плодит cache-key.
        var signed = [];
        url.searchParams.forEach(function (_value, key) {
          if (LEGACY_SIGNATURE_QUERY_PARAM.test(key)) signed.push(key);
        });
        for (var si = 0; si < signed.length; si++) { url.searchParams.delete(signed[si]); }

        url.pathname = (isUpload ? '/media-resize/' : '/media-resize/legacy/') + routeMatch[1];
        return url.toString();
      } catch (_e) {
        return absoluteUrl;
      }
    }

    function getTravelImage(data) {
      try {
        var ogImgUrl = '';
        if (data && data.gallery && data.gallery.length) {
          var gFirst = data.gallery[0];
          ogImgUrl = typeof gFirst === 'string' ? gFirst : (gFirst && gFirst.url) || '';
        }
        if (!ogImgUrl && data && data.travel_image_thumb_url) {
          ogImgUrl = data.travel_image_thumb_url;
        }
        return toSocialPreviewUrl(toAbsoluteUrl(ogImgUrl)) || DEFAULT_OG_IMAGE;
      } catch (_e) {
        return DEFAULT_OG_IMAGE;
      }
    }

    function upsertMeta(selector, attributeName, content, createAttrs) {
      try {
        if (!content) return null;
        var el = document.querySelector(selector);
        if (!el) {
          el = document.createElement('meta');
          var attrs = createAttrs || {};
          for (var key in attrs) {
            if (Object.prototype.hasOwnProperty.call(attrs, key)) {
              el.setAttribute(key, attrs[key]);
            }
          }
          document.head.appendChild(el);
        }
        el.setAttribute(attributeName, content);
        return el;
      } catch (_e) {
        return null;
      }
    }

    function upsertLink(selector, attrs) {
      try {
        var el = document.querySelector(selector);
        if (!el) {
          el = document.createElement('link');
          document.head.appendChild(el);
        }
        for (var key in attrs) {
          if (Object.prototype.hasOwnProperty.call(attrs, key)) {
            el.setAttribute(key, attrs[key]);
          }
        }
        return el;
      } catch (_e) {
        return null;
      }
    }

    function upsertJsonLd(id, payload) {
      try {
        if (!payload) return;
        var el = document.getElementById(id);
        if (!el) {
          el = document.createElement('script');
          el.type = 'application/ld+json';
          el.id = id;
          document.head.appendChild(el);
        }
        el.textContent = JSON.stringify(payload);
      } catch (_e) {}
    }

    function buildArticleJsonLd(data, correctUrl, title, description, imageUrl) {
      var payload = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title.replace(/\s+\|\s+Metravel$/, ''),
        description: description,
        url: correctUrl,
        image: imageUrl ? [imageUrl] : undefined,
        publisher: {
          '@type': 'Organization',
          name: 'MeTravel',
          url: SITE_ORIGIN
        }
      };

      var createdAt = data && data.created_at ? String(data.created_at) : '';
      var updatedAtRaw = data && data.updated_at ? String(data.updated_at) : '';
      if (createdAt && !isNaN(Date.parse(createdAt))) payload.datePublished = createdAt;
      if (updatedAtRaw && !isNaN(Date.parse(updatedAtRaw))) payload.dateModified = updatedAtRaw;

      var authorName = normalizeText(data && data.user && (data.user.name || data.user.first_name));
      if (authorName) {
        payload.author = {
          '@type': 'Person',
          name: authorName
        };
      }

      return payload;
    }

    // Must match optimizeImageUrl() + buildVersionedImageUrl() behavior.
    function buildOptimizedUrl(rawUrl, width, quality, updatedAt, id) {
      try {
        if (!rawUrl || /^(data:|blob:)/i.test(String(rawUrl))) {
          return rawUrl || null;
        }
        var resolved = new URL(rawUrl, window.location.origin);

        // Force HTTPS for non-local hosts (matches optimizeImageUrl)
        if (resolved.protocol === 'http:') {
          var h = resolved.hostname.toLowerCase();
          if (h !== 'localhost' && h !== '127.0.0.1' && !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(h)) {
            resolved.protocol = 'https:';
          }
        }

        // Add version param (matches buildVersionedImageUrl)
        if (updatedAt) {
          var ts = Date.parse(updatedAt);
          if (!isNaN(ts)) resolved.searchParams.set('v', String(ts));
        } else if (id) {
          resolved.searchParams.set('v', String(id));
        }

        // optimizeImageUrl() only transforms URLs from API origin.
        if (!apiOrigin || resolved.origin !== apiOrigin) {
          return resolved.toString();
        }

        var OPTIMIZATION_PARAMS = ['w', 'h', 'q', 'f', 'fit', 'auto', 'output', 'blur', 'dpr'];
        for (var pIndex = 0; pIndex < OPTIMIZATION_PARAMS.length; pIndex++) {
          try { resolved.searchParams.delete(OPTIMIZATION_PARAMS[pIndex]); } catch (_e0) {}
        }

        if (width) resolved.searchParams.set('w', String(Math.round(width)));
        if (quality) resolved.searchParams.set('q', String(Math.round(quality)));
        resolved.searchParams.set('fit', 'contain');
        return resolved.toString();
      } catch (_e) {
        return null;
      }
    }

    function run(){
      var controller = window.AbortController ? new AbortController() : null;
      var timeout = setTimeout(function(){
        try { if (controller) controller.abort(); } catch (_e) {}
      }, 8000);

      try { window.__metravelTravelPreloadPending = true; } catch (_e) {}

      var preloadPromise = fetch(endpoint, {
        method: 'GET',
        credentials: 'omit',
        signal: controller ? controller.signal : undefined
      }).then(function(res){
        if (!res || !res.ok) return null;
        return res.json();
      }).then(function(data){
        if (!data) return;

        // Cache API response globally so React Query can reuse it (avoids double fetch)
        try { window.__metravelTravelPreload = { data: data, slug: slug, isId: isId, source: 'direct-api' }; } catch (_e) {}

        // ── SEO: patch meta tags BEFORE React hydration so crawlers see real data ──
        try {
          var fallbackName = slug.replace(/-/g, ' ');
          var travelName = normalizeText(data && (data.name || data.title)) || fallbackName;
          var fullTitle = buildTitle(travelName);
          var plainDesc = buildDescription(data && data.description);
          var ogImgUrl = getTravelImage(data);

          // Canonical & og:url — fix [param] placeholder or create if missing
          var correctPath = '/travels/' + slug;
          var correctUrl = SITE_ORIGIN + correctPath;
          try { document.title = fullTitle; } catch (_e2) {}
          var titleEl = document.querySelector('title');
          if (titleEl) titleEl.textContent = fullTitle;

          upsertMeta('meta[name="description"]', 'content', plainDesc, { name: 'description' });
          upsertMeta('meta[property="og:title"]', 'content', fullTitle, { property: 'og:title' });
          upsertMeta('meta[property="og:description"]', 'content', plainDesc, { property: 'og:description' });
          upsertMeta('meta[property="og:url"]', 'content', correctUrl, { property: 'og:url' });
          upsertMeta('meta[property="og:image"]', 'content', ogImgUrl, { property: 'og:image' });
          upsertMeta('meta[property="og:type"]', 'content', 'article', { property: 'og:type' });
          upsertMeta('meta[name="twitter:title"]', 'content', fullTitle, { name: 'twitter:title' });
          upsertMeta('meta[name="twitter:description"]', 'content', plainDesc, { name: 'twitter:description' });
          upsertMeta('meta[name="twitter:image"]', 'content', ogImgUrl, { name: 'twitter:image' });

          // Remove ALL existing canonical links to prevent duplicates (react-helmet-async may inject a second one)
          var canEls = document.querySelectorAll('link[rel="canonical"]');
          for (var ci = canEls.length - 1; ci >= 0; ci--) { canEls[ci].parentNode && canEls[ci].parentNode.removeChild(canEls[ci]); }
          upsertLink('link[rel="canonical"]', { rel: 'canonical', href: correctUrl });
          // Watch for react-helmet-async injecting a duplicate canonical after hydration
          if (typeof MutationObserver !== 'undefined') {
            var canObs = new MutationObserver(function() {
              var allCan = document.querySelectorAll('link[rel="canonical"]');
              if (allCan.length > 1) {
                for (var di = allCan.length - 1; di >= 1; di--) { try { allCan[di].parentNode && allCan[di].parentNode.removeChild(allCan[di]); } catch (_e4) {} }
                if (allCan[0] && allCan[0].getAttribute('href') !== correctUrl) { allCan[0].setAttribute('href', correctUrl); }
              }
            });
            canObs.observe(document.head, { childList: true });
            setTimeout(function() { try { canObs.disconnect(); } catch (_e5) {} }, 1000);
          }

          // Breadcrumb structured data for travel pages
          var breadcrumbName = travelName || 'Путешествие';
          upsertJsonLd('travel-article-jsonld', buildArticleJsonLd(data, correctUrl, fullTitle, plainDesc, ogImgUrl));
          upsertJsonLd('travel-breadcrumb-jsonld', {
            "@context": 'https://schema.org',
            "@type": 'BreadcrumbList',
            itemListElement: [
              {
                "@type": 'ListItem',
                position: 1,
                name: 'Главная',
                item: SITE_ORIGIN + '/',
              },
              {
                "@type": 'ListItem',
                position: 2,
                name: 'Путешествия',
                item: SITE_ORIGIN + '/travelsby',
              },
              {
                "@type": 'ListItem',
                position: 3,
                name: breadcrumbName,
                item: correctUrl,
              },
            ],
          });
        } catch (_e) {}
        // ── end SEO patch ──

        var url = '';
        var updatedAt = data.updated_at;
        var id = data.id;
        var gallery = data.gallery;

        if (gallery && gallery.length) {
          var first = gallery[0];
          url = typeof first === 'string' ? first : first && first.url;
          updatedAt = typeof first === 'string' ? undefined : first.updated_at;
          id = typeof first === 'string' ? undefined : first.id;
        }

        if (!url) {
          url = data.travel_image_thumb_url;
          updatedAt = data.updated_at;
          id = data.id;
        }

        if (!url || typeof url !== 'string') return;

        // Skip preload if the LCP image is already rendered and loaded
        var existingLcp = document.querySelector('img[data-lcp]');
        if (existingLcp && existingLcp.complete && existingLcp.naturalWidth > 0) return;
        if (document.querySelector('link[data-travel-hero-preload="true"][as="image"]')) return;

        function createPreloadLink() {
          var isMobile = (window.innerWidth || 0) < 768;
          // Must match the image the LCP <img> actually requests, else this
          // preload fetches a different file and is wasted.
          // Source of truth: TravelDetailsOptimizedLCPHero.tsx (q72/q82) +
          // sliderParts/utils.ts buildUriWeb (q72/q82 for the first slide).
          var quality = isMobile ? 72 : 82;
          var widths = isMobile ? [320, 480, 640, 720] : [720, 960, 1280];

          // Build srcSet entries to match buildResponsiveImageProps()
          var srcSetParts = [];
          for (var i = 0; i < widths.length; i++) {
            var u = buildOptimizedUrl(url, widths[i], quality, updatedAt, id);
            if (u) srcSetParts.push(u + ' ' + widths[i] + 'w');
          }

          // The main src uses the widest breakpoint.
          var widest = widths[widths.length - 1];
          var preloadHref = buildOptimizedUrl(url, widest, quality, updatedAt, id);
          if (!preloadHref) return;

          var preloadIsCrossOrigin = false;
          try {
            var resolved = new URL(preloadHref, window.location.origin);
            var origin = resolved.origin;
            preloadIsCrossOrigin = !!origin && origin !== window.location.origin;
            if (origin && !document.querySelector('link[rel="preconnect"][href="' + origin + '"]')) {
              var pre = document.createElement('link');
              pre.rel = 'preconnect';
              pre.href = origin;
              pre.crossOrigin = 'anonymous';
              document.head.appendChild(pre);
            }
          } catch (_e) {}

          if (document.querySelector('link[rel="preload"][href="' + preloadHref + '"]')) return;

          var link = document.createElement('link');
          link.rel = 'preload';
          link.as = 'image';
          link.href = preloadHref;
          link.setAttribute('data-travel-hero-preload', 'true');

          // Exact match with TravelDetailsHero.tsx sizes
          var sizesAttr = isMobile ? '100vw' : '(max-width: 1024px) 92vw, 720px';

          if (srcSetParts.length > 0) {
            link.setAttribute('imagesrcset', srcSetParts.join(', '));
            link.setAttribute('imagesizes', sizesAttr);
          }
          try {
            link.fetchPriority = 'high';
            link.setAttribute('fetchPriority', 'high');
          } catch (_e) {}
          if (preloadIsCrossOrigin) {
            link.crossOrigin = 'anonymous';
          }
          document.head.appendChild(link);
        }

        createPreloadLink();
      }).catch(function(){}).finally(function(){
        try { window.__metravelTravelPreloadPending = false; } catch (_e) {}
        clearTimeout(timeout);
      });

      try { window.__metravelTravelPreloadPromise = preloadPromise; } catch (_e) {}
    }

    // Run immediately to start fetching API data for LCP image as soon as possible
    // independent of React hydration.
    run();
  } catch (_e) {}
})();

