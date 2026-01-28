/**
 * Performance monitoring and optimization script
 * Measures Core Web Vitals and provides optimization suggestions
 */

import { initializeWebVitalsMonitoring } from '@/utils/webVitalsMonitoring';

export interface PerformanceMetrics {
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  inp: number; // Interaction to Next Paint
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
  fcp: number; // First Contentful Paint
  loadTime: number; // Page load time
}

export type PerformanceMetricName = keyof PerformanceMetrics;
export type PerformanceMetricReporter = (metric: {
  name: PerformanceMetricName;
  value: number;
}) => void;

interface PerformanceMonitorOptions {
  report?: PerformanceMetricReporter;
  debug?: boolean;
}

export class PerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private observers: PerformanceObserver[] = [];
  private report?: PerformanceMetricReporter;
  private debug: boolean;

  constructor(options: PerformanceMonitorOptions = {}) {
    this.report = options.report;
    this.debug = Boolean(options.debug);
    if (typeof window === 'undefined') return;
    this.init();
  }

  private init() {
    this.measureLCP();
    this.measureFID();
    this.measureINP();
    this.measureCLS();
    this.measureTTFB();
    this.measureFCP();
    this.measureLoadTime();
  }

  private measureLCP() {
    try {
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.lcp = lastEntry.startTime;
        
        // Send to analytics if needed
        this.sendMetric('lcp', lastEntry.startTime);
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(observer);
    } catch {
      console.warn('[Performance] LCP measurement not supported');
    }
  }

  private measureFID() {
    try {
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach((entry: any) => {
          const fid = entry.processingStart - entry.startTime;
          this.metrics.fid = fid;
          this.sendMetric('fid', fid);
        });
      });
      observer.observe({ entryTypes: ['first-input'] });
      this.observers.push(observer);
    } catch {
      console.warn('[Performance] FID measurement not supported');
    }
  }

  private measureINP() {
    try {
      const interactionDurations = new Map<number, number>();
      const observer = new PerformanceObserver((entryList) => {
        entryList.getEntries().forEach((entry: any) => {
          const duration = entry.duration || 0;
          const interactionId = entry.interactionId || 0;

          if (interactionId) {
            const current = interactionDurations.get(interactionId) || 0;
            if (duration > current) {
              interactionDurations.set(interactionId, duration);
            }
          } else if (duration > (this.metrics.inp || 0)) {
            this.metrics.inp = duration;
          }
        });

        let maxInteraction = 0;
        interactionDurations.forEach((value) => {
          if (value > maxInteraction) maxInteraction = value;
        });

        if (maxInteraction > 0) {
          this.metrics.inp = maxInteraction;
          this.sendMetric('inp', maxInteraction);
        }
      });
      observer.observe({ type: 'event', buffered: true, durationThreshold: 40 } as any);
      this.observers.push(observer);
    } catch {
      console.warn('[Performance] INP measurement not supported');
    }
  }

  private measureCLS() {
    try {
      let clsValue = 0;
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            this.metrics.cls = clsValue;
            this.sendMetric('cls', clsValue);
          }
        });
      });
      observer.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(observer);
    } catch {
      console.warn('[Performance] CLS measurement not supported');
    }
  }

  private measureTTFB() {
    if (performance.timing) {
      const ttfb = performance.timing.responseStart - performance.timing.requestStart;
      this.metrics.ttfb = ttfb;
      this.sendMetric('ttfb', ttfb);
    }
  }

  private measureFCP() {
    try {
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries();
        const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          this.metrics.fcp = fcpEntry.startTime;
          this.sendMetric('fcp', fcpEntry.startTime);
        }
      });
      observer.observe({ entryTypes: ['paint'] });
      this.observers.push(observer);
    } catch {
      console.warn('[Performance] FCP measurement not supported');
    }
  }

  private measureLoadTime() {
    window.addEventListener('load', () => {
      if (performance.timing) {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        this.metrics.loadTime = loadTime;
        this.sendMetric('loadTime', loadTime);
      }
    });
  }

  private sendMetric(name: PerformanceMetricName, value: number) {
    if (typeof window !== 'undefined') {
      (window as any).__perfMetrics = {
        ...((window as any).__perfMetrics || {}),
        [name]: value,
      };
    }

    if (this.report) {
      this.report({ name, value });
    }

    if (this.debug) {
      console.info('[Performance]', name, value);
    }

    // Send to analytics service (Google Analytics, etc.)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'web_vitals', {
        name,
        value: Math.round(value),
        event_category: 'Performance'
      });
    }
  }

  public getMetrics(): PerformanceMetrics {
    return this.metrics as PerformanceMetrics;
  }

  public getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const metrics = this.metrics;

    if (!metrics.lcp) return ['Waiting for LCP measurement...'];

    // LCP suggestions
    if (metrics.lcp > 2500) {
      suggestions.push('LCP > 2.5s: Optimize largest contentful paint');
      suggestions.push('- Preload LCP image');
      suggestions.push('- Use WebP format for images');
      suggestions.push('- Remove render-blocking resources');
    }

    // FID/INP suggestions
    const interactionDelay = metrics.inp ?? metrics.fid;
    if (interactionDelay && interactionDelay > 100) {
      suggestions.push('FID/INP > 100ms: Improve interaction responsiveness');
      suggestions.push('- Minimize JavaScript execution time');
      suggestions.push('- Use code splitting');
      suggestions.push('- Reduce main thread work');
    }

    // CLS suggestions
    if (metrics.cls && metrics.cls > 0.1) {
      suggestions.push('CLS > 0.1: Reduce cumulative layout shift');
      suggestions.push('- Specify image dimensions');
      suggestions.push('- Reserve space for dynamic content');
      suggestions.push('- Avoid inserting content above existing content');
    }

    // TTFB suggestions
    if (metrics.ttfb && metrics.ttfb > 600) {
      suggestions.push('TTFB > 600ms: Improve server response time');
      suggestions.push('- Use CDN');
      suggestions.push('- Enable compression');
      suggestions.push('- Optimize backend performance');
    }

    return suggestions;
  }

  public destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Initialize performance monitoring
