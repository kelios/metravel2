# PHASE 4: Performance Best Practices

**Status:** ✅ ACTIVE USE

---

## ✅ Images

- Prefer AVIF/WebP via `getPreferredImageFormat()`.
- Use `buildResponsiveImageProps()` to emit `srcSet` + `sizes`.
- Keep LCP hero eager, everything else lazy.
- Add URL versioning for cache busting.

## ✅ Rendering

- Keep TravelDetails sections behind lazy/progressive loaders.
- Avoid layout shift by reserving heights for heavy sections.
- Use memoization only where render churn is proven.

## ✅ Bundles

- Use route-level lazy loading for web.
- Keep heavy subcomponents behind `withLazy`.
- Warm up secondary chunks on idle for smoother navigation.

## ✅ Monitoring

- Initialize Web Vitals tracking in production.
- Capture LCP/FID/CLS/TTFB consistently.
- Log slow resources via resource timing when debugging.

---

**Owner:** Performance Phase 4
