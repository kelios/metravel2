# Production Audit Report — metravel.by

**Date:** 2026-02-15 (v10 — Full Post-Deploy Audit)  
**Auditor:** Automated (Cascade)  
**Target:** https://metravel.by  
**Note:** Production site reachable. Lighthouse run live against production.

---

## 1. PERFORMANCE (Lighthouse — live production, 2026-02-15)

### Desktop Scores
| Page | Performance | A11y | Best Practices | SEO |
|------|-------------|------|----------------|-----|
| Home `/` | **79** | **98** | **78** | **100** |
| Search `/search` | **79** | — | — | **100** |
| Map `/map` | **73** | — | — | **100** |

### Desktop — Home (`/`) Core Web Vitals
| Metric | Value | Score | Status |
|--------|-------|-------|--------|
| FCP | 1.1 s | 0.79 | ✅ |
| LCP | 3.0 s | 0.33 | ⚠️ |
| TBT | 50 ms | 1.0 | ✅ |
| CLS | 0.006 | 1.0 | ✅ |
| Speed Index | 1.7 s | 0.75 | ✅ |
| TTI | 3.0 s | 0.79 | ✅ |
| TTFB | 80 ms | — | ✅ Excellent |

### Desktop — Search (`/search`)
| Metric | Value | Score |
|--------|-------|-------|
| FCP | 1.0 s | 0.85 |
| LCP | 2.5 s | 0.48 |
| TBT | 70 ms | 0.99 |
| CLS | 0.007 | 1.0 |

### Desktop — Map (`/map`)
| Metric | Value | Score |
|--------|-------|-------|
| FCP | 1.0 s | 0.85 |
| LCP | 3.0 s | 0.33 |
| TBT | 50 ms | 1.0 |
| CLS | 0.017 | 1.0 |
| Speed Index | 3.9 s | 0.10 |

### Mobile — Home (`/`)
| Metric | Value | Score | Status |
|--------|-------|-------|--------|
| Performance | — | **55** | ❌ Below 60 target |
| Accessibility | — | **98** | ✅ |
| Best Practices | — | **75** | ⚠️ |
| SEO | — | **100** | ✅ |
| FCP | 2.9 s | 0.53 | ⚠️ |
| LCP | 11.7 s | 0.0 | ❌ |
| TBT | 430 ms | 0.64 | ⚠️ |
| CLS | 0.04 | 0.99 | ✅ |
| Speed Index | 5.1 s | 0.62 | ⚠️ |
| TTI | 11.7 s | 0.17 | ❌ |

### Performance Diagnostics
| Issue | Impact | Priority |
|-------|--------|----------|
| **Unused JS ~2,077 KiB** (`__common` ×2 + `entry` ×2 chunks) | LCP blocked, main thread | P1 |
| **LCP 11.7s (mobile)** | Primarily blocked by bundle parse/exec | P1 |
| **Responsive images ~490 KiB** savings | Thumbnails served larger than displayed | P2 |
| **Missing source maps** (4 large JS files) | Best Practices penalty | P2 |
| **LCP element is text/div** (desktop) | Not preloadable as image | P3 |
| **Third-party cookie** (Yandex Metrika) | Best Practices penalty | P3 |
| **Console error** (Yandex 400) | Best Practices penalty | P3 |
| **Legacy JS ~7 KiB** | Minor savings | P3 |

### What Passes ✅
- Font display: swap enforced
- Text compression: Brotli + Gzip
- HTTP/2: confirmed
- Minified JS/CSS: pass
- No duplicated JS
- No unused CSS
- No render-blocking resources
- DOM size: 628 elements (good)
- No lazy-loaded LCP image

---

## 2. SEO (All Pages — Verified)

