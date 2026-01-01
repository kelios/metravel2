/**
 * ARIA Live Region Component
 * Announces dynamic content to screen readers
 */

import React, { useEffect, useRef } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { useThemedColors } from '@/hooks/useTheme';

type LiveRegionRole = 'polite' | 'assertive' | 'alert';
type LiveRegionAtomic = 'true' | 'false';

interface LiveRegionProps {
  message?: string;
  role?: LiveRegionRole;
  atomic?: LiveRegionAtomic;
  visible?: boolean;
  testID?: string;
}

/**
 * Компонент для объявления сообщений screen reader'ом
 *
 * Примеры использования:
 * - "Загружаю путешествия..."
 * - "Ошибка загрузки. Повторите попытку."
 * - "Успешно сохранено!"
 */
export const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  role = 'polite',
  atomic = 'true',
  visible = true,
  testID,
}) => {
  const colors = useThemedColors();
  const liveRegionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!message || !liveRegionRef.current) return;

    // Убедитесь что элемент видим для a11y tree
    liveRegionRef.current.setAttribute('aria-live', role);
    liveRegionRef.current.setAttribute('aria-atomic', atomic);

    // Некоторые screen readers требуют небольшую задержку перед читкой
    const timer = setTimeout(() => {
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = message;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [message, role, atomic]);

  if (Platform.OS !== 'web') {
    return (
      <View
        style={[styles.nativeRegion, !visible && styles.hidden]}
        accessibilityLiveRegion={role === 'assertive' ? 'assertive' : 'polite'}
        accessibilityLabel={message}
      >
        <Text style={[styles.text, { color: colors.text }]}>{message}</Text>
      </View>
    );
  }

  return (
    <div
      ref={liveRegionRef}
      role="status"
      aria-live={role}
      aria-atomic={atomic}
      style={{
        ...styles.webRegion,
        display: visible ? 'block' : 'none',
      } as React.CSSProperties}
      data-testid={testID}
    >
      {message}
    </div>
  );
};

/**
 * Hook для управления live region сообщениями
 */
export function useLiveRegion() {
  const [message, setMessage] = React.useState<string>('');
  const [role, setRole] = React.useState<LiveRegionRole>('polite');
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

  const announce = React.useCallback(
    (text: string, announceRole: LiveRegionRole = 'polite', duration = 3000) => {
      setMessage(text);
      setRole(announceRole);

      // Очистить предыдущий timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Автоматически очистить сообщение после duration
      if (duration > 0) {
        timeoutRef.current = setTimeout(() => {
          setMessage('');
        }, duration);
      }
    },
    []
  );

  const clear = React.useCallback(() => {
    setMessage('');
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { message, role, announce, clear };
}

/**
 * Специфичные компоненты для разных типов объявлений
 */

export const StatusMessage: React.FC<{ message: string }> = ({ message }) => (
  <LiveRegion message={message} role="polite" testID="status-message" />
);

export const ErrorMessage: React.FC<{ message: string }> = ({ message }) => (
  <LiveRegion message={message} role="assertive" testID="error-message" />
);

export const LoadingMessage: React.FC<{ message?: string }> = ({
  message = 'Загружаю данные...'
}) => (
  <LiveRegion message={message} role="polite" testID="loading-message" />
);

export const SuccessMessage: React.FC<{ message: string }> = ({ message }) => (
  <LiveRegion message={message} role="assertive" testID="success-message" />
);

/**
 * Hook для озвучивания ошибок формы
 */
export function useFormErrorAnnouncer() {
  const { announce } = useLiveRegion();

  const announceError = React.useCallback(
    (fieldName: string, error: string) => {
      announce(`Ошибка в поле "${fieldName}": ${error}`, 'assertive');
    },
    [announce]
  );

  const announceSuccess = React.useCallback(
    (message: string) => {
      announce(`Успех: ${message}`, 'assertive');
    },
    [announce]
  );

  const announceValidation = React.useCallback(
    (fieldName: string) => {
      announce(`Поле "${fieldName}" заполнено корректно`, 'polite');
    },
    [announce]
  );

  return {
    announceError,
    announceSuccess,
    announceValidation,
  };
}

const styles = StyleSheet.create({
  nativeRegion: {
    display: 'none', // Hidden from visual, but accessible to a11y
    padding: 0,
    margin: 0,
  },
  hidden: {
    display: 'none',
  },
  text: {
    fontSize: 14,
  },
  webRegion: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  } as React.CSSProperties,
});

export default LiveRegion;

