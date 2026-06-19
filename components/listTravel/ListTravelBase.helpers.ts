import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { Travel } from '@/types/types'
import { queryKeys } from '@/api/queryKeys'
import type { FilterOptions, FilterState } from './utils/listTravelTypes'
import { getSortingLabel } from './utils/sortings'

type TravelListPage = {
  data?: Travel[]
  items?: Travel[]
  total?: number | string
  count?: number | string
}

type InfiniteTravelsData = InfiniteData<TravelListPage>

const isInfiniteTravelsData = (value: unknown): value is InfiniteTravelsData =>
  !!value &&
  typeof value === 'object' &&
  Array.isArray((value as { pages?: unknown }).pages)

export type ActiveConditionChip = {
  key: string
  label: string
  onRemove: () => void
}

export type EmptyStateMessage =
  | {
      icon: string
      title: string
      description: string
      variant: 'empty'
      action?: { label: string; onPress: () => void }
    }
  | {
      icon: string
      title: string
      description: string
      variant: 'search'
      suggestions: string[]
    }

export const normalizeNamedOptions = (items: unknown): Array<{ id: string; name: string }> => {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') {
        const value = String(item)
        return { id: value, name: value }
      }
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>
        const rawId = record.id
        const rawName = record.name
        if ((typeof rawId === 'string' || typeof rawId === 'number') && typeof rawName === 'string') {
          return { id: String(rawId), name: rawName }
        }
      }
      return null
    })
    .filter((item): item is { id: string; name: string } => item !== null)
}

export const normalizeCountryOptions = (items: unknown): Array<{ country_id?: number; id?: string | number; title_ru?: string; name?: string }> => {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') {
        const value = String(item)
        return {
          id: value,
          name: value,
          title_ru: value,
        } as { country_id?: number; id?: string | number; title_ru?: string; name?: string }
      }
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>
        const countryId = typeof record.country_id === 'number' ? record.country_id : undefined
        const id = typeof record.id === 'string' || typeof record.id === 'number' ? record.id : undefined
        const titleRu = typeof record.title_ru === 'string' ? record.title_ru : undefined
        const name = typeof record.name === 'string' ? record.name : undefined
        if (countryId !== undefined || id !== undefined || titleRu || name) {
          return { country_id: countryId, id, title_ru: titleRu, name } as {
            country_id?: number
            id?: string | number
            title_ru?: string
            name?: string
          }
        }
      }
      return null
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}

export const normalizeFilterOptions = (rawOptions: any): FilterOptions | undefined => {
  if (!rawOptions) return undefined

  return {
    countries: normalizeCountryOptions(rawOptions.countries),
    categories: normalizeNamedOptions(rawOptions.categories),
    transports: normalizeNamedOptions(rawOptions.transports),
    categoryTravelAddress: normalizeNamedOptions(rawOptions.categoryTravelAddress),
    companions: normalizeNamedOptions(rawOptions.companions),
    complexity: normalizeNamedOptions(rawOptions.complexity),
    month: normalizeNamedOptions(rawOptions.month),
    over_nights_stay: normalizeNamedOptions(rawOptions.over_nights_stay),
    sortings: rawOptions.sortings || [],
  }
}

export const removeTravelFromInfiniteTravelsCache = (
  queryClient: Pick<QueryClient, 'setQueriesData'>,
  travelId: number
) => {
  queryClient.setQueriesData({ queryKey: queryKeys.travels() }, (oldData: unknown) => {
    if (!isInfiniteTravelsData(oldData)) {
      return oldData
    }

    let removed = false
    const pages = oldData.pages.map((page) => {
      if (!page || typeof page !== 'object') {
        return page
      }

      const nextPage: TravelListPage = { ...page }
      const previousDataLength = Array.isArray(nextPage.data) ? nextPage.data.length : null
      const previousItemsLength = Array.isArray(nextPage.items) ? nextPage.items.length : null

      if (Array.isArray(nextPage.data)) {
        nextPage.data = nextPage.data.filter((item) => Number(item?.id) !== travelId)
      }

      if (Array.isArray(nextPage.items)) {
        nextPage.items = nextPage.items.filter((item) => Number(item?.id) !== travelId)
      }

      const dataRemoved = previousDataLength !== null && nextPage.data?.length !== previousDataLength
      const itemsRemoved = previousItemsLength !== null && nextPage.items?.length !== previousItemsLength

      if (!dataRemoved && !itemsRemoved) {
        return page
      }

      removed = true

      if (typeof nextPage.total === 'number') {
        nextPage.total = Math.max(0, nextPage.total - 1)
      } else if (typeof nextPage.total !== 'undefined') {
        const parsedTotal = Number(nextPage.total)
        nextPage.total = Number.isFinite(parsedTotal) ? Math.max(0, parsedTotal - 1) : nextPage.total
      }

      if (typeof nextPage.count === 'number') {
        nextPage.count = Math.max(0, nextPage.count - 1)
      } else if (typeof nextPage.count !== 'undefined') {
        const parsedCount = Number(nextPage.count)
        nextPage.count = Number.isFinite(parsedCount) ? Math.max(0, parsedCount - 1) : nextPage.count
      }

      return nextPage
    })

    if (!removed) {
      return oldData
    }

    return {
      ...oldData,
      pages,
    }
  })
}

