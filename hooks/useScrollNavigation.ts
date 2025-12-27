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

          const findScrollableAncestor = (start: HTMLElement | null): HTMLElement | null => {
            if (!start) return null;
            let node: HTMLElement | null = start;
            while (node && node !== document.body) {
              try {
                const style = window.getComputedStyle(node);
                const overflowY = style?.overflowY;
                const isScrollableOverflow = overflowY === 'auto' || overflowY === 'scroll';
                if (isScrollableOverflow && canScrollNode(node)) {
                  return node;
                }
              } catch {
                // noop
              }
              node = node.parentElement;
            }
            return null;
          };

          const bestScrollContainer =
            (canScrollNode(scrollNode) ? scrollNode : null) || findScrollableAncestor(el.parentElement);

          // Если у нас есть реальный scroll container (а не window) — скроллим его напрямую
          if (canScrollNode(scrollNode)) {
            const containerRect = scrollNode.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const currentTop = (scrollNode as any).scrollTop ?? 0;
            const targetTop = currentTop + (elRect.top - containerRect.top);

            if (typeof (bestScrollContainer as any).scrollTo === 'function') {
              (bestScrollContainer as any).scrollTo({ top: targetTop, behavior: 'smooth' });
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

          // Надёжный fallback: пусть браузер сам найдет ближайший scroll container.
          // После scrollIntoView корректируем позицию под фиксированный header.
          if (typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });

            // 88px — безопасный отступ под фиксированный header
            const HEADER_OFFSET = 88;
            setTimeout(() => {
              try {
                if (canScrollNode(scrollNode) && typeof (scrollNode as any).scrollBy === 'function') {
                  (scrollNode as any).scrollBy({ top: -HEADER_OFFSET, left: 0, behavior: 'instant' });
                  return;
                }
                const win = (typeof window !== 'undefined' ? window : undefined) as any;
                if (win && typeof win.scrollBy === 'function') {
                  win.scrollBy({ top: -HEADER_OFFSET, left: 0, behavior: 'instant' });
                }
              } catch {
                // noop
              }
            }, 0);

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

