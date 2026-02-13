# Production Audit Report — metravel.by

**Date:** 2026-02-13  
**Auditor:** Automated (Cascade)  
**Target:** https://metravel.by

---

## 1. PERFORMANCE (Lighthouse)

### Desktop — Home (`/`)
| Metric | Value | Score | Status |
|--------|-------|-------|--------|
| Performance | — | **81** | ⚠️ Below 90 target |
| Accessibility | — | **100** | ✅ |
| Best Practices | — | **74** | ⚠️ |
| SEO | — | **100** | ✅ |
| FCP | 1.1 s | 0.84 | ✅ |
| LCP | 2.9 s | 0.37 | ⚠️ |
| TBT | 50 ms | 1.0 | ✅ |
| CLS | 0.006 | 1.0 | ✅ |
| Speed Index | 1.6 s | 0.80 | ✅ |
| TTFB | 160 ms | 1.0 | ✅ |

### Mobile — Home (`/`)
| Metric | Value | Score | Status |
|--------|-------|-------|--------|
| Performance | — | **55** | ❌ Below 90 target |
| Accessibility | — | **100** | ✅ |
| Best Practices | — | **93** | ✅ |
| SEO | — | **100** | ✅ |
| FCP | 3.5 s | 0.35 | ❌ |
| LCP | 12.1 s | 0.0 | ❌ |
| TBT | 440 ms | 0.64 | ⚠️ |
| CLS | 0.04 | 0.99 | ✅ |
| Speed Index | 4.1 s | 0.79 | ⚠️ |
| TTFB | 100 ms | 1.0 | ✅ |

### Desktop — Search (`/search`)
| Metric | Value | Score | Status |
|--------|-------|-------|--------|
| Performance | — | **77** | ⚠️ |
| SEO | — | **100** | ✅ |
| FCP | 1.0 s | 0.87 | ✅ |
| LCP | 2.8 s | 0.38 | ⚠️ |
| TBT | 10 ms | 1.0 | ✅ |
| CLS | 0.009 | 1.0 | ✅ |

