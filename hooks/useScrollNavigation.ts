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
  const pendingRetriesRef = useRef<Record<string, Array<ReturnType<typeof setTimeout>>>>({});

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
      const dbg =
        Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        (window as any).__NAV_DEBUG__;

      if (dbg) {
        // eslint-disable-next-line no-console
        console.debug('[nav] scrollTo called', { key });
      }

      const clearPending = (k: string) => {
        const timers = pendingRetriesRef.current[k];
        if (timers && timers.length) {
          timers.forEach((t) => clearTimeout(t));
        }
        delete pendingRetriesRef.current[k];
      };

      const tryScrollWeb = (k: string): boolean => {
        if (Platform.OS !== 'web' || typeof document === 'undefined') return false;

        const resolveElement = (): HTMLElement | null => {
          // Primary: by data attribute (stable across re-renders)
          const byAttr = document.querySelector<HTMLElement>(`[data-section-key="${k}"]`);
          if (byAttr) return byAttr;

          // Fallback: by ref (useful when the section mounted lazily and attribute is not yet assigned)
          try {
            const refAny: any = (anchors as any)?.[k];
            const current: any = refAny?.current;
            const node: any = current?._nativeNode || current?._domNode || current;
            if (!node) return null;
            if (typeof node.getBoundingClientRect !== 'function') return null;

            if (typeof node.setAttribute === 'function') {
              const existing = typeof node.getAttribute === 'function' ? node.getAttribute('data-section-key') : null;
              if (!existing) {
                node.setAttribute('data-section-key', k);
              }
            }

            return node as HTMLElement;
          } catch {
            return null;
          }
        };

        const el = resolveElement();
        if (dbg) {
          // eslint-disable-next-line no-console
          console.debug('[nav] scrollTo lookup', { key: k, found: !!el });
        }
        if (!el) return false;

        const getHeaderOffset = (): number => {
          try {
            const header = document.querySelector('header');
            const h = header?.getBoundingClientRect?.().height;
            if (typeof h === 'number' && isFinite(h)) {
              return Math.max(60, Math.min(160, Math.round(h)));
            }
          } catch {
            // noop
          }
          return 88;
        };

        const isDocumentScrollContainer = (node: any): boolean => {
          if (!node) return false;
          const docAny = document as any;
          const scrollingEl = (document.scrollingElement || docAny.documentElement || docAny.body) as any;
          return node === window || node === document || node === docAny.body || node === docAny.documentElement || node === scrollingEl;
        };

        const shouldApplyHeaderOffset = (container: any): boolean => {
          try {
            const headerH = getHeaderOffset();
            if (!headerH) return false;

            // If we are scrolling the document/window, the header always overlaps the viewport.
            if (isDocumentScrollContainer(container)) return true;

            // For nested scroll containers, apply offset only when the container is under the header.
            if (container && typeof container.getBoundingClientRect === 'function') {
              const rect = container.getBoundingClientRect();
              const top = Number(rect?.top ?? 0);
              // If container starts below the header, don't offset.
              return top < headerH - 4;
            }
          } catch {
            // noop
          }
          return false;
        };

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

        {
          const safeScrollTo = (node: any, top: number): boolean => {
            if (!node) return false;
            const before = Number(node.scrollTop ?? 0);
            let didCall = false;

            // 1) Standard DOM signature: scrollTo({ top, behavior })
            try {
              if (typeof node.scrollTo === 'function') {
                node.scrollTo({ top, behavior: 'smooth' });
                didCall = true;
              }
            } catch {
              // noop
            }

            // If scrollTop didn't change, RNW/webview polyfills may expect x/y/animated object signature
            try {
              const afterObj = Number(node.scrollTop ?? 0);
              if (typeof node.scrollTo === 'function' && (!didCall || Math.abs(afterObj - before) < 1)) {
                node.scrollTo({ x: 0, y: top, animated: true });
                didCall = true;
              }
            } catch {
              // noop
            }

            // Final fallback: assign scrollTop
            try {
              const afterNum = Number(node.scrollTop ?? 0);
              if (Math.abs(afterNum - before) < 1) {
                node.scrollTop = top;
                didCall = true;
              }
            } catch {
              // noop
            }

            return didCall;
          };

          const safeScrollBy = (node: any, deltaTop: number): boolean => {
            if (!node) return false;
            const before = Number(node.scrollTop ?? 0);
            let didCall = false;

            // 1) Standard DOM signature: scrollBy({ top, left })
            try {
              if (typeof node.scrollBy === 'function') {
                node.scrollBy({ top: deltaTop, left: 0, behavior: 'instant' });
                didCall = true;
              }
            } catch {
              // noop
            }

            // 2) Numeric signature: scrollBy(x, y)
            try {
              const afterObj = Number(node.scrollTop ?? 0);
              if (typeof node.scrollBy === 'function' && (!didCall || Math.abs(afterObj - before) < 1)) {
                node.scrollBy(0, deltaTop);
                didCall = true;
              }
            } catch {
              // noop
            }

            // 3) Manual fallback
            try {
              const afterNum = Number(node.scrollTop ?? 0);
              if (Math.abs(afterNum - before) < 1) {
                node.scrollTop = before + deltaTop;
                didCall = true;
              }
            } catch {
              // noop
            }

            return didCall;
          };

          const scrollViewAny = scrollRef.current as any;
          const scrollNode: HTMLElement | null =
            (typeof scrollViewAny?.getScrollableNode === 'function' && scrollViewAny.getScrollableNode()) ||
            scrollViewAny?._scrollNode ||
            scrollViewAny?._innerViewNode ||
            scrollViewAny?._nativeNode ||
            scrollViewAny?._domNode ||
            null;

          const bestScrollContainer =
            (canScrollNode(scrollNode) ? scrollNode : null) || findScrollableAncestor(el.parentElement);

          if (dbg) {
            // eslint-disable-next-line no-console
            console.debug('[nav] scrollTo container', {
              hasScrollNode: !!scrollNode,
              best: !!bestScrollContainer,
              bestTag: (bestScrollContainer as any)?.tagName,
              bestId: (bestScrollContainer as any)?.id,
            });
          }

          // Если у нас есть реальный scroll container (а не window) — скроллим его напрямую
          if (bestScrollContainer && typeof bestScrollContainer.getBoundingClientRect === 'function') {
            const containerRect = bestScrollContainer.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const currentTop = (bestScrollContainer as any).scrollTop ?? 0;
            const targetTopRaw = currentTop + (elRect.top - containerRect.top);
            const targetTop = Math.max(0, Math.round(targetTopRaw));

            if (dbg) {
              // eslint-disable-next-line no-console
              console.debug('[nav] scrollTo computed', { currentTop, targetTop });
            }

            if (safeScrollTo(bestScrollContainer as any, targetTop)) {
              const HEADER_OFFSET = getHeaderOffset();
              if (HEADER_OFFSET > 0 && typeof (bestScrollContainer as any).scrollBy === 'function') {
                setTimeout(() => {
                  try {
                    const safeOffset = Math.min(HEADER_OFFSET, targetTop);
                    safeScrollBy(bestScrollContainer as any, -safeOffset);
                  } catch {
                    // noop
                  }
                }, 0);
              }
              return true;
            }
          }

          // Fallback: scrollIntoView (браузер сам выбирает scroll container)
          if (typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });

            const HEADER_OFFSET = getHeaderOffset();
            setTimeout(() => {
              try {
                const bestAfter = findScrollableAncestor(el.parentElement);
                const safeOffset = Math.max(0, HEADER_OFFSET);
                if (bestAfter && typeof (bestAfter as any).scrollBy === 'function') {
                  const shouldOffset = shouldApplyHeaderOffset(bestAfter as any);
                  if (shouldOffset) {
                    (bestAfter as any).scrollBy({ top: -safeOffset, left: 0, behavior: 'instant' });
                  }
                  return;
                }

                const win = (typeof window !== 'undefined' ? window : undefined) as any;
                if (win && typeof win.scrollBy === 'function') {
                  win.scrollBy({ top: -safeOffset, left: 0, behavior: 'instant' });
                }
              } catch {
                // noop
              }
            }, 0);

            return true;
          }
        }

        return false;
      }

      // Веб: пытаемся использовать DOM и data-section-key для более стабильной прокрутки.
      // Если секция рендерится лениво (defer/lazy), делаем ретраи, чтобы дождаться DOM.
      if (Platform.OS === 'web') {
        clearPending(key);
        if (tryScrollWeb(key)) return;

        // Не спамим бесконечными попытками: максимум ~6с ожидания.
        const MAX_ATTEMPTS = 60;
        const INTERVAL_MS = 100;
        pendingRetriesRef.current[key] = [];

        for (let i = 1; i <= MAX_ATTEMPTS; i += 1) {
          const t = setTimeout(() => {
            if (tryScrollWeb(key)) {
              clearPending(key);
            } else if (i === MAX_ATTEMPTS) {
              clearPending(key);
              if (dbg) {
                // eslint-disable-next-line no-console
                console.debug('[nav] scrollTo gave up (section not found)', { key });
              }
            }
          }, i * INTERVAL_MS);
          pendingRetriesRef.current[key]!.push(t);
        }
        return;
      }

      const anchor = anchors[key];
      if (anchor?.current && scrollRef.current) {
        anchor.current.measureLayout(
          scrollRef.current as any,
          (_x, y) => {
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
