/**
 * Единый резолвер имени категории места.
 *
 * Категория может прийти строкой или объектом из фильтров/данных
 * (`{ id, name }`, иногда `{ value }`). Раньше эта логика дублировалась в
 * FiltersPanelBody и FiltersPanelRadiusSection с расходящимся приоритетом
 * полей — теперь единый источник: строка → `name` → `value`.
 */
export type CategoryOption = string | { id?: string | number; name?: string; value?: string }

export function getCategoryName(category: CategoryOption): string {
  if (typeof category === 'string') return category.trim()
  if (category && typeof category === 'object') {
    if (typeof category.name === 'string') return category.name.trim()
    if (typeof category.value === 'string') return category.value.trim()
  }
  return ''
}
