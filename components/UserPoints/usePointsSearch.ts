import { useState } from 'react';

import { useDebouncedValue } from '@/hooks/useDebouncedValue';

/**
 * Пауза в наборе, после которой запрос уходит в модель (#3132). Ввод в поле
 * остаётся мгновенным: `searchQuery` — то, что видит пользователь в инпуте,
 * `appliedSearchQuery` — то, по чему фильтруются точки и карта.
 */
export const POINTS_SEARCH_DEBOUNCE_MS = 250;

/**
 * Пустое поле применяется сразу: крестик и «Сбросить фильтры» не должны ещё
 * четверть секунды показывать прежний результат (тот же контракт, что у поиска
 * на общей карте, #2184). Функция объявлена вне хука — `useDebouncedValue`
 * требует стабильную ссылку.
 */
const isEmptyQuery = (value: string): boolean => value.trim() === '';

export const usePointsSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const appliedSearchQuery = useDebouncedValue(searchQuery, POINTS_SEARCH_DEBOUNCE_MS, isEmptyQuery);
  return { searchQuery, appliedSearchQuery, setSearchQuery };
};
