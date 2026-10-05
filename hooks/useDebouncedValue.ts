import { useState, useEffect, useRef } from 'react';

/**
 * Глубокая проверка равенства для объектов и массивов.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as Record<string, unknown>);
    const keysB = Object.keys(b as Record<string, unknown>);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
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
/**
 * Как useDebouncedValue, но дополнительно возвращает флаг "ожидания":
 * true, пока значение изменилось, но debounced-значение ещё не догнало его.
 * Позволяет не делать повторное глубокое сравнение на каждом рендере.
 */
export function useDebouncedValueWithPending<T>(value: T, delay: number): [T, boolean] {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const prevValueRef = useRef<T>(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (deepEqual(prevValueRef.current, value)) {
      return;
    }

    prevValueRef.current = value;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setPending(true);

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
      setPending(false);
      timeoutRef.current = null;
    }, delay);
  }, [value, delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // #2218 — `pending` from state lags one render: the render right after a change
  // still says «settled» while the debounced value belongs to the old input, and
  // a consumer waiting for «results of the current input» (fit after «Сбросить
  // всё») acted on the previous result set. A value the effect has not seen yet
  // is pending in the same render; the deep compare runs only on a new reference.
  const unseenChange = value !== prevValueRef.current && !deepEqual(prevValueRef.current, value);
  return [debouncedValue, pending || unseenChange];
}

/**
 * `isImmediate` называет значения, которые применяются без паузы — в тот же
 * рендер. Нужен поиску: очищенное поле (крестик, «Сбросить») не должно ещё
 * `delay` мс держать прежний запрос и отправлять его вместе с уже сброшенными
 * фильтрами (#2184). Функция должна быть стабильной (объявлена вне компонента).
 */
export function useDebouncedValue<T>(value: T, delay: number, isImmediate?: (value: T) => boolean): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const prevValueRef = useRef<T>(value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const immediate = Boolean(isImmediate?.(value));

  useEffect(() => {
    // ✅ ИСПРАВЛЕНИЕ: Используем глубокое сравнение для объектов и массивов
    // Это предотвращает лишние обновления при изменении ссылок на объекты
    if (deepEqual(prevValueRef.current, value)) {
      return;
    }
    
    prevValueRef.current = value;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Запоминаем и немедленное значение: следующий ввод отсчитывает паузу от
    // него, а не воскрешает то, что было до сброса.
    if (immediate) {
      setDebouncedValue(value);
      return;
    }
    
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
      timeoutRef.current = null;
    }, delay);
  }, [value, delay, immediate]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return immediate ? value : debouncedValue;
}
