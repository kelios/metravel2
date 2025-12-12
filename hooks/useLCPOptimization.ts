/**
 * Hook для LCP оптимизации и мониторинга производительности
 */

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// Global flag to ensure LCP optimizations run only once
let globalLCPOptimizationDone = false;

interface LCPMetrics {
  lcpTime: number | null;
  fcpTime: number | null;
  loadTime: number | null;
  isOptimized: boolean;
}

export const useLCPOptimization = (isFirstCard: boolean = false) => {
  const [metrics, setMetrics] = useState<LCPMetrics>({
    lcpTime: null,
    fcpTime: null,
    loadTime: null,
    isOptimized: false,
  });
  
  const startTimeRef = useRef<number>(Date.now());
  const observerRef = useRef<PerformanceObserver | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    // LCP мониторинг только для первой карточки
    if (isFirstCard && 'PerformanceObserver' in window) {
      observerRef.current = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lcpEntry = entries[entries.length - 1];
        
        setMetrics(prev => ({
          ...prev,
          lcpTime: lcpEntry.startTime,
          loadTime: Date.now() - startTimeRef.current,
          isOptimized: lcpEntry.startTime < 2500, // Good LCP threshold
        }));

        console.log(`[LCP] First travel card: ${lcpEntry.startTime.toFixed(2)}ms`);
        
        // Cleanup после измерения
        setTimeout(() => {
          observerRef.current?.disconnect();
        }, 1000);
      });

      observerRef.current.observe({ entryTypes: ['largest-contentful-paint'] });
    }

    // FCP мониторинг
    if ('PerformanceObserver' in window) {
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
        
        if (fcpEntry) {
          setMetrics(prev => ({
            ...prev,
            fcpTime: fcpEntry.startTime,
          }));
        }
      });

      fcpObserver.observe({ entryTypes: ['paint'] });
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [isFirstCard]);

  // Оптимизация ресурсов для LCP
  const optimizeForLCP = (imageUrl?: string) => {
    if (!imageUrl || Platform.OS !== 'web' || typeof document === 'undefined' || globalLCPOptimizationDone) return;

    // Mark as done to prevent future calls
    globalLCPOptimizationDone = true;

    const linkId = `lcp-preload-${btoa(imageUrl).slice(0, 10)}`;

    // Проверяем, существует ли уже preload link для этого изображения
    if (document.getElementById(linkId)) return;

    // 1. Preload изображения
    const preloadLink = document.createElement('link');
    preloadLink.id = linkId;
    preloadLink.rel = 'preload';
    preloadLink.as = 'image';
    preloadLink.href = imageUrl;
    preloadLink.fetchPriority = isFirstCard ? 'high' : 'auto';
    document.head.appendChild(preloadLink);

    // 2. DNS prefetch для домена изображения
    try {
      const imageDomain = new URL(imageUrl).origin;
      const dnsId = `dns-prefetch-${btoa(imageDomain)}`;
      const preconnectId = `preconnect-${btoa(imageDomain)}`;

      // Проверяем существующие DNS prefetch
      if (!document.getElementById(dnsId)) {
        const dnsLink = document.createElement('link');
        dnsLink.id = dnsId;
        dnsLink.rel = 'dns-prefetch';
        dnsLink.href = imageDomain;
        document.head.appendChild(dnsLink);
      }

      // Проверяем существующие preconnect
      if (!document.getElementById(preconnectId)) {
        const preconnectLink = document.createElement('link');
        preconnectLink.id = preconnectId;
        preconnectLink.rel = 'preconnect';
        preconnectLink.href = imageDomain;
        document.head.appendChild(preconnectLink);
      }
    } catch (error) {
      console.warn('Failed to parse image URL for DNS prefetch:', error);
    }
  };

  return {
    metrics,
    optimizeForLCP,
    isLCPOptimized: metrics.isOptimized,
  };
};
