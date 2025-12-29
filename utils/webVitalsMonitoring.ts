/**
 * Web Vitals & Performance Monitoring
 * Tracks Core Web Vitals and sends metrics to monitoring service
 * ⚠️ CRITICAL: Essential for understanding real user performance
 */

/**
 * Web Vitals metrics
 */
export interface WebVitalsMetrics {
  // Core Web Vitals
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift

  // Other important metrics
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
  inp?: number; // Interaction to Next Paint

  // Custom metrics
  routeChangeTime?: number;
  componentRenderTime?: number;
  imageLoadTime?: number;
}

/**
 * Performance monitoring callback
 */
export type PerformanceCallback = (metrics: WebVitalsMetrics) => void;

/**
 * Performance monitor instance
 */
interface PerformanceMonitor {
  metrics: WebVitalsMetrics;
  callbacks: PerformanceCallback[];
  marks: Map<string, number>;
  measures: Map<string, number>;
}

const monitor: PerformanceMonitor = {
  metrics: {},
  callbacks: [],
  marks: new Map(),
  measures: new Map(),
};

/**
 * Initialize Web Vitals monitoring
 * Must be called early in app lifecycle
 *
 * @example
 * initializeWebVitalsMonitoring();
 * onWebVitals((metrics) => {
 *   console.log('Web Vitals:', metrics);
 *   // Send to analytics service
 * });
 */
export function initializeWebVitalsMonitoring(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return; // Not in browser
  }

  // Track LCP (Largest Contentful Paint)
  trackLCP();

  // Track FID (First Input Delay)
  trackFID();

  // Track CLS (Cumulative Layout Shift)
  trackCLS();

  // Track FCP (First Contentful Paint)
  trackFCP();

  // Track TTFB (Time to First Byte)
  trackTTFB();
}

/**
 * Track Largest Contentful Paint (LCP)
 * Measures when the largest content element is painted
 * Target: < 2.5s
 */
function trackLCP(): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];

      monitor.metrics.lcp = lastEntry.renderTime || lastEntry.loadTime;
      notifyCallbacks();
    });

    observer.observe({ entryTypes: ['largest-contentful-paint'] });
  } catch (error) {
    console.warn('[trackLCP] Error:', error);
  }
}

/**
 * Track First Input Delay (FID)
 * Measures delay between user input and response
 * Target: < 100ms
 */
function trackFID(): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();

      entries.forEach((entry: any) => {
        const fid = entry.processingDuration;
        monitor.metrics.fid = Math.min(monitor.metrics.fid || fid, fid);
        notifyCallbacks();
      });
    });

    observer.observe({ entryTypes: ['first-input'] });
  } catch (error) {
    console.warn('[trackFID] Error:', error);
  }
}

/**
 * Track Cumulative Layout Shift (CLS)
 * Measures visual stability - unexpected layout shifts
 * Target: < 0.1
 */
function trackCLS(): void {
  if (!('PerformanceObserver' in window)) return;

  let clsValue = 0;

  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          // Only count shifts without recent input
          clsValue += entry.value;
          monitor.metrics.cls = clsValue;
          notifyCallbacks();
        }
      });
    });

    observer.observe({ entryTypes: ['layout-shift'] });
  } catch (error) {
    console.warn('[trackCLS] Error:', error);
  }
}

/**
 * Track First Contentful Paint (FCP)
 * Measures when first content is painted
 * Target: < 1.8s
 */
function trackFCP(): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');

      if (fcpEntry) {
        monitor.metrics.fcp = fcpEntry.startTime;
        notifyCallbacks();
      }
    });

    observer.observe({ entryTypes: ['paint'] });
  } catch (error) {
    console.warn('[trackFCP] Error:', error);
  }
}

/**
 * Track Time to First Byte (TTFB)
 * Measures server response time
 * Target: < 600ms
 */
function trackTTFB(): void {
  try {
    if (typeof window !== 'undefined' && window.performance?.timing) {
      const timing = window.performance.timing;
      const ttfb = timing.responseStart - timing.navigationStart;
      monitor.metrics.ttfb = ttfb;
      notifyCallbacks();
    }
  } catch (error) {
    console.warn('[trackTTFB] Error:', error);
  }
}

/**
 * Register callback for Web Vitals updates
 *
 * @example
 * onWebVitals((metrics) => {
 *   if (metrics.lcp > 2500) {
 *     console.warn('LCP too high:', metrics.lcp);
 *   }
 * });
 */
export function onWebVitals(callback: PerformanceCallback): () => void {
  monitor.callbacks.push(callback);

  // Return unsubscribe function
  return () => {
    const index = monitor.callbacks.indexOf(callback);
    if (index > -1) {
      monitor.callbacks.splice(index, 1);
    }
  };
}

/**
 * Get current Web Vitals metrics
 */