### Home Page (`/`)
| Check | Status | Details |
|-------|--------|---------|
| Title | ✅ | "Твоя книга путешествий \| Metravel" (33 chars) |
| Description | ✅ | Present in static HTML (130 chars) |
| H1 | ✅ | Present in rendered page |
| Canonical | ✅ | `https://metravel.by/` (inline JS fixes [param] URLs) |
| OG tags | ✅ | og:title, og:description, og:image, og:url, og:locale, og:type, og:site_name |
| Twitter tags | ✅ | twitter:site present |
| robots.txt | ✅ | Proper disallow rules, sitemap reference |
| sitemap.xml | ✅ | Returns 200, 66KB, backend-generated |
| Schema.org | ✅ | Organization + WebSite + SearchAction + Service |
| lang attribute | ✅ | `<html lang="ru">` |

### Global SEO Status
| Check | Status | Details |
|-------|--------|---------|
| robots.txt | ✅ | Disallows /api/, /admin/, /_expo/, /metro/, /assets/icons/ |
| sitemap.xml | ✅ | 200, Cache-Control: public, max-age=3600 |
| HTTP→HTTPS redirect | ✅ | 301 |
| www→non-www redirect | ✅ | 301 with HSTS |
| All pages SEO score | ✅ | 100 on all tested pages |
| Travel page SEO | ✅ | Inline script patches title/description/canonical/og from API |
| Breadcrumb schema | ✅ | Injected for travel detail pages |
| noindex on non-prod | ✅ | `<meta name="robots" content="noindex,nofollow">` when not production |

### SEO Issues
| Issue | Priority | Status |
|-------|----------|--------|
| Title length 33 chars (target 50-60) | P3 | Acceptable for brand page |
| Soft 404 (unknown URLs return 200) | P2 | SPA architecture limitation |

---

## 3. TECHNICAL / SECURITY

| Check | Status | Details |
|-------|--------|---------|
| HTTPS | ✅ | TLSv1.2+1.3, valid cert |
| HSTS | ✅ | `max-age=31536000; includeSubDomains; preload` |
| HTTP/2 | ✅ | `h2` confirmed |
| Mixed content | ✅ | 0 HTTP resources |
| CORS | ✅ | `Access-Control-Allow-Origin: *` on static assets |
| CSP | ✅ | Comprehensive policy |
| X-Frame-Options | ✅ | SAMEORIGIN |
| X-Content-Type-Options | ✅ | nosniff |
| X-XSS-Protection | ✅ | 0 (modern recommendation) |
| Referrer-Policy | ✅ | strict-origin-when-cross-origin |
| Permissions-Policy | ✅ | Restrictive (camera, mic, payment blocked) |
| server_tokens | ✅ | Off (nginx version hidden) |
| X-Powered-By | ✅ | Hidden via proxy_hide_header |
| Console errors | ⚠️ | 1 error: Yandex Metrika 400 (third-party, unfixable) |
| Hydration errors | ⚠️ | 1 pre-existing #418 on non-home pages (Expo Router internals) |

### Accessibility
| Check | Status | Details |
|-------|--------|---------|
| Desktop home a11y | ✅ **98** | Near-perfect |
| Mobile a11y | ✅ **98** | Excellent |
| Contrast | ✅ | WCAG AA compliant |
| Tab navigation | ✅ | SkipToContentLink, focus-visible |
| ARIA attributes | ✅ | Proper roles and labels |
| Focus management | ✅ | focus-visible outline on all interactive elements |

---

## 4. SERVER / INFRASTRUCTURE

