/**
 * Интеграция LCP оптимизаций в существующий TravelListItem
 */

import React, { memo, useEffect } from 'react';
import { Platform } from 'react-native';
import { optimizeLCPImage, preloadCriticalResources } from '@/utils/advancedPerformanceOptimization';

// LCP оптимизация для первой карточки
export const useLCPOptimizations = (travel: any, isFirst: boolean = false) => {
  useEffect(() => {
    if (!isFirst || Platform.OS !== 'web' || typeof document === 'undefined') return;

    // 1. Preload критических ресурсов
    preloadCriticalResources();

    // 2. Оптимизация изображения первой карточки
    if (travel?.travel_image_thumb_url) {
      const optimizedSrc = optimizeLCPImage(travel.travel_image_thumb_url);
      
      // Use prefetch (instead of preload) to avoid "preloaded but not used" warnings when the first card
      // image is mounted/updated lazily.
      if (!document.querySelector(`link[rel="prefetch"][as="image"][href="${optimizedSrc}"]`)) {
        const preloadLink = document.createElement('link');
        preloadLink.rel = 'prefetch';
        preloadLink.as = 'image';
        preloadLink.href = optimizedSrc;
        preloadLink.crossOrigin = 'anonymous';
        document.head.appendChild(preloadLink);
      }

      // Добавляем resource hints
      const preconnectLink = document.createElement('link');
      preconnectLink.rel = 'preconnect';
      preconnectLink.href = new URL(optimizedSrc).origin;
      document.head.appendChild(preconnectLink);
    }

    // 3. Инжектим critical CSS для карточек
    const criticalCSS = `
      .travel-card-lcp {
        width: 100%;
        aspect-ratio: 16/9;
        border-radius: 16px;
        overflow: hidden;
        background: #fff;
        box-shadow: 0 4px 16px rgba(0,0,0,0.1);
      }
      .travel-card-lcp img {
        width: 100%;
        height: 220px;
        object-fit: cover;
        display: block;
      }
      .travel-card-content {
        padding: 16px;
      }
      .travel-card-title {
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
        margin: 0 0 8px 0;
        line-height: 1.2;
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.textContent = criticalCSS;
    styleElement.setAttribute('data-lcp-travel-card', 'true');
    if (!document.querySelector('[data-lcp-travel-card]')) {
      document.head.appendChild(styleElement);
    }

    // 4. Отслеживание LCP метрики
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log(`[LCP] Travel card loaded: ${lastEntry.startTime.toFixed(2)}ms`);
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    }
  }, [isFirst, travel]);

  return {
    getOptimizedImageSrc: (src: string) => optimizeLCPImage(src),
    shouldUseHighPriority: () => isFirst,
  };
};

// Компонент-обертка для LCP оптимизации
export const LCPOptimizedWrapper = memo(function LCPOptimizedWrapper({
  children,
  isFirst,
  travel,
}: {
  children: React.ReactNode;
  isFirst?: boolean;
  travel: any;
}) {
  useLCPOptimizations(travel, isFirst);

  return React.createElement(
    'div',
    {
      className: isFirst ? 'travel-card-lcp' : '',
      style: { width: '100%' },
    } as any,
    children
  );
});