### Key Performance Issues
| Issue | Impact | Priority |
|-------|--------|----------|
| **Unused JS ~2 MB** (`__common` + `entry` chunks) | LCP +5.8s (mobile) | P1 |
| **HTTP→HTTPS redirect** (unavoidable for http:// visitors) | +2.2s desktop, +10.6s mobile (throttled) | P2 |
| **Responsive images** — oversized images served | Est. savings 2,558 KiB (desktop), 781 KiB (mobile) | P2 |
| **Legacy JS** — 7 KiB of polyfills for modern browsers | Minor | P3 |
| **Cache TTL** — 5 resources with suboptimal cache | Minor | P3 |

---

## 2. SEO

### Home Page (`/`)
| Check | Status | Details |
|-------|--------|---------|
| Title | ✅ | "Твоя книга путешествий \| Metravel" (33 chars) |
| Description | ⚠️ | 77 chars — below 120-160 recommended range |
| H1 | ❌ **FIXED** | Was missing — `ResponsiveText` rendered `<div>` not `<h1>`. Now renders actual `<h1>` |
| Canonical | ✅ | `https://metravel.by/` |
| OG tags | ✅ | title, description, image, url, type all present |
| Twitter cards | ✅ | summary_large_image |
| robots.txt | ✅ | Proper disallow rules, sitemap reference |
| sitemap.xml | ✅ | Returns 200, 66 KB |
| Schema.org | ✅ | Organization + WebSite in `+html.tsx` |
| Images alt | ⚠️ | 1 image without alt on home (hero image has alt in component) |

### Travel Detail Pages
| Check | Status | Details |
|-------|--------|---------|
| Title | ✅ | `{travel.name} \| MeTravel` |
| Description | ✅ | Stripped HTML, max 160 chars |
| Canonical | ✅ | `/travels/{slug}` or `/travels/{id}` |
| Schema.org Article | ✅ | headline, description, image, author, publisher, dates |
| Schema.org BreadcrumbList | ✅ **ADDED** | Home > Поиск > [Travel Name] |
| OG type | ✅ | `article` |

### Search Page
| Check | Status | Details |
|-------|--------|---------|
| Title | ✅ | "Поиск путешествий \| Metravel" |
| Description | ✅ | 72 chars |
| Canonical | ✅ | `/search` |

---

## 3. TECHNICAL

| Check | Status | Details |
|-------|--------|---------|
| HTTPS | ✅ | TLSv1.3, valid cert (GlobalSign, expires Sep 2026) |
| HSTS | ✅ | `max-age=31536000; includeSubDomains; preload` |
| HTTP/2 | ✅ | Enabled |
| Mixed content | ✅ | No HTTP resources detected |
| CORS | ✅ | `Access-Control-Allow-Origin: *` on main server |
| CSP | ✅ | Comprehensive policy with whitelisted sources |
| X-Frame-Options | ✅ | SAMEORIGIN |
| X-Content-Type-Options | ✅ | nosniff |
| Referrer-Policy | ✅ | strict-origin-when-cross-origin |
| Permissions-Policy | ✅ | Restrictive (camera, microphone, payment blocked) |
| Console errors | ⚠️ | 3-5 errors: stale JS chunk 404, manifest.json 404, Yandex WSS blocked |
| Stale JS chunk | ⚠️ | `Home-68ad...js` returns 404 — old deploy artifact on server |
| manifest.json | ⚠️ | Returns 200 via curl but 404 in browser (possible SW cache issue) |
| Hydration | ⚠️ | Pre-existing #418 error on non-home pages (Expo Router internals) |
| 4xx/5xx on pages | ✅ | All main pages return 200 |
| Redirects | ✅ | Clean single-hop: HTTP→HTTPS, www→non-www |

### Accessibility (a11y)
| Check | Status | Details |
|-------|--------|---------|
| Lighthouse a11y score | ✅ **100** | Perfect score |
| aria-attributes | ✅ | Proper roles on interactive elements |
| Tab navigation | ✅ | SkipToContentLink, focus-visible styles |
| Contrast | ✅ | Passes WCAG AA |

---

## 4. SERVER

| Check | Status | Details |
|-------|--------|---------|
| TTFB | ✅ | 100-190 ms (excellent) |
| Gzip | ✅ | Enabled, level 6, min 1024 bytes |
| Brotli | ✅ | Configured in nginx |
| Static asset caching | ✅ | `max-age=31536000, immutable` for `/_expo/static/` |
| HTML caching | ✅ | `no-cache` (correct for SPA) |
| ETag | ✅ | Present on HTML responses |
| Rate limiting | ✅ | API: 30r/s, Login: 5r/m, General: 50r/s |
| server_tokens | ❌ **FIXED** | Was leaking `nginx/1.24.0` in redirect responses. Now `server_tokens off` at http level |
| SSL config | ✅ | Modern ciphers, TLSv1.2+1.3, session tickets off |
| AVIF/WebP serving | ✅ | Content negotiation via `Accept` header |
| API proxy | ✅ | Buffering, timeouts, rate limiting configured |

---

## 5. ANALYTICS

| Check | Status | Details |
|-------|--------|---------|
| Google Analytics (GA4) | ✅ | `G-GBT9YNPXKB` loaded via `googletagmanager.com/gtag/js` |
| Yandex Metrika | ✅ | Loaded via `mc.yandex.ru/metrika/tag.js` |
| Consent-aware loading | ✅ | Opt-out model, respects `metravel_consent_v1` localStorage |
| Deferred loading | ✅ | Analytics loaded via `requestIdleCallback` / 3s timeout |
| SPA page tracking | ✅ | `history.pushState`/`replaceState` patched for pageview tracking |
| Event tracking | ✅ | `queueAnalyticsEvent` used throughout (HomeViewed, HomeClick_*, etc.) |
| GTM | ❌ | Not configured (only GA4 direct) — not critical |

---

## 6. FIXES APPLIED

### P1 — Critical

#### 6.1 Semantic HTML Headings (SEO)
- **File:** `components/layout/ResponsiveText.tsx`
- **Problem:** `ResponsiveText` with `variant="h1"` rendered as `<div>` on web — no actual `<h1>` element for SEO crawlers
- **Fix:** On web, h1-h4 variants now render inside actual HTML heading elements (`<h1>`-`<h4>`) using `React.createElement`. Browser heading defaults are reset with `display: contents` so RN styles are preserved.
- **Impact:** All pages using `ResponsiveText` (home, search, about, etc.) now have proper heading hierarchy

#### 6.2 nginx server_tokens Leak
- **File:** `nginx/nginx.conf`
- **Problem:** Redirect server blocks (HTTP→HTTPS, www→non-www) exposed `nginx/1.24.0` version
- **Fix:** Added `server_tokens off` at `http {}` block level + explicit in redirect blocks
- **Impact:** Server version no longer leaked in any response

### P2 — Important

#### 6.3 PWA Manifest — 512x512 Icon
- **File:** `public/manifest.json` + `public/assets/icons/logo_yellow_512x512.png`
- **Problem:** Missing 512x512 icon required for PWA installability (Lighthouse best practices)
- **Fix:** Generated 512x512 icon from splash screen source, added to manifest with `maskable` purpose on 192x192 icon
- **Impact:** Improves Lighthouse best-practices score

#### 6.4 BreadcrumbList Schema.org
- **Files:** `utils/travelDetailsSecure.ts`, `components/travel/details/TravelDetailsContainer.tsx`
- **Problem:** Travel detail pages had Article schema but no BreadcrumbList
- **Fix:** Added `createBreadcrumbJsonLd()` function producing Home > Поиск > [Travel Name] breadcrumbs, injected as `<script type="application/ld+json">` in SEO head
- **Impact:** Enables breadcrumb rich results in Google Search

---

## 7. REMAINING ISSUES (Not Fixed — Require Server/Build Changes)

| Issue | Priority | Action Required |
|-------|----------|-----------------|
| **Unused JS ~2 MB** | P1 | Requires Expo/Metro bundle splitting optimization. Consider `expo-router` async routes, tree-shaking audit, or moving heavy deps (leaflet, dompurify) to dynamic imports |
| **Stale JS chunk 404** (`Home-68ad...js`) | P1 | Clean old build artifacts from server: `rm -rf /usr/local/metravel/static/dist/_expo/static/js/web/Home-68ad*` |
| **LCP 12.1s (mobile)** | P1 | Primarily caused by unused JS blocking main thread. Bundle size reduction is the key fix |
| **manifest.json 404 in browser** | P2 | Likely stale Service Worker cache serving old response. Deploy new SW version or add `skipWaiting()` |
| **Home description too short** (77 chars) | P3 | Extend to 120-160 chars for better SERP snippets |
| **Legacy JS polyfills** (7 KiB) | P3 | Configure Babel targets to exclude IE11 polyfills |

---

## 8. VERIFICATION

- **TypeScript:** ✅ Compiles cleanly (`tsc --noEmit`)
- **Tests:** ✅ 444 suites, 3799 tests passed
- **No regressions** introduced by fixes

---

## 9. TARGET METRICS STATUS

| Target | Current | Status |
|--------|---------|--------|
| Lighthouse ≥ 90 (mobile) | 55 | ❌ Blocked by bundle size |
| Core Web Vitals — green | CLS ✅, TBT ⚠️, LCP ❌ | ⚠️ Partial |
| SEO without critical errors | ✅ (after heading fix) | ✅ |
| No 4xx/5xx on pages | ✅ | ✅ |
| Mobile load time < 2.5s | ~12s (throttled) | ❌ Blocked by bundle size |

### Path to Lighthouse ≥ 90 (Mobile)

The primary blocker is **bundle size** (~2 MB unused JS). To reach the target:

1. **Code-split heavy routes** — ensure `/map`, `/quests`, `/export` chunks don't load on home/search
2. **Lazy-load Leaflet** — only on map page (currently ~400 KB in common chunk)
3. **Lazy-load DOMPurify** — already lazy but verify it's not in common chunk
4. **Tree-shake react-native-web** — ensure unused RN components are eliminated
5. **Responsive images** — serve appropriately sized images via `srcset` or CDN resize
6. **Clean stale artifacts** on server after each deploy
