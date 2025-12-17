import { fetchFilters, fetchFiltersCountry, fetchAllCountries } from './misc';
import { devWarn } from '@/src/utils/logger';

// Кэш для хранения результатов запросов
const filtersCache = new Map<string, any>();
const cacheTimeout = 10 * 60 * 1000; // 10 минут

// Оптимизированная функция для получения фильтров с кэшированием
export const fetchFiltersOptimized = async () => {
  const cacheKey = 'filters';
  const now = Date.now();
  
  // Проверяем кэш
  const cached = filtersCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < cacheTimeout) {
    return cached.data;
  }
  
  // Если нет в кэше, делаем запрос
  try {
    const data = await fetchFilters();
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
export const fetchFiltersCountryOptimized = async () => {
  const cacheKey = 'countries';
  const now = Date.now();
  
  // Проверяем кэш
  const cached = filtersCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < cacheTimeout) {
    return cached.data;
  }
  
  // Если нет в кэше, делаем запрос
  try {
    const data = await fetchFiltersCountry();
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
export const fetchAllFiltersOptimized = async () => {
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
      fetchFiltersOptimized(),
      fetchFiltersCountryOptimized()
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

// Функция для предварительного прогрева кэша
export const warmupFiltersCache = async () => {
  try {
    await fetchAllFiltersOptimized();
  } catch (error) {
    devWarn('Failed to warmup filters cache:', error);
  }
};
