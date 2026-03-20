import { fetchFilters, fetchFiltersCountry, fetchAllCountries } from './misc';
import { devWarn } from '@/utils/logger';
import type { Filters } from '@/types/types';

// Кэш для хранения результатов запросов
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const filtersCache = new Map<string, CacheEntry<unknown>>();
const cacheTimeout = 10 * 60 * 1000; // 10 минут

// In-flight promise cache для дедупликации параллельных запросов
const inFlightRequests = new Map<string, Promise<unknown>>();

// Оптимизированная функция для получения фильтров с кэшированием
export const fetchFiltersOptimized = async (options?: { signal?: AbortSignal }): Promise<Filters> => {
  const cacheKey = 'filters';
  const now = Date.now();
  
  // Проверяем кэш
  const cached = filtersCache.get(cacheKey) as CacheEntry<Filters> | undefined;
  if (cached && (now - cached.timestamp) < cacheTimeout) {
    return cached.data;
  }
  
  // Проверяем, есть ли уже in-flight запрос
  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    return inFlight as Promise<Filters>;
  }
  
  // Если нет в кэше и нет in-flight, делаем запрос
  const request = (async () => {
    try {
      const data = await fetchFilters({ signal: options?.signal });
      filtersCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      return data;
    } catch (error) {
      // Если есть ошибка, но есть закэшированные данные, возвращаем их
      if (cached) {
        devWarn('Using cached filters due to error:', error);
        return cached.data;
      }
      throw error;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();
  
  inFlightRequests.set(cacheKey, request);
  return request;
};

// Оптимизированная функция для получения стран с кэшированием
export const fetchFiltersCountryOptimized = async (options?: { signal?: AbortSignal }): Promise<unknown[]> => {
  const cacheKey = 'countries';
  const now = Date.now();
  
  // Проверяем кэш
  const cached = filtersCache.get(cacheKey) as CacheEntry<unknown[]> | undefined;
  if (cached && (now - cached.timestamp) < cacheTimeout) {
    return cached.data;
  }
  
  // Проверяем, есть ли уже in-flight запрос
  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    return inFlight as Promise<unknown[]>;
  }
  
  // Если нет в кэше и нет in-flight, делаем запрос
  const request = (async () => {
    try {
      const data = await fetchFiltersCountry({ signal: options?.signal });
      filtersCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      return data;
    } catch (error) {
      // Если есть ошибка, но есть закэшированные данные, возвращаем их
      if (cached) {
        devWarn('Using cached countries due to error:', error);
        return cached.data;
      }
      throw error;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();
  
  inFlightRequests.set(cacheKey, request);
  return request;
};

// Объединенная функция для получения всех фильтров за один вызов
export const fetchAllFiltersOptimized = async (options?: { signal?: AbortSignal }): Promise<Filters> => {
  const cacheKey = 'all-filters';
  const now = Date.now();
  
  // Проверяем кэш
  const cached = filtersCache.get(cacheKey) as CacheEntry<Filters> | undefined;
  if (cached && (now - cached.timestamp) < cacheTimeout) {
    return cached.data;
  }
  
  // Проверяем, есть ли уже in-flight запрос
  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    return inFlight as Promise<Filters>;
  }
  
  // Если нет в кэше и нет in-flight, делаем запросы параллельно
  const request = (async () => {
    try {
      const [base, countries] = await Promise.all([
        fetchFiltersOptimized(options),
        fetchFiltersCountryOptimized(options)
      ]);
      
      const result: Filters = { ...base, countries: countries as string[] };
      filtersCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      return result;
    } catch (error) {
      // Если есть ошибка, но есть закэшированные данные, возвращаем их
      if (cached) {
        devWarn('Using cached all filters due to error:', error);
        return cached.data;
      }
      throw error;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();
  
  inFlightRequests.set(cacheKey, request);
  return request;
};

// Функция для очистки кэша (полезна для отладки)
export const clearFiltersCache = () => {
  filtersCache.clear();
};

// Экспортируем оригинальную функцию для совместимости
export { fetchAllCountries };
