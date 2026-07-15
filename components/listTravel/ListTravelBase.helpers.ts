import type { InfiniteData, QueryClient } from '@tanstack/react-query'
import type { Travel } from '@/types/types'
import { queryKeys } from '@/api/queryKeys'
import type { FilterOptions, FilterState } from './utils/listTravelTypes'
import { getSortingLabel } from './utils/sortings'
import { translate as i18nT } from '@/i18n'


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

const includesLocalizedErrorToken = (
  message: string,
  key: Parameters<typeof i18nT>[0],
): boolean =>
  i18nT(key)
    .split('|')
    .map((token) => token.trim().toLocaleLowerCase())
    .filter(Boolean)
    .some((token) => message.includes(token))

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
    includesLocalizedErrorToken(
      errorMessageText,
      'travel:components.listTravel.ListTravelBaseHelpers.notFoundErrorTokens',
    )
  )
}

export const describeTravelDeleteError = (
  error: unknown,
): { errorMessage: string; errorDetails: string } => {
  let errorMessage = i18nT('travel:components.listTravel.ListTravelBase_helpers.ne_udalos_udalit_puteshestvie_4a44f6e4')
  let errorDetails = i18nT('travel:components.listTravel.ListTravelBase_helpers.poprobuyte_pozzhe_c8da8052')

  if (error instanceof Error) {
    const normalizedMessage = error.message.toLocaleLowerCase()
    if (normalizedMessage.includes('timeout') || includesLocalizedErrorToken(normalizedMessage, 'travel:components.listTravel.ListTravelBaseHelpers.timeoutErrorTokens')) {
      errorMessage = i18nT('travel:components.listTravel.ListTravelBaseHelpers.timeoutTitle')
      errorDetails = i18nT('travel:components.listTravel.ListTravelBaseHelpers.connectionDetails')
    } else if (normalizedMessage.includes('network') || includesLocalizedErrorToken(normalizedMessage, 'travel:components.listTravel.ListTravelBaseHelpers.networkErrorTokens')) {
      errorMessage = i18nT('travel:components.listTravel.ListTravelBaseHelpers.networkTitle')
      errorDetails = i18nT('travel:components.listTravel.ListTravelBaseHelpers.connectionDetails')
    } else if (normalizedMessage.includes('404') || includesLocalizedErrorToken(normalizedMessage, 'travel:components.listTravel.ListTravelBaseHelpers.notFoundErrorTokens')) {
      errorMessage = i18nT('travel:components.listTravel.ListTravelBaseHelpers.notFoundTitle')
      errorDetails = i18nT('travel:components.listTravel.ListTravelBaseHelpers.notFoundDetails')
    } else if (normalizedMessage.includes('403') || includesLocalizedErrorToken(normalizedMessage, 'travel:components.listTravel.ListTravelBaseHelpers.accessErrorTokens')) {
      errorMessage = i18nT('travel:components.listTravel.ListTravelBaseHelpers.accessTitle')
      errorDetails = i18nT('travel:components.listTravel.ListTravelBaseHelpers.accessDetails')
    } else {
      errorDetails = error.message
    }
  }

  return { errorMessage, errorDetails }
}

export const SORT_LABEL_FALLBACKS: Record<string, string> = {
  get newest() { return i18nT('travel:components.listTravel.sortings.newest') },
  get oldest() { return i18nT('travel:components.listTravel.sortings.oldest') },
  get popular_desc() { return i18nT('travel:components.listTravel.sortings.popularDesc') },
  get popular_asc() { return i18nT('travel:components.listTravel.sortings.popularAsc') },
  get rating_desc() { return i18nT('travel:components.listTravel.sortings.ratingDesc') },
  get added_desc() { return i18nT('travel:components.listTravel.sortings.createdDesc') },
  get added_asc() { return i18nT('travel:components.listTravel.sortings.createdAsc') },
  get title_asc() { return i18nT('travel:components.listTravel.sortings.nameAsc') },
  get title_desc() { return i18nT('travel:components.listTravel.sortings.nameDesc') },
  get year_desc() { return i18nT('travel:components.listTravel.sortings.yearDesc') },
  get year_asc() { return i18nT('travel:components.listTravel.sortings.yearAsc') },
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

  return match?.title_ru || match?.name || ''
}