export function getWebVitalsMetrics(): WebVitalsMetrics {
  return { ...monitor.metrics };
}

/**
 * Notify all registered callbacks
 */
function notifyCallbacks(): void {
  monitor.callbacks.forEach(callback => {
    try {
      callback(monitor.metrics);
    } catch (error) {
      console.error('[notifyCallbacks] Error in callback:', error);
    }
  });
}

/**
 * Manual performance mark (for custom metrics)
 *
 * @example
 * markPerformance('component-load-start');
 * // ... do work ...
 * measurePerformance('component-load-start', 'component-load-end');
 */
export function markPerformance(name: string): void {
  if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
    performance.mark(name);
    monitor.marks.set(name, performance.now());
  }
}

/**
 * Measure time between two marks
 */
export function measurePerformance(startMark: string, endMark: string): number {
  if (typeof performance !== 'undefined' && typeof performance.measure === 'function') {
    try {
      performance.measure(endMark, startMark);
      const measure = performance.getEntriesByName(endMark);
      if (measure.length > 0) {
        const duration = measure[measure.length - 1].duration;
        monitor.measures.set(endMark, duration);
        return duration;
      }
    } catch (error) {
      console.warn('[measurePerformance] Error:', error);
    }
  }
  return 0;
}

/**
 * Track component render time
 * Useful for identifying slow renders
 *
 * @example
 * const duration = trackComponentRender('MyComponent');
 */
export function trackComponentRender(componentName: string): number {
  const startMark = `${componentName}-render-start`;
  const endMark = `${componentName}-render-end`;

  markPerformance(startMark);

  return () => {
    const duration = measurePerformance(startMark, endMark);
    if (duration > 100) {
      console.warn(`[Performance] ${componentName} render took ${duration}ms`);
    }
    monitor.metrics.componentRenderTime = duration;
    notifyCallbacks();
    return duration;
  };
}

/**
 * Send metrics to monitoring service
 * Implement custom logic for your backend
 *
 * @example
 * sendMetricsToService(getWebVitalsMetrics(), {
 *   endpoint: 'https://api.example.com/metrics',
 *   batchSize: 10
 * });
 */
export async function sendMetricsToService(
  metrics: WebVitalsMetrics,
  options: {
    endpoint?: string;
    headers?: Record<string, string>;
    timeout?: number;
  } = {}
): Promise<void> {
  const endpoint = options.endpoint || '/api/metrics';
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const timeout = options.timeout || 5000;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...metrics,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[sendMetricsToService] Request failed:', response.status);
    }
  } catch (error) {
    console.warn('[sendMetricsToService] Error:', error);
  }
}

/**
 * Check if metrics meet "good" thresholds
 * Returns object with pass/fail status for each metric
 */
export function checkMetricsHealth(metrics: WebVitalsMetrics): {
  isHealthy: boolean;
  lcp: 'good' | 'fair' | 'poor';
  fid: 'good' | 'fair' | 'poor';
  cls: 'good' | 'fair' | 'poor';
  fcp: 'good' | 'fair' | 'poor';
  ttfb: 'good' | 'fair' | 'poor';
} {
  const getStatus = (value: number | undefined, good: number, fair: number): 'good' | 'fair' | 'poor' => {
    if (value === undefined) return 'fair';
    if (value <= good) return 'good';
    if (value <= fair) return 'fair';
    return 'poor';
  };

  const lcpStatus = getStatus(metrics.lcp, 2500, 4000);
  const fidStatus = getStatus(metrics.fid, 100, 300);
  const clsStatus = getStatus(metrics.cls, 0.1, 0.25);
  const fcpStatus = getStatus(metrics.fcp, 1800, 3000);
  const ttfbStatus = getStatus(metrics.ttfb, 600, 1800);

  return {
    isHealthy: [lcpStatus, fidStatus, clsStatus, fcpStatus, ttfbStatus].every(s => s !== 'poor'),
    lcp: lcpStatus,
    fid: fidStatus,
    cls: clsStatus,
    fcp: fcpStatus,
    ttfb: ttfbStatus,
  };
}

/**
 * Format metrics for display/logging
 */
export function formatMetricsForDisplay(metrics: WebVitalsMetrics): string {
  return `
📊 Web Vitals:
  LCP: ${metrics.lcp ? `${metrics.lcp.toFixed(0)}ms` : 'N/A'}
  FID: ${metrics.fid ? `${metrics.fid.toFixed(0)}ms` : 'N/A'}
  CLS: ${metrics.cls ? `${metrics.cls.toFixed(3)}` : 'N/A'}
  FCP: ${metrics.fcp ? `${metrics.fcp.toFixed(0)}ms` : 'N/A'}
  TTFB: ${metrics.ttfb ? `${metrics.ttfb.toFixed(0)}ms` : 'N/A'}
`;
}

