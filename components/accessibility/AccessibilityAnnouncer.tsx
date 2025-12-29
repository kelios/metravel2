/**
 * 🎯 AccessibilityAnnouncer Component
 *
 * ARIA Live Region для объявления динамических событий screen reader'ам
 * Используется для уведомлений, загрузки, ошибок и т.д.
 */

import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

interface AccessibilityAnnouncerProps {
  /**
   * Сообщение для объявления
   */
  message?: string;
  /**
   * Приоритет объявления
   * 'polite' - ждет паузы в речи screen reader'а
   * 'assertive' - прерывает текущее объявление
   */
  priority?: 'polite' | 'assertive';
  /**
   * Если true, элемент полностью переобъявляется при изменении
   */
  atomic?: boolean;
  /**
   * ID региона (для связи с aria-labelledby)
   */
  id?: string;
}

export const AccessibilityAnnouncer: React.FC<AccessibilityAnnouncerProps> = ({
  message = '',
  priority = 'polite',
  atomic = true,
  id = 'aria-announcer',
}) => {
  const announcerRef = useRef<HTMLDivElement>(null);

  // Очищаем сообщение через время чтобы область была готова для новых объявлений
  useEffect(() => {
    if (!message || Platform.OS !== 'web') return;

    const timer = setTimeout(() => {
      if (announcerRef.current) {
        announcerRef.current.textContent = '';
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [message]);

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <div
      ref={announcerRef}
      id={id}
      role="status"
      aria-live={priority}
      aria-atomic={atomic}
      style={{
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    >
      {message}
    </div>
  );
};

/**
 * 🎯 AccessibilityAlert Component
 *
 * Специализированный компонент для объявления важных предупреждений
 * (ошибок, критических уведомлений и т.д.)
 */

interface AccessibilityAlertProps {
  /**
   * Сообщение алерта
   */
  message: string;
  /**
   * Тип алерта (влияет на роль и приоритет)
   */
  type?: 'error' | 'warning' | 'success' | 'info';
  /**
   * ID региона
   */
  id?: string;
}

export const AccessibilityAlert: React.FC<AccessibilityAlertProps> = ({
  message,
  type = 'info',
  id = 'aria-alert',
}) => {
  if (Platform.OS !== 'web') {
    return null;
  }

  const roleMap = {
    error: 'alert',
    warning: 'alert',
    success: 'status',
    info: 'status',
  };

  return (
    <div
      id={id}
      role={roleMap[type]}
      aria-live="assertive"
      aria-atomic="true"
      style={{
        position: 'absolute',
        left: '-10000px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    >
      {type === 'error' && 'Error: '}
      {type === 'warning' && 'Warning: '}
      {type === 'success' && 'Success: '}
      {message}
    </div>
  );
};

export default AccessibilityAnnouncer;

