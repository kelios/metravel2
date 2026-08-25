// hooks/useFocusTrap.ts
// УЛУЧШЕНИЕ: Хук для trap focus в модальных окнах

import { useEffect, useLayoutEffect, useRef, RefObject } from 'react';
import { Platform } from 'react-native';

interface UseFocusTrapOptions {
  enabled?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  returnFocus?: RefObject<HTMLElement | null>;
}

const activeFocusTraps: HTMLElement[] = [];

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  options: UseFocusTrapOptions = {}
) {
  const { enabled = true, initialFocus, returnFocus } = options;
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const effect = Platform.OS === 'web' ? useLayoutEffect : useEffect;

  effect(() => {
    if (Platform.OS !== 'web' || !enabled || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    // Defensive: on non-DOM web renderers (RN test renderer, some SSR paths) the
    // container ref may resolve to a host instance without DOM query APIs.
    if (typeof container.querySelectorAll !== 'function') {
      return;
    }

    activeFocusTraps.push(container);

    const focusableElements = container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Сохраняем текущий активный элемент для возврата фокуса
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Фокусируемся на первом элементе или указанном элементе
    if (initialFocus?.current) {
      initialFocus.current.focus();
    } else if (firstElement) {
      firstElement.focus();
    }

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || activeFocusTraps.at(-1) !== container) return;

      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }

      // A stacked/third-party modal can move focus between key events. Recover
      // into this trap instead of letting the next Tab continue outside it.
      if (!(document.activeElement instanceof Node) || !container.contains(document.activeElement)) {
        e.preventDefault();
        if (e.shiftKey) {
          lastElement?.focus();
        } else {
          firstElement?.focus();
        }
        return;
      }

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        activeFocusTraps.at(-1) === container &&
        returnFocus?.current
      ) {
        returnFocus.current.focus();
      }
    };

    // Listen on document capture, not only on the container: if another modal
    // moves focus outside, the next Tab is targeted there and would otherwise
    // never reach the trap. Only the latest mounted trap owns the keyboard.
    document.addEventListener('keydown', handleTab, true);
    document.addEventListener('keydown', handleEscape);

    const returnFocusEl = returnFocus?.current;
    const prevActive = previousActiveElement.current;

    return () => {
      document.removeEventListener('keydown', handleTab, true);
      document.removeEventListener('keydown', handleEscape);
      const trapIndex = activeFocusTraps.lastIndexOf(container);
      if (trapIndex >= 0) activeFocusTraps.splice(trapIndex, 1);

      // Возвращаем фокус при размонтировании
      const focusTarget = returnFocusEl || prevActive;
      if (focusTarget) {
        requestAnimationFrame(() => {
          focusTarget.focus();
        });
      }
    };
  }, [enabled, containerRef, initialFocus, returnFocus]);
}
