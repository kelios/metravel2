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