export function initPerformanceMonitoring(options: PerformanceMonitorOptions = {}) {
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    initializeWebVitalsMonitoring();
    const monitor = new PerformanceMonitor(options);
    
    // Log suggestions after page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        const suggestions = monitor.getOptimizationSuggestions();
        if (suggestions.length > 0) {
          // Send suggestions to analytics silently
        }
      }, 3000);
    });

    return monitor;
  }
  return null;
}

// Resource timing analysis
export function analyzeResourceTiming() {
  if (typeof window === 'undefined' || !performance.getEntriesByType) {
    return;
  }

  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const analysis = {
    totalResources: resources.length,
    totalSize: 0,
    slowResources: [] as PerformanceResourceTiming[],
    largeResources: [] as PerformanceResourceTiming[],
    cachedResources: 0,
  };

  resources.forEach(resource => {
    // Calculate transfer size (approximate)
    const size = resource.transferSize || 0;
    analysis.totalSize += size;

    // Check if resource was cached
    if (resource.transferSize === 0 && resource.decodedBodySize > 0) {
      analysis.cachedResources++;
    }

    // Identify slow resources (>2 seconds)
    if (resource.duration > 2000) {
      analysis.slowResources.push(resource);
    }

    // Identify large resources (>1MB)
    if (size > 1024 * 1024) {
      analysis.largeResources.push(resource);
    }
  });

  console.info('[Performance] Resource analysis', analysis);
  
  // Log specific issues
  if (analysis.slowResources.length > 0) {
    console.warn('[Performance] Slow resources found:', analysis.slowResources.map(r => r.name));
  }
  
  if (analysis.largeResources.length > 0) {
    console.warn('[Performance] Large resources found:', analysis.largeResources.map(r => r.name));
  }

  return analysis;
}

// Memory usage monitoring
export function monitorMemoryUsage() {
  if (typeof window === 'undefined' || !(performance as any).memory) {
    return;
  }

  const memory = (performance as any).memory;
  const usage = {
    used: memory.usedJSHeapSize,
    total: memory.totalJSHeapSize,
    limit: memory.jsHeapSizeLimit,
    percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
  };

  if (usage.percentage > 80) {
    console.warn('[Memory] High memory usage detected!');
  }

  return usage;
}
