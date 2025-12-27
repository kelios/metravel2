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

          const canScrollNode = (node: any): node is HTMLElement => {
            if (!node) return false;
            if (typeof node.getBoundingClientRect !== 'function') return false;
            const sh = Number((node as any).scrollHeight ?? 0);
            const ch = Number((node as any).clientHeight ?? 0);
            const canScrollBySize = sh > ch + 2;
            return canScrollBySize;
          };

          // Если у нас есть реальный scroll container (а не window) — скроллим его напрямую
          if (canScrollNode(scrollNode)) {
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
            try {
              const win = (typeof window !== 'undefined' ? window : undefined) as any;
              if (win && typeof win.scrollTo === 'function' && typeof el.getBoundingClientRect === 'function') {
                const rect = el.getBoundingClientRect();
                const pageTop = (win.pageYOffset ?? 0) + rect.top;
                // 88px — безопасный отступ под фиксированный header
                const targetTop = Math.max(0, pageTop - 88);
                win.scrollTo({ top: targetTop, left: 0, behavior: 'smooth' });
                return;
              }
            } catch {
              // noop
            }

            // Ultimate fallback
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