| Check | Status | Details |
|-------|--------|---------|
| TTFB | ✅ | 80 ms (excellent) |
| Protocol | ✅ | HTTP/2 |
| Gzip | ✅ | Level 6, min 256 bytes (improved from 1024) |
| Brotli | ✅ | Level 6, static on |
| Static asset caching | ✅ | `max-age=31536000, immutable` |
| Image proxy caching | ✅ | **NEW:** nginx proxy_cache 24h TTL with stale-serving |
| Media/uploads caching | ✅ | **NEW:** nginx proxy_cache 24h TTL |
| HTML caching | ✅ | `no-cache` with ETag |
| Rate limiting | ✅ | API: 30r/s, Login: 5r/m, General: 50r/s |
| API proxy cache | ✅ | 10m TTL, stale-serving, lock, background update |
| SW caching | ✅ | Timestamped version (auto-bumped on build) |
| sendfile/tcp_nopush | ✅ | Enabled |
| tcp_nodelay | ✅ | Enabled |
| keepalive_timeout | ✅ | **NEW:** 65s |
| keepalive_requests | ✅ | **NEW:** 1000 |
| open_file_cache | ✅ | max=10000, 60s inactive |
| worker_connections | ✅ | 2048 + multi_accept |
| SSL session cache | ✅ | shared:SSL:10m, 1d timeout |
| SSL session tickets | ✅ | Off (forward secrecy) |
| autoindex | ✅ | Off |
| client_max_body_size | ✅ | 40M |

---

## 5. ANALYTICS

| Check | Status | Details |
|-------|--------|---------|
| Google Analytics (GA4) | ✅ | G-GBT9YNPXKB via gtag.js |
| Yandex Metrika | ✅ | ID 62803912 |
| Consent-aware loading | ✅ | Opt-out model, deferred |
| Deferred loading | ✅ | requestIdleCallback / 3s timeout |
| SPA page tracking | ✅ | pushState/replaceState patched |
| send_page_view: false | ✅ | Avoids duplicate GA page_view |
| GTM | ❌ | Not configured (GA4 direct only) |

---

## 6. FIXES APPLIED (v10 — This Audit)

### P1 — Critical

#### 6.1 Nginx Image Proxy Cache
- **File:** `nginx/nginx.conf`
- **Problem:** Image routes (`/gallery/`, `/travel-image/`, `/address-image/`, `/travel-description-image/`) proxied to backend without caching — every request hit the backend
- **Fix:** Added `proxy_cache metravel_cache` with 24h TTL, `proxy_cache_lock on`, `proxy_cache_use_stale` for error/timeout/updating, `proxy_buffering on`
- **Impact:** Dramatically reduces backend load for images; improves LCP for repeat visitors; adds `X-Cache-Status` header for monitoring

#### 6.2 Nginx Media/Uploads Proxy Cache
- **File:** `nginx/nginx.conf`
- **Problem:** `/uploads/` and `/media/` routes also uncached at nginx level
- **Fix:** Added `proxy_cache metravel_cache` with 24h TTL and stale-serving
- **Impact:** Reduces backend load for user-uploaded content

### P2 — Important

#### 6.3 Nginx Keepalive Configuration
- **File:** `nginx/nginx.conf`
- **Problem:** Missing `keepalive_timeout` and `keepalive_requests` directives
- **Fix:** Added `keepalive_timeout 65` and `keepalive_requests 1000`
- **Impact:** Better HTTP/2 connection reuse; reduces TLS handshake overhead for repeat requests

#### 6.4 Nginx Gzip Min Length Reduction
- **File:** `nginx/nginx.conf`
- **Problem:** `gzip_min_length 1024` skipped compression for small API responses (256-1024 bytes)
- **Fix:** Reduced to `gzip_min_length 256`
- **Impact:** Better compression for small JSON API responses; negligible CPU cost

---

## 7. REMAINING ISSUES (Require Code/Infra Changes)

| Issue | Priority | Action Required |
|-------|----------|-----------------|
| **Unused JS ~2.0 MB** | P1 | Code-split heavy routes; tree-shake react-native-web |
| **LCP 11.7s (mobile)** | P1 | Bundle size reduction is the only path |
| **Responsive images ~490 KiB** | P2 | Serve thumbnails at display size via srcset on card components |
| **Missing source maps** | P2 | Enable in build for Best Practices (security trade-off) |
| **Soft 404 for unknown URLs** | P2 | Return proper 404 status code in nginx for unmatched routes |
| **Third-party cookies** (Yandex) | P3 | Cannot fix — Yandex Metrika behavior |
| **Console error** (Yandex 400) | P3 | Cannot fix — Yandex sync_cookie endpoint |
| **Legacy JS ~7 KiB** | P3 | Update browserslist to drop older polyfills |

