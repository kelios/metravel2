// src/utils/codeSplitting.ts
// ✅ Утилиты для code splitting и lazy loading

import { lazy, ComponentType, LazyExoticComponent } from 'react';

/**
 * Создает lazy компонент с обработкой ошибок
 */
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T } | T>,
  fallback?: ComponentType
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const module = await importFn();
      // Поддерживаем разные форматы экспорта
      if ('default' in module && module.default) {
        return { default: module.default };
      }
      return { default: module as T };
    } catch (error) {
      console.error('Failed to load lazy component:', error);
      if (fallback) {
        return { default: fallback as T };
      }
      throw error;
    }
  });
}

/**
 * Создает lazy компонент с таймаутом
 */
export function createLazyComponentWithTimeout<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T } | T>,
  timeout: number = 10000,
  fallback?: ComponentType
): LazyExoticComponent<T> {
  return lazy(async () => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Component load timeout')), timeout);
    });

    try {
      const module = await Promise.race([importFn(), timeoutPromise]);
      if ('default' in module && module.default) {
        return { default: module.default };
      }
      return { default: module as T };
    } catch (error) {
      console.error('Failed to load lazy component:', error);
      if (fallback) {
        return { default: fallback as T };
      }
      throw error;
    }
  });
}

/**
 * Предзагружает компонент (prefetch)
 */
export async function prefetchComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T } | T>
): Promise<void> {
  try {
    await importFn();
  } catch (error) {
    console.error('Failed to prefetch component:', error);
  }
}

/**
 * Создает lazy компонент с retry механизмом
 */
export function createLazyComponentWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T } | T>,
  maxRetries: number = 3,
  fallback?: ComponentType
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const module = await importFn();
        if ('default' in module && module.default) {
          return { default: module.default };
        }
        return { default: module as T };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error('Failed to load lazy component after retries:', lastError);
    if (fallback) {
      return { default: fallback as T };
    }
    throw lastError || new Error('Failed to load component');
  });
}

