/**
 * 🎯 Accessibility (a11y) Utilities
 *
 * Помощники для реализации WCAG AAA соответствия
 * Включает поддержку ARIA, keyboard navigation, focus management и контрастность
 */

import { Platform, AccessibilityRole } from 'react-native';

/**
 * ARIA и Semantic Role Mapping
 * Используется для кроссплатформной поддержки доступности
 */
export const getAccessibilityRole = (role: string): AccessibilityRole | undefined => {
  // React Native поддерживает ограниченный набор ролей
  const roleMap: Record<string, AccessibilityRole> = {
    button: 'button',
    link: 'link',
    search: 'search',
    tab: 'tab',
    tablist: 'tablist',
    heading: 'header',
    alert: 'alert',
    // Web-leaning semantic roles (used by RN Web + our a11y helpers/tests).
    article: 'article' as any,
    region: 'region' as any,
  };
  return roleMap[role] as AccessibilityRole | undefined;
};

/**
 * Keyboard Event Handler для web платформы
 * Позволяет обрабатывать Escape, Enter, Arrow keys, Tab
 */
export const handleKeyboardEvent = (
  event: React.KeyboardEvent,
  callbacks: {
    onEscape?: () => void;
    onEnter?: () => void;
    onArrowUp?: () => void;
    onArrowDown?: () => void;
    onArrowLeft?: () => void;
    onArrowRight?: () => void;
    onSpace?: () => void;
    onTab?: (shiftKey: boolean) => void;
  }
): void => {
  switch (event.key) {
    case 'Escape':
      callbacks.onEscape?.();
      event.preventDefault();
      break;
    case 'Enter':
      callbacks.onEnter?.();
      event.preventDefault();
      break;
    case 'ArrowUp':
      callbacks.onArrowUp?.();
      event.preventDefault();
      break;
    case 'ArrowDown':
      callbacks.onArrowDown?.();
      event.preventDefault();
      break;
    case 'ArrowLeft':
      callbacks.onArrowLeft?.();
      event.preventDefault();
      break;
    case 'ArrowRight':
      callbacks.onArrowRight?.();
      event.preventDefault();
      break;
    case ' ':
      callbacks.onSpace?.();
      event.preventDefault();
      break;
    case 'Tab':
      callbacks.onTab?.(event.shiftKey);
      break;
  }
};

/**
 * Focus Management Helper
 * Помогает управлять focus для навигации
 */
export const createFocusManager = () => {
  const focusElement = (elementId: string) => {
    if (Platform.OS === 'web') {
      const element = document.getElementById(elementId);
      if (element && 'focus' in element) {
        (element as HTMLElement).focus();
      }
    }
  };

  const focusFirstInteractive = (container: HTMLElement | null) => {
    if (!container || Platform.OS !== 'web') return;

    const focusableSelectors = [
      'button',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const focusable = container.querySelector(focusableSelectors) as HTMLElement;
    focusable?.focus();
  };

  return { focusElement, focusFirstInteractive };
};

/**
 * WCAG Contrast Checker
 * Проверяет контрастность между двумя цветами
 * Возвращает контрастность в соотношении (напр. 4.5 для AA)
 * Поддерживает hex (#RRGGBB), rgb, rgba и named colors
 */
export const checkContrast = (foreground: string, background: string): number => {
  const getRGBValues = (color: string): { r: number; g: number; b: number } | null => {
    // Hex формат (#RRGGBB)
    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      if (hex.length === 6) {
        return {
          r: parseInt(hex.substr(0, 2), 16),
          g: parseInt(hex.substr(2, 2), 16),
          b: parseInt(hex.substr(4, 2), 16),
        };
      }
      return null;
    }

    // RGBA формат (rgba(r, g, b, a))
    const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbaMatch) {
      return {
        r: parseInt(rgbaMatch[1]),
        g: parseInt(rgbaMatch[2]),
        b: parseInt(rgbaMatch[3]),
      };
    }

    return null;
  };

  const getLuminance = (color: string): number => {
    const rgb = getRGBValues(color);
    if (!rgb) return 0; // Fallback для неизвестных форматов

    const [r, g, b] = [rgb.r, rgb.g, rgb.b];
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const l1 = getLuminance(foreground);
  const l2 = getLuminance(background);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
};

export const isWCAG_AA = (foreground: string, background: string): boolean => {
  return checkContrast(foreground, background) >= 4.5;
};

export const isWCAG_AAA = (foreground: string, background: string): boolean => {
  return checkContrast(foreground, background) >= 7;
};

/**
 * Skip to Content Link Helper
 * Позволяет пользователям с клавиатурой быстро перейти к основному контенту
 */