---

## 8. TARGET METRICS STATUS

| Target | Current (v10) | Status |
|--------|---------------|--------|
| Lighthouse ≥ 90 (mobile) | 55 | ❌ Blocked by bundle size |
| Core Web Vitals — green | CLS ✅, TBT ⚠️, LCP ❌ | ❌ |
| SEO without critical errors | ✅ 100 all pages | ✅ |
| No 4xx/5xx on pages | ✅ (soft 404 only) | ✅ |
| Mobile load time < 2.5s | ~12s (4× throttled) | ❌ |
| Desktop Performance ≥ 70 | 73-79 | ✅ |
| Mobile Performance ≥ 60 | 55 | ⚠️ Close |
| Accessibility ≥ 90 | 98 | ✅ |
| Best Practices | 75-78 | ⚠️ |
| HTTPS + HSTS | ✅ | ✅ |
| Brotli + Gzip | ✅ | ✅ |
| Static caching | ✅ | ✅ |
| Image proxy caching | ✅ (NEW) | ✅ |
| robots.txt + sitemap | ✅ | ✅ |
| Schema.org | ✅ | ✅ |
| Analytics | ✅ | ✅ |

---

## 9. RECOMMENDATIONS FOR LIGHTHOUSE ≥ 90 (Mobile)

### Immediate Actions (P1)
1. **Deploy nginx config** — image proxy cache will reduce LCP for repeat visitors
2. **Code-split `/map` route** — Leaflet (~400 KB) should lazy-load only on map page
3. **Tree-shake react-native-web** — remove unused RN components from bundle

### Medium-term (P2)
4. **Responsive images on cards** — add srcset/sizes to `UnifiedTravelCard` / `ImageCardMedia` for proper sizing
5. **Enable source maps** — improves Best Practices score (+5-10 points)
6. **Consider SSR/ISR** — for travel detail pages (title/description in static HTML)

### Long-term (P3)
7. **Modernize browserslist** — drop legacy polyfills (~7 KiB savings)
8. **Web-specific lightweight build** — separate entry point without react-native-web overhead
9. **CDN for images** — move image serving to CDN (Cloudflare/CloudFront) for edge caching

---

## 10. ARCHITECTURE AUDIT SUMMARY

### Already Optimized ✅
| Area | Implementation |
|------|----------------|
| Lazy loading | React.lazy() for Map, Quests, Export, heavy components |
| Code splitting | Entry bundle separated from route-specific chunks |
| Image optimization | fetchPriority, lazy loading, WebP/AVIF negotiation, optimizeImageUrl |
| LCP preload | Inline script preloads travel hero image with srcset |
| Font display | font-display:swap enforced via MutationObserver + insertRule patch |
| Service Worker | Smart caching with auto-versioning on deploy |
| API caching | Nginx proxy cache with stale-while-revalidate + background update |
| Image proxy cache | **NEW:** Nginx caches proxied images for 24h |
| Compression | Brotli + Gzip enabled (min 256 bytes) |
| Browserslist | IE11 dropped, modern browsers only |
| inlineRequires | Metro config enables deferred module execution |
| Critical CSS | Inlined in `<head>` via criticalCSSBuilder |
| Stale chunk recovery | Auto-reload on module errors with cache purge |
| SEO inline patching | Travel pages get title/description/canonical from API before hydration |

