/* eslint-disable no-empty, no-unused-vars */
(function(){
  try {
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

    // Must match optimizeImageUrl() + buildVersionedImageUrl() behavior.
    function buildOptimizedUrl(rawUrl, width, quality, updatedAt, id, dpr) {
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
        if (dpr) resolved.searchParams.set('dpr', String(dpr));
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
          var siteOrigin = 'https://metravel.by';

          function patchMeta(sel, attr, val) {
            try {
              var el = document.querySelector(sel);
              if (el) { el.setAttribute(attr, val); }
            } catch (_e2) {}
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
            } catch (_e3) {}
          }

          // Title
          var travelName = data.name || data.title || '';
          if (travelName) {
            var fullTitle = travelName + ' | MeTravel';
            try { document.title = fullTitle; } catch (_e2) {}
            patchMeta('meta[property="og:title"]', 'content', fullTitle);
            patchMeta('meta[name="twitter:title"]', 'content', fullTitle);
            var titleEl = document.querySelector('title');
            if (titleEl) titleEl.textContent = fullTitle;
          }

          // Description — strip HTML tags
          var rawDesc = data.description || '';
          if (rawDesc) {
            var plainDesc = rawDesc.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
            if (plainDesc) {
              patchMeta('meta[name="description"]', 'content', plainDesc);
              patchMeta('meta[property="og:description"]', 'content', plainDesc);
              patchMeta('meta[name="twitter:description"]', 'content', plainDesc);
            }
          }

          // Image — must be absolute URL for Google/social crawlers
          var ogImgUrl = data.travel_image_thumb_url || '';
          if (!ogImgUrl && data.gallery && data.gallery.length) {
            var gFirst = data.gallery[0];
            ogImgUrl = typeof gFirst === 'string' ? gFirst : (gFirst && gFirst.url) || '';
          }
          if (ogImgUrl) {
            // Make absolute
            if (ogImgUrl.indexOf('http') !== 0) {
              ogImgUrl = siteOrigin + (ogImgUrl.charAt(0) === '/' ? '' : '/') + ogImgUrl;
            }
            // Force HTTPS
            ogImgUrl = ogImgUrl.replace(/^http:\/\//, 'https://');
            patchMeta('meta[property="og:image"]', 'content', ogImgUrl);
            patchMeta('meta[name="twitter:image"]', 'content', ogImgUrl);
          }

          // Canonical & og:url — fix [param] placeholder or create if missing
          var correctPath = '/travels/' + slug;
          var correctUrl = siteOrigin + correctPath;
          var ogUrlEl = document.querySelector('meta[property="og:url"]');
          if (ogUrlEl) { ogUrlEl.setAttribute('content', correctUrl); }
          else { ogUrlEl = document.createElement('meta'); ogUrlEl.setAttribute('property', 'og:url'); ogUrlEl.setAttribute('content', correctUrl); document.head.appendChild(ogUrlEl); }
          // Remove ALL existing canonical links to prevent duplicates (react-helmet-async may inject a second one)
          var canEls = document.querySelectorAll('link[rel="canonical"]');
          for (var ci = canEls.length - 1; ci >= 0; ci--) { canEls[ci].parentNode && canEls[ci].parentNode.removeChild(canEls[ci]); }
          var canEl = document.createElement('link'); canEl.rel = 'canonical'; canEl.href = correctUrl; document.head.appendChild(canEl);
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

          // og:type for travel pages
          patchMeta('meta[property="og:type"]', 'content', 'article');

          // Breadcrumb structured data for travel pages
          var breadcrumbName = travelName || 'Путешествие';
          upsertJsonLd('travel-breadcrumb-jsonld', {
            "@context": 'https://schema.org',
            "@type": 'BreadcrumbList',
            itemListElement: [
              {
                "@type": 'ListItem',
                position: 1,
                name: 'Главная',
                item: siteOrigin + '/',
              },
              {
                "@type": 'ListItem',
                position: 2,
                name: 'Путешествия',
                item: siteOrigin + '/travelsby',
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

        var url = data.travel_image_thumb_url;
        var updatedAt = data.updated_at;
        var id = data.id;

        if (!url) {
            var gallery = data.gallery;
            if (gallery && gallery.length) {
                var first = gallery[0];
                url = typeof first === 'string' ? first : first && first.url;
                updatedAt = typeof first === 'string' ? undefined : first.updated_at;
                id = typeof first === 'string' ? undefined : first.id;
            }
        }

        if (!url || typeof url !== 'string') return;

        // Skip preload if the LCP image is already rendered and loaded
        var existingLcp = document.querySelector('img[data-lcp]');
        if (existingLcp && existingLcp.complete && existingLcp.naturalWidth > 0) return;
        if (document.querySelector('link[data-travel-hero-preload="true"][as="image"]')) return;

        var isMobile = (window.innerWidth || 0) < 768;
        var quality = isMobile ? 35 : 45;
        var dpr = isMobile ? 1 : 1.5;

        // Match TravelDetailsHero.tsx: lcpWidths = isMobile ? [320, 400] : [480, 720]
        var widths = isMobile ? [320, 400] : [480, 720];

        // Build srcSet entries to match buildResponsiveImageProps()
        var srcSetParts = [];
        for (var i = 0; i < widths.length; i++) {
          var u = buildOptimizedUrl(url, widths[i], quality, updatedAt, id, dpr);
          if (u) srcSetParts.push(u + ' ' + widths[i] + 'w');
        }

        // The main src uses the widest breakpoint.
        var widest = widths[widths.length - 1];
        var preloadHref = buildOptimizedUrl(url, widest, quality, updatedAt, id, dpr);
        if (!preloadHref) return;

        try {
          var resolved = new URL(preloadHref, window.location.origin);
          var origin = resolved.origin;
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
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
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
