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
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

    const getFocusableElements = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => {
          if (
            element.tabIndex < 0 ||
            element.closest('[hidden], [inert], [aria-hidden="true"]')
          ) {
            return false;
          }

          if (
            element.tagName === 'INPUT' &&
            element.getAttribute('type')?.toLowerCase() === 'hidden'
          ) {
            return false;
          }

          const view = element.ownerDocument.defaultView;
          for (
            let current: HTMLElement | null = element;
            current;
            current = current.parentElement
          ) {
            const styles = view?.getComputedStyle(current);
            if (styles?.display === 'none' || styles?.visibility === 'hidden') {
              return false;
            }
            if (current === container) break;
          }

          return true;
        }
      );

    // Сохраняем текущий активный элемент для возврата фокуса
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Фокусируемся на первом элементе или указанном элементе. RN Web Modal
    // может восстановить фокус родительского диалога в том же commit, поэтому
    // повторяем фокус после paint — это особенно важно для вложенных modal.
    const focusInitialElement = () => {
      // The delayed frame belongs only to the current topmost trap. A newer
      // modal may mount before this callback runs; the stale lower frame must
      // not pull focus back underneath it.
      if (activeFocusTraps.at(-1) !== container) return;
      const focusableElements = getFocusableElements();
      const initialTarget = initialFocus?.current;
      const focusTarget = initialTarget && focusableElements.includes(initialTarget)
        ? initialTarget
        : focusableElements[0];
      focusTarget?.focus();
    };
    focusInitialElement();
    const initialFocusFrame =
      typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame(focusInitialElement)
        : null;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || activeFocusTraps.at(-1) !== container) return;

      // Re-read the controls for every key event. RN Web can rerender a
      // Pressable while the dialog is open, so a NodeList captured on mount is
      // not a reliable boundary for the complete lifetime of the trap.
      const focusableElements = getFocusableElements();
      e.preventDefault();

      if (focusableElements.length === 0) {
        return;
      }

      // Own every Tab transition instead of delegating intermediate movement
      // to the browser/RNW focus scope. This keeps the active topmost trap
      // deterministic even if another modal moved focus between key events.
      const currentIndex = document.activeElement instanceof HTMLElement
        ? focusableElements.indexOf(document.activeElement)
        : -1;
      const nextIndex = e.shiftKey
        ? currentIndex <= 0
          ? focusableElements.length - 1
          : currentIndex - 1
        : currentIndex < 0 || currentIndex === focusableElements.length - 1
          ? 0
          : currentIndex + 1;

      focusableElements[nextIndex]?.focus();
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
      if (initialFocusFrame !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(initialFocusFrame);
      }
      document.removeEventListener('keydown', handleTab, true);
      document.removeEventListener('keydown', handleEscape);
      const trapIndex = activeFocusTraps.lastIndexOf(container);
      if (trapIndex >= 0) activeFocusTraps.splice(trapIndex, 1);

      // Возвращаем фокус при размонтировании
      const focusTarget = returnFocusEl || prevActive;
      if (focusTarget) {
        // RN Web Modal restores its own saved target from a passive-effect
        // cleanup. That cleanup can run after this hook's first post-layout
        // frame and overwrite the trigger focus (most often after Cancel).
        // Re-check once on the following frame, but only while no newer trap
        // has taken ownership; a closing dialog must never steal focus from a
        // newly opened one.
        const expectedTopTrap = activeFocusTraps.at(-1) ?? null;
        const canRestoreFocus = () => {
          const targetIsConnected =
            !('isConnected' in focusTarget) || focusTarget.isConnected;
          return (activeFocusTraps.at(-1) ?? null) === expectedTopTrap && targetIsConnected;
        };
        const restoreFocus = () => {
          if (canRestoreFocus()) focusTarget.focus();
        };

        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(() => {
            restoreFocus();
            window.requestAnimationFrame(() => {
              if (document.activeElement !== focusTarget) restoreFocus();
            });
          });
        } else {
          restoreFocus();
        }
      }
    };
  }, [enabled, containerRef, initialFocus, returnFocus]);
}
