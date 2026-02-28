const SORTING_NAME_MAP: Record<string, string> = {
  newest: 'Новые',
  oldest: 'Старые',
  popular_desc: 'Популярные ↓',
  popular_asc: 'Популярные ↑',
  updated_desc: 'Обновлены ↓',
  created_desc: 'Добавлены ↓',
  created_asc: 'Добавлены ↑',
  name_asc: 'Название А→Я',
  name_desc: 'Название Я→А',
  year_desc: 'Год ↓',
  year_asc: 'Год ↑',
  days_desc: 'Длительность ↓',
  days_asc: 'Длительность ↑',
  people_desc: 'Людей ↓',
  people_asc: 'Людей ↑',
  rating_desc: 'Рейтинг ↓',
};

const HIDDEN_SORTINGS = new Set(['budget_desc', 'budget_asc', 'updated_asc', 'rating_asc']);

const SORTING_ORDER: string[] = [
  'newest',
  'oldest',
  'popular_desc',
  'popular_asc',
  'rating_desc',
  'created_desc',
  'created_asc',
  'updated_desc',
  'name_asc',
  'name_desc',
  'year_desc',
  'year_asc',
  'days_desc',
  'days_asc',
  'people_desc',
  'people_asc',
];

const SORTING_ORDER_INDEX = new Map(SORTING_ORDER.map((id, idx) => [id, idx]));

export const getSortingLabel = (sortingId: string, fallbackName?: string): string => {
  const normalizedId = String(sortingId || '').trim();
  if (normalizedId && SORTING_NAME_MAP[normalizedId]) {
    return SORTING_NAME_MAP[normalizedId];
  }
  return String(fallbackName || normalizedId || 'Сортировка');
};

export const buildSortingOptions = (sortings: Array<{ id?: unknown; name?: unknown }> = []) => {
  return sortings
    .map((sorting) => {
      const id = String(sorting?.id ?? '').trim();
      const name = typeof sorting?.name === 'string' ? sorting.name : undefined;
      return { id, name };
    })
    .filter((sorting) => sorting.id.length > 0 && !HIDDEN_SORTINGS.has(sorting.id))
    .sort((a, b) => {
      const aIdx = SORTING_ORDER_INDEX.get(a.id);
      const bIdx = SORTING_ORDER_INDEX.get(b.id);
      if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
      if (aIdx !== undefined) return -1;
      if (bIdx !== undefined) return 1;
      return a.id.localeCompare(b.id, 'ru');
    })
    .map((sorting) => ({
      id: sorting.id,
      name: getSortingLabel(sorting.id, sorting.name),
    }));
};
