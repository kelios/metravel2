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
    var sameOriginApiHost = isPrivateHost(host);
    var apiOrigin = sameOriginApiHost
      ? ((window.location && window.location.origin) || '')
      : (normalizeApiOrigin(apiBaseEnv) || ((window.location && window.location.origin) || ''));
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
        return toAbsoluteUrl(ogImgUrl) || DEFAULT_OG_IMAGE;
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
        try { window.__metravelTravelPreload = { data: data, slug: slug, isId: isId }; } catch (_e) {}

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

        // Skip if not visible soon (prevents "preloaded but not used" warning)
        if (!document.querySelector('.travel-hero, [data-hero-container]')) {
          // Defer preload until hero container exists
          setTimeout(function() {
            if (document.querySelector('.travel-hero, [data-hero-container]')) {
              createPreloadLink();
            }
          }, 100);
          return;
        }

        function createPreloadLink() {
          var isMobile = (window.innerWidth || 0) < 768;
          var quality = isMobile ? 35 : 45;

          // Match TravelDetailsHero.tsx: lcpWidths = isMobile ? [320, 400] : [480, 720]
          var widths = isMobile ? [320, 400] : [480, 720];

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
