// src/hooks/useAccessibility.ts
// ✅ Хук для улучшения доступности компонентов

import React, { useCallback, useMemo } from 'react';
import { Platform, AccessibilityInfo } from 'react-native';

export interface AccessibilityProps {
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: string;
  accessibilityState?: Record<string, boolean | string | number>;
  accessibilityValue?: { text?: string; min?: number; max?: number; now?: number };
}

/**
 * Хук для получения accessibility пропсов
 */
export function useAccessibility(
  label: string,
  options: {
    hint?: string;
    role?: string;
    state?: Record<string, boolean | string | number>;
    value?: { text?: string; min?: number; max?: number; now?: number };
  } = {}
): AccessibilityProps {
  const { hint, role = 'button', state, value } = options;

  return useMemo(
    () => ({
      accessibilityLabel: label,
      accessibilityHint: hint,
      accessibilityRole: role,
      ...(state && { accessibilityState: state }),
      ...(value && { accessibilityValue: value }),
    }),
    [label, hint, role, state, value]
  );
}

/**
 * Хук для проверки, включен ли screen reader
 */
export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS === 'web') {
      // Для веб проверяем наличие screen reader
      const checkScreenReader = () => {
        const ua = window.navigator.userAgent;
        return (
          ua.includes('NVDA') ||
          ua.includes('JAWS') ||
          ua.includes('VoiceOver') ||
          ua.includes('TalkBack')
        );
      };
      setEnabled(checkScreenReader());
    } else {
      // Для нативных платформ
      AccessibilityInfo.isScreenReaderEnabled().then(setEnabled);
      const subscription = AccessibilityInfo.addEventListener(
        'screenReaderChanged',
        setEnabled
      );
      return () => subscription.remove();
    }
  }, []);

  return enabled;
}

/**
 * Хук для управления фокусом (для веб)
 */
export function useFocusManagement() {
  const focusRef = React.useRef<HTMLElement | null>(null);

  const focus = useCallback(() => {
    if (Platform.OS === 'web' && focusRef.current) {
      focusRef.current.focus();
    }
  }, []);

  const blur = useCallback(() => {
    if (Platform.OS === 'web' && focusRef.current) {
      focusRef.current.blur();
    }
  }, []);

  return { focusRef, focus, blur };
}

/**
 * Создает accessibility пропсы для кнопки
 */
export function useButtonAccessibility(
  label: string,
  options: {
    hint?: string;
    disabled?: boolean;
    pressed?: boolean;
    selected?: boolean;
  } = {}
): AccessibilityProps {
  const { hint, disabled, pressed, selected } = options;

  return useAccessibility(label, {
    role: 'button',
    hint,
    state: {
      ...(disabled !== undefined && { disabled }),
      ...(pressed !== undefined && { pressed }),
      ...(selected !== undefined && { selected }),
    },
  });
}

/**
 * Создает accessibility пропсы для ссылки
 */
export function useLinkAccessibility(
  label: string,
  options: {
    hint?: string;
    visited?: boolean;
  } = {}
): AccessibilityProps {
  const { hint, visited } = options;

  return useAccessibility(label, {
    role: 'link',
    hint,
    state: {
      ...(visited !== undefined && { selected: visited }),
    },
  });
}

/**
 * Создает accessibility пропсы для изображения
 */
export function useImageAccessibility(
  alt: string,
  options: {
    decorative?: boolean;
  } = {}
): AccessibilityProps {
  const { decorative } = options;

  const imageProps = useAccessibility(alt, {
    role: 'image',
  });

  if (decorative) {
    return {
      accessibilityRole: 'none',
      accessibilityLabel: undefined,
    };
  }

  return imageProps;
}