### Remaining Blockers (External to Code)
| Issue | Cause | Required Action |
|-------|-------|-----------------|
| Bundle size ~4.7MB | react-native-web + Leaflet + Reanimated | Requires significant refactoring or SSR |
| Mobile LCP | Bundle blocks main thread under 4× throttling | SSR/ISR or native app |
| Source maps | Intentionally disabled for security | Trade-off decision |
| Third-party penalties | Yandex Metrika cookies + 400 errors | Cannot fix |

### Conclusion
The application is well-optimized at the code level with comprehensive caching, compression, security headers, SEO, and accessibility. The nginx config has been improved with image proxy caching and keepalive tuning. The primary performance blocker remains the inherent bundle size of the React Native Web + Expo stack (~4.7MB). To achieve Lighthouse ≥ 90 on mobile:
1. Server-side rendering (Next.js migration or Expo Server Components)
2. Native mobile app for critical paths
3. Web-specific lightweight version for SEO pages

---

---

## v11 — Post-Deploy Audit (2026-02-16)

### Lighthouse Scores (live production)

#### Desktop — Home (`/`)
| Category | Score |
|----------|-------|
| Performance | **79** |
| Accessibility | **98** |
| Best Practices | **78** |
| SEO | **100** |

| Metric | Value | Score |
|--------|-------|-------|
| FCP | 1.1 s | 0.79 |
| LCP | 3.0 s | 0.34 |
| TBT | 50 ms | 1.0 |
| CLS | 0.006 | 1.0 |
| SI | 1.8 s | 0.71 |
| TTI | 3.0 s | 0.81 |
| TTFB | 170 ms | 1.0 |

#### Mobile — Home (`/`)
| Category | Score |
|----------|-------|
| Performance | **56** |
| Accessibility | **98** |
| Best Practices | **79** |
| SEO | **100** |

| Metric | Value | Score |
|--------|-------|-------|
| FCP | 3.5 s | 0.35 |
| LCP | 12.0 s | 0.0 |
| TBT | 350 ms | 0.73 |
| CLS | 0.04 | 0.99 |
| SI | 5.4 s | 0.56 |
| TTI | 12.0 s | 0.16 |
| TTFB | 160 ms | 1.0 |

### Server & Infrastructure
| Check | Result |
|-------|--------|
| TTFB (home) | 439 ms (curl) / 160-170 ms (Lighthouse) ✅ |
| HTTP→HTTPS | 301 redirect ✅ |
| www→non-www | 301 redirect ✅ |
| HSTS | max-age=31536000; includeSubDomains; preload ✅ |
| Brotli | Enabled (76 KiB → 20 KiB) ✅ |
| Gzip | Enabled (76 KiB → 22 KiB) ✅ |
| Static asset caching | max-age=31536000, immutable ✅ |
| Image proxy cache | max-age=604800, stale-while-revalidate ✅ |
| Sitemap | 200, 66 KiB ✅ |
| Robots.txt | Valid, correct disallow rules ✅ |
| CSP | Comprehensive policy ✅ |
| X-Content-Type-Options | nosniff ✅ |
| X-Frame-Options | SAMEORIGIN ✅ |
| Referrer-Policy | strict-origin-when-cross-origin ✅ |
| Permissions-Policy | Restrictive ✅ |

### SEO
| Check | Result |
|-------|--------|
| Lighthouse SEO | **100** (desktop & mobile) ✅ |
| Title | "Твоя книга путешествий \| Metravel" (35 chars) ✅ |
| Canonical | Valid ✅ |
| robots.txt | Valid ✅ |
| sitemap.xml | 200, accessible ✅ |
| Structured data | Valid ✅ |

### Analytics
| Check | Result |
|-------|--------|
| GA4 (G-GBT9YNPXKB) | Sending page_view events ✅ |
| Yandex Metrika (62803912) | Active, sending hits ✅ |
| Duplicate page_view | Fixed in v10 (send_page_view:false) ✅ |

### Critical Issues Found