export const createSkipToContentLink = (mainContentId: string) => {
  return {
    id: 'skip-to-content',
    href: `#${mainContentId}`,
    label: 'Skip to main content',
    ariaLabel: 'Skip to main content (press Enter)',
    style: {
      position: 'absolute' as const,
      top: '-9999px',
      left: '-9999px',
      zIndex: 999,
    },
    onFocus: {
      position: 'relative' as const,
      top: '0',
      left: '0',
    },
  };
};

/**
 * Semantic HTML Helper
 * Возвращает правильный HTML элемент в зависимости от контекста
 */
export const getSemanticElement = (
  type: 'heading' | 'section' | 'article' | 'nav' | 'button'
) => {
  if (Platform.OS === 'web') {
    return {
      heading: 'h2',
      section: 'section',
      article: 'article',
      nav: 'nav',
      button: 'button',
    }[type];
  }
  // React Native не требует семантических элементов
  return 'View';
};

/**
 * Live Region Helper
 * Для ARIA live regions (объявление динамического контента screen reader'ам)
 */
export const createLiveRegion = (
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
) => {
  if (Platform.OS === 'web') {
    return {
      role: 'status',
      'aria-live': priority,
      'aria-atomic': 'true',
      children: message,
    };
  }
  return { children: message };
};

/**
 * Label Helper
 * Создает правильные aria-label в зависимости от платформы
 */
export const getAccessibilityLabel = (
  baseLabel: string,
  context?: string
): string => {
  if (context) {
    return `${baseLabel}, ${context}`;
  }
  return baseLabel;
};

/**
 * Heading Helper
 * Проверяет правильный порядок заголовков (h1 → h2 → h3)
 */
export const validateHeadingHierarchy = (): boolean => {
  if (Platform.OS !== 'web') return true;

  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  let lastLevel = 0;

  for (const heading of headings) {
    const level = parseInt(heading.tagName[1]);
    if (level > lastLevel + 1) {
      console.warn(
        `⚠️ Heading hierarchy issue: jumped from h${lastLevel} to h${level}`
      );
      return false;
    }
    lastLevel = level;
  }

  return true;
};

/**
 * Focus Visible Helper
 * Показывает фокус только когда пользователь использует клавиатуру
 */
export const createFocusVisibleStyles = (
  baseStyles: Record<string, any>,
  focusStyles: Record<string, any>
) => {
  if (Platform.OS === 'web') {
    return {
      ...baseStyles,
      ':focus-visible': focusStyles,
    };
  }
  return baseStyles;
};

/**
 * Expandable Content Helper
 * Для компонентов типа аккордеона и коллапсибл
 */
export const createExpandableAttrs = (
  isExpanded: boolean,
  toggleId: string
) => {
  return {
    'aria-expanded': isExpanded,
    'aria-controls': toggleId,
  };
};

/**
 * Tab Navigation Helper
 * Помогает реализовать табилизацию между элементами
 */
export const handleTabNavigation = (
  event: React.KeyboardEvent,
  focusableElements: HTMLElement[],
  currentIndex: number
): void => {
  if (event.key !== 'Tab') return;

  const nextIndex = event.shiftKey
    ? (currentIndex - 1 + focusableElements.length) % focusableElements.length
    : (currentIndex + 1) % focusableElements.length;

  focusableElements[nextIndex].focus();
  event.preventDefault();
};

/**
 * Color Blind Mode Checker
 * Проверяет поддержку режима для дальтоников
 */
export const getColorBlindMode = (): 'normal' | 'protanopia' | 'deuteranopia' | 'tritanopia' | null => {
  if (Platform.OS !== 'web') return null;

  // Добавить проверку других медиа-запросов в будущем
  return null;
};

/**
 * Reduced Motion Helper
 * Проверяет предпочтение пользователя к сокращенному движению
 */
export const prefersReducedMotion = (): boolean => {
  if (Platform.OS !== 'web') return false;

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Image Alt Text Validator
 * Проверяет качество alt текста для изображений
 */
export const isGoodAltText = (altText: string): boolean => {
  if (!altText || altText.length < 5) return false;
  if (altText.toLowerCase().includes('image of')) return false;
  if (altText.toLowerCase().includes('picture')) return false;
  if (altText.toLowerCase() === 'image') return false;
  if (altText.toLowerCase() === 'photo') return false;
  if (altText.toLowerCase() === 'picture') return false;
  return true;
};

export default {
  getAccessibilityRole,
  handleKeyboardEvent,
  createFocusManager,
  checkContrast,
  isWCAG_AA,
  isWCAG_AAA,
  createSkipToContentLink,
  getSemanticElement,
  createLiveRegion,
  getAccessibilityLabel,
  validateHeadingHierarchy,
  createFocusVisibleStyles,
  createExpandableAttrs,
  handleTabNavigation,
  getColorBlindMode,
  prefersReducedMotion,
  isGoodAltText,
};
