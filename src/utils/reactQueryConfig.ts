// src/utils/reactQueryConfig.ts
// ✅ Утилиты для оптимизации конфигурации React Query
// Оптимизировано для Expo 54 и React 19

import { QueryClient, DefaultOptions } from '@tanstack/react-query';

/**
 * Оптимизированные настройки по умолчанию для React Query
 */
export const defaultQueryOptions: DefaultOptions = {
  queries: {
    // Время, в течение которого данные считаются свежими
    staleTime: 5 * 60 * 1000, // 5 минут
    
    // Время хранения данных в кеше после удаления из памяти
    gcTime: 10 * 60 * 1000, // 10 минут
    
    // Количество повторных попыток при ошибке
    retry: (failureCount, error: any) => {
      const message = String(error?.message || '').toLowerCase()

      // Не повторяем запросы при таймаутах/сетевых сбоях:
      // иначе мы искусственно растягиваем "loading" и можем сильно ухудшить LCP.
      if (
        message.includes('превышено время ожидания') ||
        message.includes('timeout') ||
        message.includes('failed to fetch') ||
        message.includes('network request failed')
      ) {
        return false
      }

      // Не повторяем для ошибок 4xx (клиентские ошибки)
      if (error?.status >= 400 && error?.status < 500) {
        return false;
      }
      // Повторяем до 2 раз для других ошибок
      return failureCount < 2;
    },
    
    // Задержка между повторными попытками (exponential backoff)
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    
    // Не перезагружать при фокусе окна
    refetchOnWindowFocus: false,
    
    // Перезагружать при восстановлении сети
    refetchOnReconnect: true,
    
    // Не перезагружать при монтировании, если данные свежие
    refetchOnMount: true,
  },
  mutations: {
    // Количество повторных попыток для мутаций
    retry: 1,
    
    // Задержка между повторными попытками
    retryDelay: 1000,
  },
};

/**
 * Создает оптимизированный QueryClient
 */
export function createOptimizedQueryClient(
  customOptions?: Partial<DefaultOptions>
): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      ...defaultQueryOptions,
      ...customOptions,
    },
  });

  // ✅ НОВОЕ: Настройка для React 19 - автоматический batching
  // React 19 автоматически батчит обновления, но мы можем оптимизировать дальше
  if (typeof window !== 'undefined') {
    // Prefetch критичных данных при idle
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        // Здесь можно добавить prefetch критичных данных
      }, { timeout: 2000 });
    }
  }

  return client;
}

/**
 * Настройки для разных типов запросов
 */
export const queryConfigs = {
  // Для часто изменяющихся данных (списки, поиск)
  dynamic: {
    staleTime: 1 * 60 * 1000, // 1 минута
    gcTime: 5 * 60 * 1000, // 5 минут
    refetchOnMount: true,
  },
  
  // Для редко изменяющихся данных (профили, настройки)
  static: {
    staleTime: 30 * 60 * 1000, // 30 минут
    gcTime: 60 * 60 * 1000, // 1 час
    refetchOnMount: false,
  },
  
  // Для критических данных (аутентификация)
  critical: {
    staleTime: 0, // Всегда проверять
    gcTime: 5 * 60 * 1000, // 5 минут
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  },
  
  // Для больших списков (пагинация)
  paginated: {
    staleTime: 5 * 60 * 1000, // 5 минут
    gcTime: 10 * 60 * 1000, // 10 минут
    refetchOnMount: false,
  },

  // Включать точечно и только после измерений:
  // может приводить к лишним запросам в StrictMode/повторных рендерах.
  prefetchInRender: {
    experimental_prefetchInRender: true,
  },
};