export const isTravelAlreadyDeletedError = (error: unknown): boolean => {
  const errorStatus =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : null
  const errorMessageText =
    error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase()
  return (
    errorStatus === 404 ||
    errorMessageText.includes('404') ||
    errorMessageText.includes('not found') ||
    errorMessageText.includes('не найден')
  )
}

export const describeTravelDeleteError = (
  error: unknown,
): { errorMessage: string; errorDetails: string } => {
  let errorMessage = 'Не удалось удалить путешествие.'
  let errorDetails = 'Попробуйте позже.'

  if (error instanceof Error) {
    if (error.message.includes('timeout') || error.message.includes('время ожидания')) {
      errorMessage = 'Превышено время ожидания'
      errorDetails = 'Проверьте подключение к интернету и попробуйте снова.'
    } else if (error.message.includes('network') || error.message.includes('сеть')) {
      errorMessage = 'Проблема с подключением'
      errorDetails = 'Проверьте подключение к интернету и попробуйте снова.'
    } else if (error.message.includes('404') || error.message.includes('не найдено')) {
      errorMessage = 'Путешествие не найдено'
      errorDetails = 'Возможно, оно уже было удалено.'
    } else if (error.message.includes('403') || error.message.includes('доступ')) {
      errorMessage = 'Нет доступа'
      errorDetails = 'У вас нет прав для удаления этого путешествия.'
    } else {
      errorDetails = error.message
    }
  }

  return { errorMessage, errorDetails }
}

export const SORT_LABEL_FALLBACKS: Record<string, string> = {
  newest: 'Новые',
  oldest: 'Старые',
  popular_desc: 'Популярные ↓',
  popular_asc: 'Популярные ↑',
  rating_desc: 'Рейтинг ↓',
  added_desc: 'Добавлены ↓',
  added_asc: 'Добавлены ↑',
  title_asc: 'Название А→Я',
  title_desc: 'Название Я→А',
  year_desc: 'Год ↓',
  year_asc: 'Год ↑',
}

export const getOptionName = (
  options:
    | Array<{ id?: string | number; country_id?: string | number; name?: string; title_ru?: string }>
    | undefined,
  value: string | number,
) => {
  const normalizedValue = String(value)
  const match = options?.find((option) => {
    const optionId = option.country_id ?? option.id
    return optionId != null && String(optionId) === normalizedValue
  })

  return match?.title_ru || match?.name || String(value)
}

export const summarizeFilterValues = (
  title: string,
  values: Array<string | number> | undefined,
  options?: Array<{ id?: string | number; country_id?: string | number; name?: string; title_ru?: string }>,
) => {
  if (!values?.length) return null

  const labels = values.map((value) => getOptionName(options, value)).filter(Boolean)
  if (!labels.length) return null

  const shownLabels = labels.slice(0, 2).join(', ')
  const extraCount = labels.length - 2

  return `${title}: ${shownLabels}${extraCount > 0 ? ` +${extraCount}` : ''}`
}

export const buildActiveConditionChips = ({
  debSearch,
  filter,
  options,
  onSelect,
  setSearch,
}: {
  debSearch: string
  filter: FilterState
  options?: FilterOptions
  onSelect: (key: string, value: unknown) => void
  setSearch: (value: string) => void
}): ActiveConditionChip[] => {
  const chips: ActiveConditionChip[] = []
  const addArrayChip = (
    key: keyof FilterState,
    title: string,
    values: Array<string | number> | undefined,
    optionList?: Array<{ id?: string | number; country_id?: string | number; name?: string; title_ru?: string }>,
  ) => {
    const label = summarizeFilterValues(title, values, optionList)
    if (!label) return
    chips.push({
      key: String(key),
      label,
      onRemove: () => onSelect(String(key), undefined),
    })
  }

  if (debSearch.trim()) {
    chips.push({
      key: 'search',
      label: `Поиск: ${debSearch.trim()}`,
      onRemove: () => setSearch(''),
    })
  }

  const sortValue = typeof filter.sort === 'string' ? filter.sort.trim() : ''
  if (sortValue) {
    // Prefer the localized Russian label (SORTING_NAME_MAP) over the backend's
    // `name`, which can come through in English ("Newest first" / "Most viewed").
    const backendSortName = options?.sortings?.find((item) => item.id === sortValue)?.name
    const sortLabel = getSortingLabel(
      sortValue,
      SORT_LABEL_FALLBACKS[sortValue] || backendSortName || sortValue,
    )
    chips.push({
      key: 'sort',
      label: `Сортировка: ${sortLabel}`,
      onRemove: () => onSelect('sort', undefined),
    })
  }

  addArrayChip('countries', 'Страны', filter.countries, options?.countries)
  addArrayChip('categories', 'Категории', filter.categories, options?.categories)
  addArrayChip('categoryTravelAddress', 'Что посмотреть', filter.categoryTravelAddress, options?.categoryTravelAddress)
  addArrayChip('transports', 'Транспорт', filter.transports, options?.transports)
  addArrayChip('companions', 'Спутники', filter.companions, options?.companions)
  addArrayChip('complexity', 'Сложность', filter.complexity, options?.complexity)
  addArrayChip('month', 'Месяц', filter.month, options?.month)
  addArrayChip('over_nights_stay', 'Ночлег', filter.over_nights_stay, options?.over_nights_stay)

  if (filter.year) {
    chips.push({
      key: 'year',
      label: `Год: ${filter.year}`,
      onRemove: () => onSelect('year', undefined),
    })
  }

  if (filter.draftsOnly === true) {
    chips.push({
      key: 'draftsOnly',
      label: 'Черновики',
      onRemove: () => onSelect('draftsOnly', undefined),
    })
  }

  return chips
}

