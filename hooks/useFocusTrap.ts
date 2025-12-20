// hooks/useFocusTrap.ts
// ✅ УЛУЧШЕНИЕ: Хук для trap focus в модальных окнах

import { useEffect, useRef, RefObject } from 'react';
import { Platform } from 'react-native';

interface UseFocusTrapOptions {
  enabled?: boolean;
  initialFocus?: RefObject<HTMLElement>;
  returnFocus?: RefObject<HTMLElement>;
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement>,
  options: UseFocusTrapOptions = {}
) {
  const { enabled = true, initialFocus, returnFocus } = options;
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
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
      if (e.key !== 'Tab') return;

      if (focusableElements.length === 0) {
        e.preventDefault();
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
      if (e.key === 'Escape' && returnFocus?.current) {
        returnFocus.current.focus();
      }
    };

    container.addEventListener('keydown', handleTab);
    document.addEventListener('keydown', handleEscape);

    const returnFocusEl = returnFocus?.current;
    const prevActive = previousActiveElement.current;

    return () => {
      container.removeEventListener('keydown', handleTab);
      document.removeEventListener('keydown', handleEscape);

      // Возвращаем фокус при размонтировании
      if (returnFocusEl) {
        returnFocusEl.focus();
      } else if (prevActive) {
        prevActive.focus();
      }
    };
  }, [enabled, containerRef, initialFocus, returnFocus]);
}