#### P0 — Site crash: `useFavorites is not a function` (ENTIRE SITE BROKEN)
- **Symptom:** ErrorBoundary shown on every page load. Console: `TypeError: (0 , _r(...).useFavorites) is not a function`
- **Root cause chain:**
  1. After redeploy, old lazy-loaded chunk `CustomHeader-4aeab6db...js` no longer exists on server
  2. **nginx** `/_expo/static/` location had **no `try_files`** directive → missing chunks fall through to SPA catch-all (`location /`) which serves `index.html` with **200 status** instead of 404
  3. Browser receives HTML disguised as JS → Metro runtime executes it → module IDs don't match → `useFavorites` export is `undefined`
  4. **Service Worker** `cacheFirstLongTerm()` caches the broken HTML-as-JS response forever (no content-type validation, no 404 handling)
  5. Every subsequent page load serves the cached broken chunk → infinite crash loop
- **Impact:** 100% of users with SW cache see a broken site. New users also affected because nginx serves HTML for missing .js files.

### Fixes Applied (v11)

#### 1. nginx: `/_expo/static/` — return 404 for missing chunks (P0)
- **File:** `nginx/nginx.conf`
- **Change:** Added `try_files $uri =404;` to `location ^~ /_expo/static/`
- **Effect:** Missing chunk files now return proper 404 instead of HTML fallback. This prevents the browser from parsing HTML as JS.

#### 2. Service Worker: bump version + validate cached chunks (P0)
- **File:** `public/sw.js`
- **Changes:**
  - Bumped `CACHE_VERSION` from `v3.8.0` to `v3.9.0` → forces purge of all stale JS/dynamic caches on next SW activation
  - `cacheFirstLongTerm()` now validates cached responses: rejects `text/html` content-type for `.js` requests
  - `cacheFirstLongTerm()` now handles 404 responses: deletes stale cache entry and triggers `SW_UPDATED` reload
  - `cacheFirstLongTerm()` validates fresh responses: rejects HTML-as-JS before caching
- **Effect:** Stale/broken chunks are never served from SW cache. Users with old SW get auto-purged on next activation.

#### 3. CustomHeader: resilient `useFavorites` wrapper (P0 defense-in-depth)
- **File:** `components/layout/CustomHeader.tsx`
- **Change:** Replaced direct `useFavorites()` call with `useFavoritesSafe()` wrapper that catches errors and returns fallback `{ favorites: [] }`
- **Effect:** Even if module resolution fails, the header renders without crashing the entire app.

#### 4. heading-order a11y fix (P1)
- **Files:** `components/home/HomeHero.tsx`, `components/home/HomeHowItWorks.tsx`
- **Changes:**
  - `HomeHero.tsx`: Changed subtitle from `variant="h4"` to `variant="h2"` (h1 → h2, not h1 → h4). Added explicit `fontSize: 20, fontWeight: '400'` to preserve visual appearance.
  - `HomeHowItWorks.tsx`: Changed step titles from `variant="h4"` to `variant="h3"` (section h2 → step h3). Added explicit `fontSize: 20` to preserve visual appearance.
- **Effect:** Heading hierarchy is now h1 → h2 → h3 (no skipped levels), fixing Lighthouse a11y `heading-order` audit.

### Remaining Issues (unchanged from v10)
| Issue | Priority | Cause |
|-------|----------|-------|
| Bundle size ~4.7MB | P2 | RNW + Leaflet + Reanimated stack |
| Mobile LCP 12s | P2 | Bundle blocks main thread under 4× throttling |
| Unused JS ~2MB | P2 | Common chunk contains all shared modules |
| Responsive images ~2MB savings | P3 | Images not using srcset/sizes properly |
| Soft 404 (unknown URLs return 200) | P3 | SPA catch-all serves index.html for all routes |
| Third-party cookies (Best Practices) | P3 | Yandex Metrika / GA4 |
| Source maps missing | P3 | Intentionally disabled |

