// src/utils/reactQueryConfig.ts
// ✅ Утилиты для оптимизации конфигурации React Query

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
    
    // Не перезагружать при восстановлении сети
    refetchOnReconnect: true,
    
    // Показывать предыдущие данные во время загрузки
    keepPreviousData: true,
    
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
  return new QueryClient({
    defaultOptions: {
      ...defaultQueryOptions,
      ...customOptions,
    },
  });
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
    keepPreviousData: true,
    refetchOnMount: false,
  },
};
