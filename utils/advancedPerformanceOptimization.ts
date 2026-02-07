/**
 * Advanced performance optimizations for critical metrics
 * Target: LCP < 2.5s, FCP < 1.8s, TBT < 200ms, CLS < 0.1, SI < 3.4s
 */

import { Platform } from 'react-native';

// 1. Critical Resource Preloading
export function preloadCriticalResources() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  // No-op: By the time this runs (via requestIdleCallback), the LCP image is
  // already loaded. Adding a <link rel="preload"> for an already-fetched resource
  // triggers Chrome's "preloaded but not used" warning. Early preloading is
  // handled by the inline script in +html.tsx (getTravelHeroPreloadScript).
}

// 2. Optimize LCP with Resource Hints
export function addResourceHints() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  const ensureLink = (rel: string, href: string, attrs: Record<string, string> = {}) => {
    if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    Object.entries(attrs).forEach(([key, value]) => {
      if (value) {
        (link as any)[key] = value;
      }
    });
    document.head.appendChild(link);
  };

  const lcpImg =
    (document.querySelector('img[data-lcp]') as HTMLImageElement | null) ||
    (document.querySelector('img[src*="travel"]') as HTMLImageElement | null)

  const href = lcpImg ? (lcpImg.currentSrc || lcpImg.src) : ''
  const origin = (() => {
    try {
      return href ? new URL(href).origin : null
    } catch {
      return null
    }
  })()

  const domains = ['//metravel.by', '//cdn.metravel.by']
  if (origin) {
    try {
      domains.push('//' + new URL(origin).host)
    } catch {
      // noop
    }
  }

  Array.from(new Set(domains)).forEach((domain) => {
    ensureLink('dns-prefetch', domain)
  })

  if (origin) {
    ensureLink('preconnect', origin, { crossOrigin: 'anonymous' })
  }
}

// 3. Critical CSS Inline Optimization
export const ultraCriticalCSS = `
/* Ultra-critical CSS for LCP optimization */
body{margin:0;padding:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;contain:layout style paint}
.hero-section{width:100%;aspect-ratio:16/9;background:#000;min-height:300px;contain:layout style paint}
.hero-image{width:100%;height:100%;object-fit:cover;display:block;content-visibility:auto}
.skeleton{background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:200% 100%;animation:loading 1.5s infinite}
@keyframes loading{0%{background-position:200% 0}100%{background-position:-200% 0}}
.progress-container{position:fixed;top:0;left:0;right:0;height:4px;background:rgba(0,0,0,0.08);z-index:1000;will-change:transform}
.progress-bar{height:100%;background:#ff9f5a;width:0%;transition:width 0.15s ease-out;will-change:width}
.title{font-size:24px;font-weight:600;color:#1f2937;margin:0 0 8px 0;line-height:1.3;contain:layout style}
.subtitle{font-size:16px;color:#6b7280;margin:0 0 16px 0;line-height:1.5;contain:layout style}
`;

// 4. Image Optimization for LCP
export function optimizeLCPImage(imageUrl: string): string {
  if (!imageUrl) return imageUrl;
  
  try {
    const url = new URL(imageUrl);
    
    // Critical image optimizations for green scores
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    url.searchParams.set('w', isMobile ? '420' : '860'); // Smaller sizes
    url.searchParams.set('h', isMobile ? '236' : '484');  // 16:9 aspect ratio
    url.searchParams.set('q', isMobile ? '50' : '55');    // More aggressive compression
    url.searchParams.set('f', 'webp'); // Modern format
    url.searchParams.set('fit', 'cover');
    url.searchParams.set('auto', 'compress');
    
    return url.toString();
  } catch {
    return imageUrl;
  }
}

// 5. Reduce JavaScript Blocking
export function optimizeJavaScriptLoading() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  // Mark non-critical scripts as async
  const scripts = document.querySelectorAll('script[src]:not([async]):not([defer])');
  scripts.forEach(script => {
    const src = (script as HTMLScriptElement).src;
    // Defer all non-critical scripts
    if (src.includes('analytics') || src.includes('tracking') || src.includes('ads') || src.includes('gtag') || src.includes('metrika')) {
      script.setAttribute('async', '');
      script.setAttribute('defer', '');
    }
  });

  // Add defer to remaining scripts
  scripts.forEach(script => {
    if (!script.hasAttribute('async') && !script.hasAttribute('defer')) {
      script.setAttribute('defer', '');
    }
  });
}

// 6. Layout Shift Prevention
export function preventLayoutShift() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  // Reserve space for dynamic content
  const dynamicElements = document.querySelectorAll('[data-dynamic]');
  dynamicElements.forEach(element => {
    const height = element.getAttribute('data-height');
    if (height) {
      (element as HTMLElement).style.minHeight = `${height}px`;
    }
  });
}

// 7. Speed Index Optimization
export function optimizeSpeedIndex() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  // Prioritize above-the-fold content
  const aboveFoldElements = document.querySelectorAll('[data-above-fold]');
  aboveFoldElements.forEach(element => {
    element.setAttribute('loading', 'eager');
    element.setAttribute('fetchpriority', 'high');
  });

  // Defer below-the-fold content
  const belowFoldElements = document.querySelectorAll('[data-below-fold]');
  belowFoldElements.forEach(element => {
    element.setAttribute('loading', 'lazy');
    element.setAttribute('fetchpriority', 'low');
  });
}

// 8. Total Blocking Time Reduction
export function reduceBlockingTime() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  // Break up long tasks
  const scheduler = (window as any).scheduler;
  if (scheduler && scheduler.postTask) {
    scheduler.postTask(() => {
      // Non-critical work
      console.info('Non-critical work scheduled');
    }, { priority: 'background' });
  }

  // Use requestIdleCallback for background tasks
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      // Background processing
      console.info('Background tasks executed');
    });
  }
}

// 9. Server-Side Optimization Suggestions
export const serverOptimizations = {
  // Enable HTTP/2 or HTTP/3
  enableHTTP2: true,
  
  // Implement proper caching headers
  cachingHeaders: {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'ETag': true,
    'Last-Modified': true,
  },
  
  // Enable compression
  compression: {
    'Content-Encoding': 'gzip, br',
    'Vary': 'Accept-Encoding',
  },
  
  // CDN configuration
  cdn: {
    'X-CDN-Cache': 'HIT',
    'X-Edge-Location': 'auto',
  },
};

// 10. Critical Path Optimization
export function optimizeCriticalPath() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  // 1. Inline critical CSS once
  if (!document.querySelector('style[data-ultra-critical="true"]')) {
    const criticalStyle = document.createElement('style');
    criticalStyle.textContent = ultraCriticalCSS;
    criticalStyle.setAttribute('data-critical', 'true');
    criticalStyle.setAttribute('data-ultra-critical', 'true');
    document.head.insertBefore(criticalStyle, document.head.firstChild);
  }

  // 2. Preload critical resources
  preloadCriticalResources();

  // 3. Add resource hints
  addResourceHints();
}
