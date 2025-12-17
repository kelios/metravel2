// hooks/usePerformanceMonitoring.ts
// ✅ ПРОИЗВОДИТЕЛЬНОСТЬ: Мониторинг производительности для production

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { devWarn } from '@/src/utils/logger';

export interface PerformanceMetrics {
    lcp?: number; // Largest Contentful Paint
    fcp?: number; // First Contentful Paint
    fid?: number; // First Input Delay
    cls?: number; // Cumulative Layout Shift
    ttfb?: number; // Time to First Byte
    domContentLoaded?: number;
    loadComplete?: number;
}

type PerformanceCallback = (metrics: PerformanceMetrics) => void;

/**
 * Хук для мониторинга производительности
 */
export function usePerformanceMonitoring(
    onMetricsReady?: PerformanceCallback,
    enabled: boolean = true
) {
    const metricsRef = useRef<PerformanceMetrics>({});
    const observersRef = useRef<PerformanceObserver[]>([]);
    // ✅ FIX: Сохраняем callback в ref чтобы избежать пересоздания эффекта
    const callbackRef = useRef(onMetricsReady);
    
    // Обновляем ref при изменении callback
    useEffect(() => {
        callbackRef.current = onMetricsReady;
    }, [onMetricsReady]);

    useEffect(() => {
        if (!enabled || Platform.OS !== 'web' || typeof window === 'undefined') {
            return;
        }

        // Проверяем поддержку PerformanceObserver
        if (!('PerformanceObserver' in window)) {
            devWarn('PerformanceObserver не поддерживается');
            return;
        }

        const metrics: PerformanceMetrics = {};

        // LCP (Largest Contentful Paint)
        try {
            const lcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1] as any;
                if (lastEntry.renderTime) {
                    metrics.lcp = lastEntry.renderTime;
                    metricsRef.current.lcp = lastEntry.renderTime;
                    callbackRef.current?.(metricsRef.current);
                }
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            observersRef.current.push(lcpObserver);
        } catch (e) {
            devWarn('LCP observer не поддерживается:', e);
        }

        // FCP (First Contentful Paint)
        try {
            const fcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry: any) => {
                    if (entry.name === 'first-contentful-paint') {
                        metrics.fcp = entry.startTime;
                        metricsRef.current.fcp = entry.startTime;
                        callbackRef.current?.(metricsRef.current);
                    }
                });
            });
            fcpObserver.observe({ entryTypes: ['paint'] });
            observersRef.current.push(fcpObserver);
        } catch (e) {
            devWarn('FCP observer не поддерживается:', e);
        }

        // FID (First Input Delay)
        try {
            const fidObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry: any) => {
                    if (entry.processingStart && entry.startTime) {
                        metrics.fid = entry.processingStart - entry.startTime;
                        metricsRef.current.fid = metrics.fid;
                        callbackRef.current?.(metricsRef.current);
                    }
                });
            });
            fidObserver.observe({ entryTypes: ['first-input'] });
            observersRef.current.push(fidObserver);
        } catch (e) {
            devWarn('FID observer не поддерживается:', e);
        }

        // CLS (Cumulative Layout Shift)
        try {
            let clsValue = 0;
            const clsObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                let hasUpdate = false;
                entries.forEach((entry: any) => {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                        metrics.cls = clsValue;
                        metricsRef.current.cls = clsValue;
                        hasUpdate = true;
                    }
                });
                // ✅ FIX: Вызываем callback только если были изменения
                if (hasUpdate) {
                    callbackRef.current?.(metricsRef.current);
                }
            });
            clsObserver.observe({ entryTypes: ['layout-shift'] });
            observersRef.current.push(clsObserver);
        } catch (e) {
            devWarn('CLS observer не поддерживается:', e);
        }

        // TTFB (Time to First Byte) - из navigation timing
        if ('performance' in window && 'getEntriesByType' in window.performance) {
            try {
                const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
                if (navigation) {
                    metrics.ttfb = navigation.responseStart - navigation.requestStart;
                    metricsRef.current.ttfb = metrics.ttfb;
                    metrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.startTime;
                    metricsRef.current.domContentLoaded = metrics.domContentLoaded;
                    metrics.loadComplete = navigation.loadEventEnd - navigation.startTime;
                    metricsRef.current.loadComplete = metrics.loadComplete;
                    callbackRef.current?.(metricsRef.current);
                }
            } catch (e) {
                devWarn('Navigation timing не поддерживается:', e);
            }
        }

        // Отправка метрик в аналитику (если настроена)
        const sendToAnalytics = (finalMetrics: PerformanceMetrics) => {
            if (typeof window !== 'undefined' && (window as any).gtag) {
                // Google Analytics
                (window as any).gtag('event', 'performance', {
                    lcp: finalMetrics.lcp,
                    fcp: finalMetrics.fcp,
                    fid: finalMetrics.fid,
                    cls: finalMetrics.cls,
                    ttfb: finalMetrics.ttfb,
                });
            }

            // Можно добавить отправку в другие системы аналитики
            // Например, Yandex Metrica, собственный backend и т.д.
        };

        // Отправляем метрики после загрузки страницы
        if (document.readyState === 'complete') {
            setTimeout(() => {
                sendToAnalytics(metricsRef.current);
            }, 2000);
        } else {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    sendToAnalytics(metricsRef.current);
                }, 2000);
            });
        }

        return () => {
            observersRef.current.forEach(observer => observer.disconnect());
            observersRef.current = [];
        };
    }, [enabled]); // ✅ FIX: Убрали onMetricsReady из зависимостей, используем ref

    return metricsRef.current;
}

/**
 * Логирует метрики производительности в консоль
 */
export function logPerformanceMetrics(metrics: PerformanceMetrics): void {
    if (__DEV__) {
        console.group('📊 Performance Metrics');
        if (metrics.lcp) {
            const status = metrics.lcp < 2500 ? '✅' : metrics.lcp < 4000 ? '⚠️' : '❌';
            console.log(`LCP: ${metrics.lcp.toFixed(2)}ms ${status}`);
        }
        if (metrics.fcp) {
            const status = metrics.fcp < 1800 ? '✅' : '⚠️';
            console.log(`FCP: ${metrics.fcp.toFixed(2)}ms ${status}`);
        }
        if (metrics.fid) {
            const status = metrics.fid < 100 ? '✅' : '⚠️';
            console.log(`FID: ${metrics.fid.toFixed(2)}ms ${status}`);
        }
        if (metrics.cls !== undefined) {
            const status = metrics.cls < 0.1 ? '✅' : metrics.cls < 0.25 ? '⚠️' : '❌';
            console.log(`CLS: ${metrics.cls.toFixed(4)} ${status}`);
        }
        if (metrics.ttfb) {
            const status = metrics.ttfb < 800 ? '✅' : '⚠️';
            console.log(`TTFB: ${metrics.ttfb.toFixed(2)}ms ${status}`);
        }
        console.groupEnd();
    }
}

