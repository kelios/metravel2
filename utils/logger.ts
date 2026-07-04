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

const WEB_DEV_NETWORK_ERROR_LIMIT = 1;
const webDevNetworkErrorKeys = new Set<string>();

const isBrowserRuntime = (): boolean =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

const normalizeLogArg = (arg: unknown, seen = new WeakSet<object>()): unknown => {
  if (arg instanceof Error) return arg.message;
  if (!arg || typeof arg !== 'object') return arg;
  if (seen.has(arg)) return '[Circular]';
  seen.add(arg);
  if (Array.isArray(arg)) return arg.map((item) => normalizeLogArg(item, seen));
  return Object.fromEntries(
    Object.entries(arg as Record<string, unknown>).map(([key, value]) => [key, normalizeLogArg(value, seen)])
  );
};

const stringifyLogArg = (arg: unknown): string => {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.message;
  try {
    return JSON.stringify(normalizeLogArg(arg));
  } catch {
    return String(arg);
  }
};

const getWebDevApiNetworkErrorKey = (args: unknown[]): string | null => {
  if (!isBrowserRuntime()) return null;

  const message = args.map(stringifyLogArg).join(' ');
  if (!/Network error while fetching .*\/api\//i.test(message)) return null;

  return message
    .replace(/https?:\/\/[^\s"']+/g, (url) => {
      try {
        const parsed = new URL(url);
        parsed.search = '';
        return parsed.toString();
      } catch {
        return url;
      }
    })
    .slice(0, 220);
};

const logCompactWebDevNetworkWarning = (args: unknown[]): boolean => {
  const networkErrorKey = getWebDevApiNetworkErrorKey(args);
  if (!networkErrorKey) return false;
  if (webDevNetworkErrorKeys.has(networkErrorKey)) return true;
  const shouldLogSummary = webDevNetworkErrorKeys.size < WEB_DEV_NETWORK_ERROR_LIMIT;
  webDevNetworkErrorKeys.add(networkErrorKey);
  if (shouldLogSummary) {
    console.warn('[dev-network] API network errors suppressed in web dev:', networkErrorKey);
  }
  return true;
};

/**
 * Логирует сообщение только в режиме разработки
 */
export const devLog = (...args: any[]): void => {
  if (DEV) {
    console.info(...args);
  }
};

/**
 * Логирует предупреждение только в режиме разработки
 */
export const devWarn = (...args: any[]): void => {
  if (DEV) {
    if (logCompactWebDevNetworkWarning(args)) return;
    console.warn(...args);
  }
};

/**
 * Логирует ошибку только в режиме разработки
 */
export const devError = (...args: any[]): void => {
  if (DEV) {
    if (logCompactWebDevNetworkWarning(args)) return;
    console.error(...args);
  }
};

/**
 * Логирует с префиксом для PDF экспорта
 */
export const pdfLog = (...args: any[]): void => {
  if (DEV) {
    console.info('[PDF]', ...args);
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
        console.info(message, context);
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