export const summarizeFilterValues = (
  title: string,
  values: Array<string | number> | undefined,
  options?: Array<{ id?: string | number; country_id?: string | number; name?: string; title_ru?: string }>,
  optionsOverride: { includeTitle?: boolean } = {},
) => {
  if (!values?.length) return null

  const labels = values.map((value) => getOptionName(options, value)).filter(Boolean)
  if (!labels.length) return null

  const shownLabels = labels.slice(0, 2).join(', ')
  const extraCount = labels.length - 2
  const suffix = `${shownLabels}${extraCount > 0 ? ` +${extraCount}` : ''}`

  return optionsOverride.includeTitle === false ? suffix : `${title}: ${suffix}`
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
    optionsOverride?: { includeTitle?: boolean },
  ) => {
    const label = summarizeFilterValues(title, values, optionList, optionsOverride)
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
      label: i18nT('travel:components.listTravel.ListTravelBase_helpers.poisk_value1_698bdda2', { value1: debSearch.trim() }),
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
      label: i18nT('travel:components.listTravel.ListTravelBase_helpers.sortirovka_value1_31551a22', { value1: sortLabel }),
      onRemove: () => onSelect('sort', undefined),
    })
  }

  addArrayChip('countries', i18nT('travel:components.listTravel.ListTravelBase_helpers.strany_66fde7cb'), filter.countries, options?.countries)
  addArrayChip('categories', i18nT('travel:components.listTravel.ListTravelBase_helpers.kategorii_bfc0cf0b'), filter.categories, options?.categories)
  addArrayChip('categoryTravelAddress', i18nT('travel:components.listTravel.ListTravelBase_helpers.chto_posmotret_5c23fb65'), filter.categoryTravelAddress, options?.categoryTravelAddress, {
    includeTitle: false,
  })
  addArrayChip('transports', i18nT('travel:components.listTravel.ListTravelBase_helpers.transport_4e9bce69'), filter.transports, options?.transports)
  addArrayChip('companions', i18nT('travel:components.listTravel.ListTravelBase_helpers.sputniki_0b9def2a'), filter.companions, options?.companions)
  addArrayChip('complexity', i18nT('travel:components.listTravel.ListTravelBase_helpers.slozhnost_91d3c863'), filter.complexity, options?.complexity)
  addArrayChip('month', i18nT('travel:components.listTravel.ListTravelBase_helpers.mesyats_4afe8979'), filter.month, options?.month)
  addArrayChip('over_nights_stay', i18nT('travel:components.listTravel.ListTravelBase_helpers.nochleg_7fd93f36'), filter.over_nights_stay, options?.over_nights_stay)

  if (filter.year) {
    chips.push({
      key: 'year',
      label: i18nT('travel:components.listTravel.ListTravelBase_helpers.god_value1_cd0926cd', { value1: filter.year }),
      onRemove: () => onSelect('year', undefined),
    })
  }

  if (filter.draftsOnly === true) {
    chips.push({
      key: 'draftsOnly',
      label: i18nT('travel:components.listTravel.ListTravelBase_helpers.chernoviki_18f19ca2'),
      onRemove: () => onSelect('draftsOnly', undefined),
    })
  }

  if (filter.publishedOnly === true) {
    chips.push({
      key: 'publishedOnly',
      label: i18nT('travel:components.listTravel.ListTravelBase_helpers.opublikovannye_b91561a1'),
      onRemove: () => onSelect('publishedOnly', undefined),
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
      activeFilters.push(i18nT('travel:components.listTravel.ListTravelBase_helpers.kategorii_value1_value2_f79c6656', { value1: categoryNames.join('", "'), value2: categoryNames.length < filter.categories.length ? i18nT('travel:components.listTravel.ListTravelBaseHelpers.andOtherPlural') : '' }))
    }
  }

  if (Array.isArray(filter.transports) && filter.transports.length > 0 && options?.transports) {
    const transportNames = (options.transports || [])
      .filter((t: any) => t?.name && filter.transports?.some((fid: any) => String(fid) === String(t.id)))
      .map((t: any) => t.name)
      .slice(0, 2)
    if (transportNames.length > 0) {
      activeFilters.push(i18nT('travel:components.listTravel.ListTravelBase_helpers.transport_value1_value2_6990bba2', { value1: transportNames.join('", "'), value2: transportNames.length < filter.transports.length ? i18nT('travel:components.listTravel.ListTravelBaseHelpers.andOtherMasculine') : '' }))
    }
  }

  if (Array.isArray(filter.categoryTravelAddress) && filter.categoryTravelAddress.length > 0 && options?.categoryTravelAddress) {
    const objectNames = (options.categoryTravelAddress || [])
      .filter((obj: any) => obj?.name && filter.categoryTravelAddress?.some((fid: any) => String(fid) === String(obj.id)))
      .map((obj: any) => obj.name)
      .slice(0, 2)
    if (objectNames.length > 0) {
      activeFilters.push(i18nT('travel:components.listTravel.ListTravelBase_helpers.chto_posmotret_value1_value2_d8d4cfc2', { value1: objectNames.join('", "'), value2: objectNames.length < filter.categoryTravelAddress.length ? i18nT('travel:components.listTravel.ListTravelBaseHelpers.andOtherPlural') : '' }))
    }
  }

  // Остальные фильтры - простые проверки с type guards
  if (Array.isArray(filter.companions) && filter.companions.length > 0) activeFilters.push(i18nT('travel:components.listTravel.ListTravelBase_helpers.sputniki_22bc408f'))
  if (Array.isArray(filter.complexity) && filter.complexity.length > 0) activeFilters.push(i18nT('travel:components.listTravel.ListTravelBase_helpers.slozhnost_86555384'))
  if (Array.isArray(filter.month) && filter.month.length > 0) activeFilters.push(i18nT('travel:components.listTravel.ListTravelBase_helpers.mesyats_91f374e2'))
  if (Array.isArray(filter.over_nights_stay) && filter.over_nights_stay.length > 0) activeFilters.push(i18nT('travel:components.listTravel.ListTravelBase_helpers.nochleg_26da5f51'))
  if (filter.year) activeFilters.push(i18nT('travel:components.listTravel.ListTravelBase_helpers.god_value1_779486da', { value1: filter.year }))
  if (filter.sort) activeFilters.push(i18nT('travel:components.listTravel.ListTravelBase_helpers.sortirovka_37dd0492'))
  if (filter.draftsOnly === true) activeFilters.push(i18nT('travel:components.listTravel.ListTravelBase_helpers.chernoviki_f3bb503d'))
  if (filter.publishedOnly === true) activeFilters.push(i18nT('travel:components.listTravel.ListTravelBase_helpers.opublikovannye_2c3a77ca'))
  if (debSearch) activeFilters.push(i18nT('travel:components.listTravel.ListTravelBase_helpers.poisk_value1_844fca95', { value1: debSearch }))

  // Формируем сообщение
  if (activeFilters.length === 0) {
    if (isMeTravel) {
      return {
        icon: 'map',
        title: i18nT('travel:components.listTravel.ListTravelBase_helpers.u_vas_poka_net_puteshestviy_2c20497b'),
        description:
          i18nT('travel:components.listTravel.ListTravelBase_helpers.sozdayte_pervoe_rasskazhite_o_marshrute_doba_41871790'),
        variant: 'empty' as const,
        action: {
          label: i18nT('travel:components.listTravel.ListTravelBase_helpers.sozdat_puteshestvie_1ae72747'),
          onPress: onCreateTravel,
        },
      }
    }
    return {
      icon: 'inbox',
      title: i18nT('travel:components.listTravel.ListTravelBase_helpers.poka_net_puteshestviy_f1ec3679'),
      description: i18nT('travel:components.listTravel.ListTravelBase_helpers.puteshestviya_poyavyatsya_zdes_kogda_budut_d_32234ae1'),
      variant: 'empty' as const,
    }
  }

  // Формируем красивое описание
  let description: string
  if (activeFilters.length === 1) {
    description = i18nT('travel:components.listTravel.ListTravelBaseHelpers.oneFilterEmpty', { value1: activeFilters[0] })
  } else if (activeFilters.length === 2) {
    description = i18nT('travel:components.listTravel.ListTravelBaseHelpers.twoFiltersEmpty', { value1: activeFilters[0], value2: activeFilters[1] })
  } else {
    const lastFilter = activeFilters[activeFilters.length - 1]
    const otherFilters = activeFilters.slice(0, -1).join(', ')
    description = i18nT('travel:components.listTravel.ListTravelBaseHelpers.manyFiltersEmpty', { value1: otherFilters, value2: lastFilter })
  }

  description += i18nT('travel:components.listTravel.ListTravelBaseHelpers.filterSuggestionSuffix')

  const suggestions = debSearch
    ? [i18nT('travel:components.listTravel.ListTravelBase_helpers.proverte_napisanie_4b385427'), i18nT('travel:components.listTravel.ListTravelBase_helpers.poprobuyte_drugie_klyuchevye_slova_981edc0e')]
    : [i18nT('travel:components.listTravel.ListTravelBase_helpers.uberite_odin_iz_filtrov_fde1af60'), i18nT('travel:components.listTravel.ListTravelBase_helpers.vyberite_druguyu_kategoriyu_84384258')]

  return {
    icon: 'search',
    title: i18nT('travel:components.listTravel.ListTravelBase_helpers.nichego_ne_naydeno_1ef9b55a'),
    description,
    variant: 'search' as const,
    suggestions,
  }
}
