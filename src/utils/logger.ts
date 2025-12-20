// src/utils/logger.ts
// ✅ Утилита для условного логирования (только в development)

/**
 * Проверяет, находится ли приложение в режиме разработки
 */
const isDevelopment = (): boolean => {
  if (typeof __DEV__ !== 'undefined') {
    return __DEV__;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV === 'development';
  }
  return false;
};

const DEV = isDevelopment();

/**
 * Логирует сообщение только в режиме разработки
 */
export const devLog = (...args: any[]): void => {
  if (DEV) {
    console.log(...args);
  }
};

/**
 * Логирует предупреждение только в режиме разработки
 */
export const devWarn = (...args: any[]): void => {
  if (DEV) {
    console.warn(...args);
  }
};

/**
 * Логирует ошибку (всегда, но с дополнительной информацией в dev)
 */
export const devError = (...args: any[]): void => {
  if (DEV) {
    console.error(...args);
  } else {
    // В production логируем только критичные ошибки
    console.error(...args);
  }
};

/**
 * Логирует с префиксом для PDF экспорта
 */
export const pdfLog = (...args: any[]): void => {
  if (DEV) {
    console.log('[PDF]', ...args);
  }
};

export const pdfWarn = (...args: any[]): void => {
  if (DEV) {
    console.warn('[PDF]', ...args);
  }
};

export const pdfError = (...args: any[]): void => {
  console.error('[PDF]', ...args);
};

/**
 * Интерфейс для интеграции с системами мониторинга
 */
export interface MonitoringService {
  captureException(error: Error, context?: Record<string, any>): void;
  captureMessage(message: string, level?: 'info' | 'warning' | 'error', context?: Record<string, any>): void;
  setUser(user: { id?: string; email?: string; username?: string }): void;
  setContext(key: string, context: Record<string, any>): void;
}

/**
 * Глобальный экземпляр сервиса мониторинга (может быть установлен извне)
 */
let monitoringService: MonitoringService | null = null;

/**
 * Устанавливает сервис мониторинга (например, Sentry)
 */
export const setMonitoringService = (service: MonitoringService | null): void => {
  monitoringService = service;
};

/**
 * Получает текущий сервис мониторинга
 */
export const getMonitoringService = (): MonitoringService | null => {
  return monitoringService;
};

/**
 * Логирует ошибку с возможностью отправки в систему мониторинга
 */
export const logError = (error: Error | unknown, context?: Record<string, any>): void => {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  
  // Логируем в консоль
  devError('Error:', errorObj, context);
  
  // Отправляем в систему мониторинга, если она настроена
  if (monitoringService && !DEV) {
    try {
      monitoringService.captureException(errorObj, context);
    } catch (e) {
      // Игнорируем ошибки при отправке в мониторинг
      console.error('Failed to send error to monitoring service:', e);
    }
  }
};

/**
 * Логирует сообщение с возможностью отправки в систему мониторинга
 */
export const logMessage = (
  message: string, 
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
): void => {
  // Логируем в консоль
  if (DEV) {
    switch (level) {
      case 'error':
        console.error(message, context);
        break;
      case 'warning':
        console.warn(message, context);
        break;
      default:
        console.log(message, context);
    }
  }
  
  // Отправляем в систему мониторинга, если она настроена
  if (monitoringService && !DEV && level === 'error') {
    try {
      monitoringService.captureMessage(message, level, context);
    } catch (e) {
      // Игнорируем ошибки при отправке в мониторинг
      console.error('Failed to send message to monitoring service:', e);
    }
  }
};
