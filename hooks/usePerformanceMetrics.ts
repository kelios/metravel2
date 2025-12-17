// Хук для отслеживания метрик производительности (Web Vitals)
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { devWarn } from '@/src/utils/logger';

interface PerformanceMetrics {
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  ttfb?: number; // Time to First Byte
}

export function usePerformanceMetrics(onMetrics?: (metrics: PerformanceMetrics) => void) {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const metrics: PerformanceMetrics = {};

    // Получаем метрики из Performance API
    const getPerformanceMetrics = () => {
      if ('performance' in window && 'getEntriesByType' in performance) {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          metrics.ttfb = navigation.responseStart - navigation.requestStart;
          metrics.fcp = navigation.domContentLoadedEventEnd - navigation.fetchStart;
        }

        // FCP (First Contentful Paint)
        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
        if (fcpEntry) {
          metrics.fcp = fcpEntry.startTime;
        }
      }
    };

    // Отслеживание LCP (Largest Contentful Paint)
    const observeLCP = () => {
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1] as any;
            if (lastEntry) {
              metrics.lcp = lastEntry.renderTime || lastEntry.loadTime;
              if (onMetrics) {
                onMetrics({ ...metrics });
              }
            }
          });
          observer.observe({ entryTypes: ['largest-contentful-paint'] });
          return () => observer.disconnect();
        } catch (e) {
          devWarn('LCP observer not supported:', e);
        }
      }
    };

    // Отслеживание CLS (Cumulative Layout Shift)
    const observeCLS = () => {
      if ('PerformanceObserver' in window) {
        try {
          let clsValue = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as any[]) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            }
            metrics.cls = clsValue;
            if (onMetrics) {
              onMetrics({ ...metrics });
            }
          });
          observer.observe({ entryTypes: ['layout-shift'] });
          return () => observer.disconnect();
        } catch (e) {
          devWarn('CLS observer not supported:', e);
        }
      }
    };

    // Отслеживание FID (First Input Delay)
    const observeFID = () => {
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as any[]) {
              metrics.fid = entry.processingStart - entry.startTime;
              if (onMetrics) {
                onMetrics({ ...metrics });
              }
              observer.disconnect();
            }
          });
          observer.observe({ entryTypes: ['first-input'] });
          return () => observer.disconnect();
        } catch (e) {
          devWarn('FID observer not supported:', e);
        }
      }
    };

    // Запускаем сбор метрик после загрузки
    const timeout = setTimeout(() => {
      getPerformanceMetrics();
      observeLCP();
      observeCLS();
      observeFID();
    }, 1000);

    return () => {
      clearTimeout(timeout);
    };
  }, [onMetrics]);
}

// Утилита для логирования метрик в консоль (для разработки)
export function logPerformanceMetrics(metrics: PerformanceMetrics) {
  if (__DEV__) {
    console.group('📊 Performance Metrics');
    if (metrics.lcp) console.log(`LCP: ${metrics.lcp.toFixed(2)}ms`);
    if (metrics.fcp) console.log(`FCP: ${metrics.fcp.toFixed(2)}ms`);
    if (metrics.fid) console.log(`FID: ${metrics.fid.toFixed(2)}ms`);
    if (metrics.cls) console.log(`CLS: ${metrics.cls.toFixed(4)}`);
    if (metrics.ttfb) console.log(`TTFB: ${metrics.ttfb.toFixed(2)}ms`);
    console.groupEnd();
  }
}

