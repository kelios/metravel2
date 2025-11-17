// Вспомогательные функции и компоненты для улучшения доступности
import React from 'react';
import { Platform, AccessibilityInfo } from 'react-native';

/**
 * Хук для объявления доступности экрана
 */
export function useScreenReader() {
  const [isScreenReaderEnabled, setIsScreenReaderEnabled] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS === 'web') {
      // Для веб проверяем наличие screen reader через ARIA
      setIsScreenReaderEnabled(
        typeof window !== 'undefined' &&
        (window.navigator.userAgent.includes('NVDA') ||
          window.navigator.userAgent.includes('JAWS') ||
          window.navigator.userAgent.includes('VoiceOver'))
      );
    } else {
      // Для нативных платформ используем AccessibilityInfo
      AccessibilityInfo.isScreenReaderEnabled().then(setIsScreenReaderEnabled);
      const subscription = AccessibilityInfo.addEventListener(
        'screenReaderChanged',
        setIsScreenReaderEnabled
      );
      return () => subscription.remove();
    }
  }, []);

  return isScreenReaderEnabled;
}

/**
 * Компонент для скрытого текста для screen readers
 */
export function ScreenReaderOnly({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        borderWidth: 0,
      }}
      aria-hidden="false"
    >
      {children}
    </span>
  );
}

/**
 * Хук для управления фокусом (для веб)
 */
export function useFocusManagement() {
  const focusRef = React.useRef<HTMLElement | null>(null);

  const focus = React.useCallback(() => {
    if (Platform.OS === 'web' && focusRef.current) {
      focusRef.current.focus();
    }
  }, []);

  const blur = React.useCallback(() => {
    if (Platform.OS === 'web' && focusRef.current) {
      focusRef.current.blur();
    }
  }, []);

  return { focusRef, focus, blur };
}

/**
 * Вспомогательная функция для генерации доступных ID
 */
export function generateAccessibleId(prefix: string, id: string | number): string {
  return `${prefix}-${id}`;
}

/**
 * Вспомогательная функция для форматирования текста для screen readers
 */
export function formatForScreenReader(text: string): string {
  // Удаляем лишние пробелы и форматируем для лучшей читаемости
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\./g, '. ')
    .replace(/,/g, ', ');
}

