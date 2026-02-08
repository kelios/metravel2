// hooks/useLazyMap.ts
// ✅ ПРОИЗВОДИТЕЛЬНОСТЬ: Ленивая загрузка карт с Intersection Observer

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

interface UseLazyMapOptions {
    rootMargin?: string;
    threshold?: number;
    enabled?: boolean;
}

/**
 * Хук для ленивой загрузки карт
 * Загружает карту только когда она становится видимой в viewport
 */
export function useLazyMap(options: UseLazyMapOptions = {}) {
    const {
        rootMargin = '200px', // Начинаем загрузку за 200px до появления
        threshold = 0.1,
        enabled = true,
    } = options;

    const [shouldLoad, setShouldLoad] = useState(!enabled || Platform.OS !== 'web');
    const [isLoading, setIsLoading] = useState(false);
    const elementRef = useRef<HTMLElement | null>(null);

    const handleIntersection = useCallback((entries: IntersectionObserverEntry[]) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting && !shouldLoad) {
                setIsLoading(true);
                setShouldLoad(true);
            }
        });
    }, [shouldLoad]);

    useEffect(() => {
        if (!enabled || Platform.OS !== 'web' || shouldLoad) {
            return;
        }

        if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
            // Fallback: загружаем сразу, если IntersectionObserver не поддерживается
            setShouldLoad(true);
            return;
        }

        const element = elementRef.current;
        if (!element) {
            return;
        }

        const observer = new IntersectionObserver(handleIntersection, {
            rootMargin,
            threshold,
        });

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, [enabled, shouldLoad, rootMargin, threshold, handleIntersection]);

    // Callback для установки ref элемента
    const setElementRef = useCallback((node: HTMLElement | null) => {
        elementRef.current = node;
    }, []);

    return useMemo(() => ({
        shouldLoad,
        isLoading,
        setElementRef,
    }), [shouldLoad, isLoading, setElementRef]);
}

/**
 * Компонент-обертка для ленивой загрузки карт
 * Использование:
 * 
 * const { shouldLoad, setElementRef } = useLazyMap();
 * 
 * return (
 *   <div ref={setElementRef}>
 *     {shouldLoad ? <MapComponent /> : <MapPlaceholder />}
 *   </div>
 * );
 */

