/**
 * Advanced performance optimizations for critical metrics
 * Target: LCP < 2.5s, FCP < 1.8s, TBT < 200ms, CLS < 0.1, SI < 3.4s
 */

import { Platform } from 'react-native';

// 1. Critical Resource Preloading
export function preloadCriticalResources() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  // Preload LCP image (avoid duplicates)
  const lcpImage = document.querySelector('img[data-lcp]') || document.querySelector('img[src*="travel"]');
  if (lcpImage) {
    const href = (lcpImage as HTMLImageElement).currentSrc || (lcpImage as HTMLImageElement).src;
    if (href && !document.querySelector(`link[rel="prefetch"][as="image"][href="${href}"]`)) {
      const preloadLink = document.createElement('link');
      preloadLink.rel = 'prefetch';
      preloadLink.as = 'image';
      preloadLink.href = href;
      document.head.appendChild(preloadLink);
    }
  }
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

  ['//metravel.by', '//cdn.metravel.by', '//fonts.googleapis.com'].forEach((domain) => {
    ensureLink('dns-prefetch', domain);
  });

  ensureLink('preconnect', 'https://metravel.by', { crossOrigin: 'anonymous' });
}

// 3. Critical CSS Inline Optimization
export const ultraCriticalCSS = `
/* Ultra-critical CSS for LCP optimization */
body{margin:0;padding:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif}
.hero-section{width:100%;aspect-ratio:16/9;background:#000}
.hero-image{width:100%;height:100%;object-fit:cover;display:block}
.skeleton{background:linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%);background-size:200% 100%;animation:loading 1.5s infinite}
@keyframes loading{0%{background-position:200% 0}100%{background-position:-200% 0}}
.progress-container{position:fixed;top:0;left:0;right:0;height:4px;background:rgba(0,0,0,0.08);z-index:1000}
.progress-bar{height:100%;background:#ff9f5a;width:0%;transition:width 0.15s ease-out}
.title{font-size:24px;font-weight:600;color:#1f2937;margin:0 0 8px 0;line-height:1.3}
.subtitle{font-size:16px;color:#6b7280;margin:0 0 16px 0;line-height:1.5}
`;

// 4. Image Optimization for LCP
export function optimizeLCPImage(imageUrl: string): string {
  if (!imageUrl) return imageUrl;
  
  try {
    const url = new URL(imageUrl);
    
    // Critical image optimizations
    url.searchParams.set('w', '1200'); // Optimal LCP width
    url.searchParams.set('h', '675');  // 16:9 aspect ratio
    url.searchParams.set('q', '75');    // Balance quality vs size
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
    if (src.includes('analytics') || src.includes('tracking') || src.includes('ads')) {
      script.setAttribute('async', '');
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
      console.log('Non-critical work scheduled');
    }, { priority: 'background' });
  }

  // Use requestIdleCallback for background tasks
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      // Background processing
      console.log('Background tasks executed');
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

  // 4. Optimize only the actual LCP image to avoid forced re-fetches
  const lcpImg = document.querySelector('img[data-lcp]') as HTMLImageElement | null;
  if (lcpImg) {
    const src = lcpImg.currentSrc || lcpImg.src;
    if (src) {
      const optimized = optimizeLCPImage(src);
      if (optimized && optimized !== src) {
        lcpImg.src = optimized;
      }
      lcpImg.loading = 'eager';
      lcpImg.fetchPriority = 'high';
    }
  }

  // 5. Prevent layout shift
  preventLayoutShift();
  
  // 6. Optimize JavaScript loading
  optimizeJavaScriptLoading();
  
  // 7. Optimize Speed Index
  optimizeSpeedIndex();
  
  // 8. Reduce blocking time
  reduceBlockingTime();
}
