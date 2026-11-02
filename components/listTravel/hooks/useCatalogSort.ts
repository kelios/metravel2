import { useCallback, useEffect, useMemo, useRef } from 'react'

import { queueAnalyticsEvent } from '@/utils/analytics'
import {
  RELEVANCE_SORT_ID,
  normalizeCatalogSortValue,
  rememberCatalogSort,
  resolveInitialCatalogSort,
} from '../utils/catalogSort'
import { getCatalogHeaderSortingOptions } from '../utils/sortings'

type UseCatalogSortOptions = {
  /** Публичный каталог (поиск, «Беларусь»); в своих поездках и экспорте — выкл. */
  enabled: boolean
  /** Запомненный выбор поднимается только после гидратации: статический HTML один на все сессии. */
  hydrationReady: boolean
  /** `sort` из адреса входа (чипы «выходного дня» приносят `distance`). */
  urlSort: string
  /** Текст запроса из адреса входа: у текстового поиска по умолчанию релевантность. */
  search: string
  /** Вход в каталог: меняется вместе с параметрами адреса. */
  entry: unknown
  /** Серверный список сортировок (опции фильтров; до их загрузки — пусто). */
  sortings?: Array<{ id?: unknown; name?: unknown }>
  /** Текущий `filter.sort`. */
  sortValue?: unknown
  onSelect: (field: string, value: unknown) => void
}

const NOT_APPLIED = Symbol('catalog-sort-not-applied')

/**
 * #2903: явный выбор сортировки каталога — тулбар, шторка фильтров, снятие
 * чипа — запоминается на сессию и уходит событием `search_sort_change{sort}`.
 * Вход без `sort` в адресе и без текста поднимает запомненный выбор.
 * Переключатель в шапке берёт серверный список сортировок и тот же путь
 * `filter.sort` (без лишнего запроса).
 */
export function useCatalogSort({
  enabled,
  hydrationReady,
  urlSort,
  search,
  entry,
  sortings,
  sortValue: rawSortValue,
  onSelect,
}: UseCatalogSortOptions) {
  const appliedEntryRef = useRef<unknown>(NOT_APPLIED)

  useEffect(() => {
    if (!enabled || !hydrationReady || appliedEntryRef.current === entry) return
    appliedEntryRef.current = entry
    const initial = resolveInitialCatalogSort({ urlSort, search })
    if (initial) onSelect('sort', initial)
  }, [enabled, entry, hydrationReady, onSelect, search, urlSort])

  const handleFilterSelect = useCallback(
    (field: string, value: unknown) => {
      if (enabled && field === 'sort') {
        const sort = normalizeCatalogSortValue(value)
        rememberCatalogSort(sort)
        queueAnalyticsEvent('search_sort_change', {
          sort: sort || RELEVANCE_SORT_ID,
          source: 'travel_catalog',
        })
      }
      onSelect(field, value)
    },
    [enabled, onSelect],
  )

  const sortOptions = useMemo(
    () => getCatalogHeaderSortingOptions(sortings ?? [], { includeProximity: enabled }),
    [enabled, sortings],
  )
  const sortValue = typeof rawSortValue === 'string' ? rawSortValue : ''
  const handleSortChange = useCallback(
    (id: string) => handleFilterSelect('sort', sortValue === id ? '' : id),
    [handleFilterSelect, sortValue],
  )

  return { handleFilterSelect, handleSortChange, sortOptions, sortValue }
}
