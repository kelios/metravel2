import { fetchFilters, fetchFiltersCountry, fetchAllCountries } from './misc';
import { devWarn } from '@/src/utils/logger';

// Кэш для хранения результатов запросов
const filtersCache = new Map<string, any>();
const cacheTimeout = 10 * 60 * 1000; // 10 минут

// Оптимизированная функция для получения фильтров с кэшированием
export const fetchFiltersOptimized = async (options?: { signal?: AbortSignal }) => {
  const cacheKey = 'filters';
  const now = Date.now();
  
  // Проверяем кэш
  const cached = filtersCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < cacheTimeout) {
    return cached.data;
  }
  
  // Если нет в кэше, делаем запрос
  try {
    const data = await fetchFilters({ signal: options?.signal });
    filtersCache.set(cacheKey, {
      data,
      timestamp: now
    });
    return data;
  } catch (error) {
    // Если есть ошибка, но есть закэшированные данные, возвращаем их
    if (cached) {
      devWarn('Using cached filters due to error:', error);
      return cached.data;
    }
    throw error;
  }
};

// Оптимизированная функция для получения стран с кэшированием
export const fetchFiltersCountryOptimized = async (options?: { signal?: AbortSignal }) => {
  const cacheKey = 'countries';
  const now = Date.now();
  
  // Проверяем кэш
  const cached = filtersCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < cacheTimeout) {
    return cached.data;
  }
  
  // Если нет в кэше, делаем запрос
  try {
    const data = await fetchFiltersCountry({ signal: options?.signal });
    filtersCache.set(cacheKey, {
      data,
      timestamp: now
    });
    return data;
  } catch (error) {
    // Если есть ошибка, но есть закэшированные данные, возвращаем их
    if (cached) {
      devWarn('Using cached countries due to error:', error);
      return cached.data;
    }
    throw error;
  }
};

// Объединенная функция для получения всех фильтров за один вызов
export const fetchAllFiltersOptimized = async (options?: { signal?: AbortSignal }) => {
  const cacheKey = 'all-filters';
  const now = Date.now();
  
  // Проверяем кэш
  const cached = filtersCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < cacheTimeout) {
    return cached.data;
  }
  
  // Если нет в кэше, делаем запросы параллельно
  try {
    const [base, countries] = await Promise.all([
      fetchFiltersOptimized(options),
      fetchFiltersCountryOptimized(options)
    ]);
    
    const result = { ...base, countries };
    filtersCache.set(cacheKey, {
      data: result,
      timestamp: now
    });
    
    return result;
  } catch (error) {
    // Если есть ошибка, но есть закэшированные данные, возвращаем их
    if (cached) {
      devWarn('Using cached all filters due to error:', error);
      return cached.data;
    }
    throw error;
  }
};

// Функция для очистки кэша (полезна для отладки)
export const clearFiltersCache = () => {
  filtersCache.clear();
};

// Экспортируем оригинальную функцию для совместимости
export { fetchAllCountries };
