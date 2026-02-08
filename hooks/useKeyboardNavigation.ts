/**
 * 🎯 useKeyboardNavigation Hook
 *
 * Управляет навигацией по клавиатуре (Tab, Arrow keys, Escape)
 * Поддерживает focus trap для модалей и сохранение последней позиции фокуса
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { handleKeyboardEvent, handleTabNavigation } from '@/utils/a11y';

interface KeyboardNavigationOptions {
  onEscape?: () => void;
  onEnter?: () => void;
  trapFocus?: boolean; // Для модалей
  focusContainerId?: string;
}

export const useKeyboardNavigation = (options: KeyboardNavigationOptions) => {
  const containerRef = useRef<HTMLElement | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Получаем все фокусируемые элементы в контейнере
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current || Platform.OS !== 'web') return [];

    const focusableSelectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    return Array.from(
      containerRef.current.querySelectorAll(focusableSelectors)
    ) as HTMLElement[];
  }, []);

  // Обработка клавиатурных событий
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const focusableElements = getFocusableElements();

      if (options.trapFocus && focusableElements.length > 0) {
        handleTabNavigation(event, focusableElements, focusedIndex);
      }

      handleKeyboardEvent(event, {
        onEscape: options.onEscape,
        onEnter: options.onEnter,
      });
    },
    [focusedIndex, getFocusableElements, options]
  );

  // Установка ref на контейнер
  const setContainerRef = useCallback((element: HTMLElement | null) => {
    containerRef.current = element;
  }, []);

  // Возвращаемые значения
  return useMemo(() => ({
    containerRef: setContainerRef,
    onKeyDown: handleKeyDown,
    focusedIndex,
    setFocusedIndex,
    getFocusableElements,
  }), [setContainerRef, handleKeyDown, focusedIndex, setFocusedIndex, getFocusableElements]);
};

/**
 * 🎯 useFocusManager Hook
 *
 * Управляет фокусом и focus restoration
 * Сохраняет позицию фокуса перед открытием модаля и восстанавливает после закрытия
 */

export const useFocusManager = (_isActive = true) => {
  const savedFocusRef = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  // Сохраняем текущий фокус перед тем как переключиться на другой элемент
  const saveFocus = useCallback(() => {
    if (Platform.OS === 'web') {
      savedFocusRef.current = document.activeElement as HTMLElement;
    }
  }, []);

  // Восстанавливаем сохраненный фокус
  const restoreFocus = useCallback(() => {
    if (Platform.OS === 'web' && savedFocusRef.current) {
      savedFocusRef.current.focus();
      savedFocusRef.current = null;
    }
  }, []);

  // Фокусируемся на элементе ID
  const focusElement = useCallback((elementId: string) => {
    if (Platform.OS === 'web') {
      const element = document.getElementById(elementId);
      if (element) {
        element.focus();
      }
    }
  }, []);

  // Фокусируемся на первом интерактивном элементе в контейнере
  const focusFirstInteractive = useCallback(() => {
    if (!containerRef.current || Platform.OS !== 'web') return;

    const focusableSelectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const focusable = containerRef.current.querySelector(
      focusableSelectors
    ) as HTMLElement;
    focusable?.focus();
  }, []);

  return useMemo(() => ({
    containerRef,
    saveFocus,
    restoreFocus,
    focusElement,
    focusFirstInteractive,
  }), [containerRef, saveFocus, restoreFocus, focusElement, focusFirstInteractive]);
};

/**
 * 🎯 useAccessibilityAnnounce Hook
 *
 * Объявляет сообщения для screen readers (ARIA live regions)
 */

export const useAccessibilityAnnounce = () => {
  const [announcement, setAnnouncement] = useState('');
  const [priority, setPriority] = useState<'polite' | 'assertive'>('polite');

  const announce = useCallback(
    (message: string, isPriority = false) => {
      setPriority(isPriority ? 'assertive' : 'polite');
      setAnnouncement(message);

      // Очищаем объявление после того как оно прочитано
      const timeout = setTimeout(() => {
        setAnnouncement('');
      }, 1000);

      return () => clearTimeout(timeout);
    },
    []
  );

  return useMemo(() => ({
    announcement,
    priority,
    announce,
  }), [announcement, priority, announce]);
};

/**
 * 🎯 useReducedMotion Hook
 *
 * Проверяет предпочтения пользователя к сокращенному движению
 * Полезно для анимаций и переходов
 */

export const useReducedMotion = () => {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReduced(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return useMemo(() => ({
    prefersReduced,
    duration: prefersReduced ? 0 : 250,
    easing: prefersReduced ? 'linear' : 'ease-in-out',
  }), [prefersReduced]);
};

/**
 * 🎯 useFocusVisible Hook
 *
 * Управляет видимостью фокуса только для keyboard navigation
 * Скрывает фокус для мышиной навигации
 */

export const useFocusVisible = () => {
  const [isFocusVisible, setIsFocusVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsFocusVisible(true);
      }
    };

    const handleMouseDown = () => {
      setIsFocusVisible(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return useMemo(() => ({ isFocusVisible }), [isFocusVisible]);
};

/**
 * 🎯 useScrollAnnounce Hook
 *
 * Объявляет информацию о scroll позиции для screen readers
 */

export const useScrollAnnounce = (containerId: string, sectionName: string) => {
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const container = document.getElementById(containerId);
    if (!container) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      const scrollPercentage = Math.round(
        (container.scrollLeft / (container.scrollWidth - container.clientWidth)) * 100
      );

      if (scrollPercentage % 25 === 0) {
        setAnnouncement(
          `${sectionName}, ${scrollPercentage}% scrolled`
        );

        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          setAnnouncement('');
        }, 1000);
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (timeout) clearTimeout(timeout);
    };
  }, [containerId, sectionName]);

  return announcement;
};

export default {
  useKeyboardNavigation,
  useFocusManager,
  useAccessibilityAnnounce,
  useReducedMotion,
  useFocusVisible,
  useScrollAnnounce,
};