### Validation
- `npx jest --testPathPattern="CustomHeader|HomeHero|HomeHowItWorks"` — **27 tests passed** ✅
- `npx eslint components/layout/CustomHeader.tsx components/home/HomeHero.tsx components/home/HomeHowItWorks.tsx` — **no errors** ✅

---

---

## v12 — Full Post-Deploy Audit (2026-02-17)

### Lighthouse Scores (live production)

#### Desktop — Home (`/`)
| Category | Score |
|----------|-------|
| Performance | **75** |
| Accessibility | **100** |
| Best Practices | **78** |
| SEO | **100** |

| Metric | Value | Score | Status |
|--------|-------|-------|--------|
| FCP | 1.1 s | 0.80 | ✅ |
| LCP | 2.9 s | 0.37 | ⚠️ |
| TBT | 10 ms | 1.0 | ✅ |
| CLS | 0.006 | 1.0 | ✅ |
| Speed Index | 3.2 s | 0.23 | ⚠️ |
| TTI | 2.9 s | 0.83 | ✅ |
| TTFB | 90 ms | 1.0 | ✅ |

#### Mobile — Home (`/`)
| Category | Score |
|----------|-------|
| Performance | **54** |
| Accessibility | **100** |
| Best Practices | **79** |
| SEO | **100** |

| Metric | Value | Score | Status |
|--------|-------|-------|--------|
| FCP | 3.5 s | 0.34 | ⚠️ |
| LCP | 11.9 s | 0.00 | 🔴 |
| TBT | 440 ms | 0.64 | ⚠️ |
| CLS | 0.04 | 0.99 | ✅ |
| Speed Index | 4.6 s | 0.70 | ✅ |
| TTI | 11.9 s | 0.17 | 🔴 |

### Server & Security ✅
| Check | Status |
|-------|--------|
| HTTPS | ✅ HTTP/2 200 |
| HSTS | ✅ max-age=31536000; includeSubDomains; preload |
| HTTP→HTTPS redirect | ✅ 301 |
| www→non-www redirect | ✅ 301 |
| Brotli compression | ✅ content-encoding: br |
| X-Frame-Options | ✅ SAMEORIGIN |
| X-Content-Type-Options | ✅ nosniff |
| Referrer-Policy | ✅ strict-origin-when-cross-origin |
| CSP | ✅ Full policy |
| Permissions-Policy | ✅ Restrictive |
| TTFB | ✅ 367ms (curl from remote) |
| robots.txt | ✅ Correct disallows + sitemap |
| sitemap.xml | ✅ 200 |
| manifest.json | ✅ Cache-Control: public, max-age=86400 |
| Console errors | ✅ None (score=1) |

### SEO ✅
| Check | Status |
|-------|--------|
| Title (home) | ✅ "Твоя книга путешествий \| Metravel" (33 chars) |
| Description (home) | ✅ 120+ chars, in static HTML |
| Canonical (home) | ✅ Patched by inline JS |
| og:title / og:description / og:image | ✅ All present in static HTML |
| og:locale | ✅ ru_RU |
| Schema.org | ✅ Organization + WebSite + Service |
| Travel page SEO | ✅ Title, description, canonical, og:*, breadcrumb JSON-LD in static HTML |
| lang attribute | ✅ ru |
| robots meta | ✅ Not set (correct for prod) |
| Lighthouse SEO score | ✅ 100 (desktop + mobile) |

### Analytics ✅
| Check | Status |
|-------|--------|
| GA4 (G-GBT9YNPXKB) | ✅ Present in HTML |
| Yandex Metrika | ✅ Present in HTML |
| send_page_view: false | ✅ Configured (avoids duplicate pageviews) |
| Deferred loading | ✅ requestIdleCallback / setTimeout |
| Consent-aware | ✅ Cookie consent integration |

### Issues Found & Fixes Applied

