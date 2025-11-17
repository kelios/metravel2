import { useState, useEffect, useRef } from 'react';

/**
 * Глубокая проверка равенства для объектов и массивов
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  
  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => deepEqual(a[key], b[key]));
  }
  
  return false;
}

/**
 * Хук для debounce значения
 * Полезен для оптимизации поиска, фильтров и других частых обновлений
 * 
 * ✅ ИСПРАВЛЕНИЕ: Добавлена поддержка глубокого сравнения для объектов и массивов
 * 
 * @param value - значение для debounce
 * @param delay - задержка в миллисекундах
 * @returns debounced значение
 * 
 * @example
 * const debouncedSearch = useDebouncedValue(search, 300);
 * useEffect(() => {
 *   // Выполнится только после 300ms паузы в вводе
 *   fetchData(debouncedSearch);
 * }, [debouncedSearch]);
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const prevValueRef = useRef<T>(value);

  useEffect(() => {
    // ✅ ИСПРАВЛЕНИЕ: Используем глубокое сравнение для объектов и массивов
    // Это предотвращает лишние обновления при изменении ссылок на объекты
    if (deepEqual(prevValueRef.current, value)) {
      return;
    }
    
    prevValueRef.current = value;
    
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

