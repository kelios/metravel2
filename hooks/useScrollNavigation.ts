/**
 * Кастомный хук для управления навигацией по секциям через скролл
 * Создает anchors и предоставляет функцию скролла к секциям
 */

import { useMemo, useRef, useCallback } from 'react';
import { View, ScrollView, Platform } from 'react-native';
import React from 'react';

export interface UseScrollNavigationReturn {
  anchors: Record<string, React.RefObject<View>>;
  scrollTo: (key: string) => void;
  scrollRef: React.RefObject<ScrollView>;
}

const SECTION_KEYS = [
  'gallery',
  'video',
  'description',
  'recommendation',
  'plus',
  'minus',
  'map',
  'points',
  'near',
  'popular',
  'excursions',
] as const;

export function useScrollNavigation(): UseScrollNavigationReturn {
  const scrollRef = useRef<ScrollView>(null);

  // ✅ АРХИТЕКТУРА: Создаем anchors объект из списка ключей
  const anchors = useMemo(() => {
    const result: Record<string, React.RefObject<View>> = {};
    SECTION_KEYS.forEach((key) => {
      result[key] = React.createRef<View>();
    });
    return result;
  }, []);

  const scrollTo = useCallback(
    (key: string) => {
      // Веб: пытаемся использовать DOM и data-section-key для более стабильной прокрутки
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const el = document.querySelector<HTMLElement>(`[data-section-key="${key}"]`);
        if (el) {
          const scrollViewAny = scrollRef.current as any;
          const scrollNode: HTMLElement | null =
            (typeof scrollViewAny?.getScrollableNode === 'function' && scrollViewAny.getScrollableNode()) ||
            scrollViewAny?._scrollNode ||
            scrollViewAny?._innerViewNode ||
            scrollViewAny?._nativeNode ||
            scrollViewAny?._domNode ||
            null;

          // Если у нас есть реальный scroll container (а не window) — скроллим его напрямую
          if (scrollNode && typeof scrollNode.getBoundingClientRect === 'function') {
            const containerRect = scrollNode.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const currentTop = (scrollNode as any).scrollTop ?? 0;
            const targetTop = currentTop + (elRect.top - containerRect.top);

            if (typeof (scrollNode as any).scrollTo === 'function') {
              (scrollNode as any).scrollTo({ top: targetTop, behavior: 'smooth' });
              return;
            }

            // Fallback: редкий случай без scrollTo
            try {
              (scrollNode as any).scrollTop = targetTop;
              return;
            } catch {
              // noop
            }
          }

          // Последний fallback: пусть браузер сам решит (может проскроллить window)
          if (typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
            return;
          }
        }
      }

      const anchor = anchors[key];
      if (anchor?.current && scrollRef.current) {
        anchor.current.measureLayout(
          scrollRef.current as any,
          (x, y) => {
            scrollRef.current?.scrollTo({ y, animated: true });
          },
          () => {
            // Fallback: если measureLayout не сработал, логируем предупреждение
            console.warn(`Could not measure layout for section: ${key}`);
          }
        );
      }
    },
    [anchors]
  );

  return {
    anchors,
    scrollTo,
    scrollRef,
  };
}