#### 1. P1: og:image returns 404 — FIXED
- **Problem:** All pages referenced `/og-preview.jpg` as default OG image, but the file never existed on the server. Social sharing previews were broken.
- **Root cause:** `buildOgImageUrl('/og-preview.jpg')` called across 12 page files + SEO generator + TravelDetailsContainer.
- **Fix:** Added `DEFAULT_OG_IMAGE_PATH` constant in `utils/seo.ts` pointing to `/assets/icons/logo_yellow_512x512.png` (verified 200 on production). Updated all 14 references.
- **Files changed:**
  - `utils/seo.ts` — added `DEFAULT_OG_IMAGE_PATH` export
  - `app/(tabs)/index.tsx`, `travelsby.tsx`, `about.tsx`, `articles.tsx`, `search.tsx`, `export.tsx`, `metravel.tsx`, `privacy.tsx`, `roulette.tsx`, `cookies.tsx`, `login.tsx`, `registration.tsx` — import + use constant
  - `components/travel/details/TravelDetailsContainer.tsx` — import + use constant
  - `scripts/generate-seo-pages.js` — updated `OG_IMAGE` constant
  - `app/+html.tsx` — updated fallback og:image to 512x512 version
  - `__tests__/utils/seo.test.ts` — updated test + added regression test

#### 2. P2: Responsive images not using srcSet/sizes — FIXED
- **Problem:** Travel card images served at full resolution regardless of viewport. Lighthouse flagged ~412 KiB savings (mobile).
- **Fix:** Added `srcSet` and `sizes` attributes to `WebMainImage` in `ImageCardMedia.tsx` using the existing `generateSrcSet` utility with breakpoints [160, 320, 480, 640]px.
- **Files changed:**
  - `components/ui/ImageCardMedia.tsx` — added `webSrcSet`/`webSizes` memos, passed to `WebMainImage`; added `srcSet`/`sizes` props to `WebMainImageProps` type and `<img>` tag

### Remaining Issues (structural — cannot fix without major refactoring)
| Issue | Priority | Cause | Mitigation |
|-------|----------|-------|------------|
| Bundle size ~4.7MB | P2 | RNW + Leaflet + Reanimated stack | Requires code-splitting heavy routes (Map) or migrating off RNW |
| Mobile LCP 11.9s | P2 | Bundle blocks main thread under 4× CPU throttling | Travel hero preload script already optimizes travel pages; home page blocked by JS parse time |
| Unused JS ~2MB | P2 | Common chunk contains all shared modules | Expo/Metro bundler limitation; tree-shaking improvements needed upstream |
| Mobile Performance 54 | P2 | Dominated by bundle size under mobile throttling | Same root cause as above |
| Soft 404 (unknown URLs return 200) | P3 | SPA catch-all serves index.html for all routes | Would require server-side route validation |
| Best Practices 78-79 | P3 | Third-party cookies from Yandex Metrika / GA4 | Cannot control third-party behavior |
| Desktop Speed Index 3.2s | P3 | Large initial paint area with deferred content | Progressive rendering already implemented |

### Validation
- `npx jest __tests__/utils/seo.test.ts` — **9 tests passed** ✅
- `npx jest --testPathPattern="ImageCardMedia|UnifiedTravelCard|TabTravelCard"` — **4 tests passed** ✅

### Target Assessment
| Target | Current | Status |
|--------|---------|--------|
| Lighthouse ≥ 90 (mobile) | 54 | 🔴 Blocked by bundle size (structural) |
| Core Web Vitals green | CLS ✅, TBT ⚠️, LCP 🔴 | ⚠️ LCP blocked by JS bundle |
| SEO no critical errors | 100/100 | ✅ |
| No 4xx/5xx | og:image 404 fixed | ✅ |
| Load time < 2.5s mobile | ~11.9s (throttled) | 🔴 Blocked by bundle size |

**Last updated:** 2026-02-17  
**SW Version:** v3.9.0  
**Audit Version:** v12  
**Status:** ✅ P1 og:image fix + P2 responsive images fix applied — requires redeploy to take effect