export const buildEmptyStateMessage = ({
  showEmptyState,
  filter,
  options,
  debSearch,
  isMeTravel,
  onCreateTravel,
}: {
  showEmptyState: boolean
  filter: FilterState
  options?: FilterOptions
  debSearch: string
  isMeTravel: boolean
  onCreateTravel: () => void
}): EmptyStateMessage | null => {
  if (!showEmptyState) return null

  const activeFilters: string[] = []

  // Определяем активные фильтры - оптимизированная версия с проверками типов
  if (Array.isArray(filter.categories) && filter.categories.length > 0) {
    const categoryNames = (options?.categories || [])
      .filter((cat: any) => cat?.name && filter.categories?.includes(cat.id))
      .map((cat: any) => cat.name)
      .slice(0, 2)
    if (categoryNames.length > 0) {
      activeFilters.push(`категории "${categoryNames.join('", "')}"${categoryNames.length < filter.categories.length ? ' и другие' : ''}`)
    }
  }

  if (Array.isArray(filter.transports) && filter.transports.length > 0 && options?.transports) {
    const transportNames = (options.transports || [])
      .filter((t: any) => t?.name && filter.transports?.some((fid: any) => String(fid) === String(t.id)))
      .map((t: any) => t.name)
      .slice(0, 2)
    if (transportNames.length > 0) {
      activeFilters.push(`транспорт "${transportNames.join('", "')}"${transportNames.length < filter.transports.length ? ' и другой' : ''}`)
    }
  }

  if (Array.isArray(filter.categoryTravelAddress) && filter.categoryTravelAddress.length > 0 && options?.categoryTravelAddress) {
    const objectNames = (options.categoryTravelAddress || [])
      .filter((obj: any) => obj?.name && filter.categoryTravelAddress?.some((fid: any) => String(fid) === String(obj.id)))
      .map((obj: any) => obj.name)
      .slice(0, 2)
    if (objectNames.length > 0) {
      activeFilters.push(`что посмотреть "${objectNames.join('", "')}"${objectNames.length < filter.categoryTravelAddress.length ? ' и другие' : ''}`)
    }
  }

  // Остальные фильтры - простые проверки с type guards
  if (Array.isArray(filter.companions) && filter.companions.length > 0) activeFilters.push('спутники')
  if (Array.isArray(filter.complexity) && filter.complexity.length > 0) activeFilters.push('сложность')
  if (Array.isArray(filter.month) && filter.month.length > 0) activeFilters.push('месяц')
  if (Array.isArray(filter.over_nights_stay) && filter.over_nights_stay.length > 0) activeFilters.push('ночлег')
  if (filter.year) activeFilters.push(`год ${filter.year}`)
  if (filter.sort) activeFilters.push('сортировка')
  if (debSearch) activeFilters.push(`поиск "${debSearch}"`)

  // Формируем сообщение
  if (activeFilters.length === 0) {
    if (isMeTravel) {
      return {
        icon: 'map',
        title: 'У вас пока нет путешествий',
        description:
          'Создайте первое — расскажите о маршруте, добавьте фото и сохраните воспоминания.',
        variant: 'empty' as const,
        action: {
          label: 'Создать путешествие',
          onPress: onCreateTravel,
        },
      }
    }
    return {
      icon: 'inbox',
      title: 'Пока нет путешествий',
      description: 'Путешествия появятся здесь, когда будут добавлены.',
      variant: 'empty' as const,
    }
  }

  // Формируем красивое описание
  let description: string
  if (activeFilters.length === 1) {
    description = `По фильтру ${activeFilters[0]} ничего не найдено.`
  } else if (activeFilters.length === 2) {
    description = `По фильтрам ${activeFilters[0]} и ${activeFilters[1]} ничего не найдено.`
  } else {
    const lastFilter = activeFilters[activeFilters.length - 1]
    const otherFilters = activeFilters.slice(0, -1).join(', ')
    description = `По фильтрам ${otherFilters} и ${lastFilter} ничего не найдено.`
  }

  description += ' Попробуйте убрать фильтры или изменить запрос.'

  const suggestions = debSearch
    ? ['Проверьте написание', 'Попробуйте другие ключевые слова']
    : ['Уберите один из фильтров', 'Выберите другую категорию']

  return {
    icon: 'search',
    title: 'Ничего не найдено',
    description,
    variant: 'search' as const,
    suggestions,
  }
}
