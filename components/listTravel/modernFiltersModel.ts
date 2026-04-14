import { Platform } from 'react-native'
import { METRICS } from '@/constants/layout'
import { getTravelLabel } from '@/services/pdf-export/utils/pluralize'
import type { FilterGroup, FilterState } from './ModernFilters'

export function getModernFiltersReserveState(params: {
  filterGroups: FilterGroup[]
  isLoading: boolean
  isNarrowWeb: boolean
}) {
  const hasOptions = params.filterGroups.some((group) => (group.options || []).length > 0)
  const shouldReserveSpace = params.isLoading || !hasOptions
  const reserveMinHeight =
    Platform.OS === 'web'
      ? params.isNarrowWeb
        ? 720
        : 760
      : 640

  return {
    hasOptions,
    reserveMinHeight,
    shouldReserveSpace,
  }
}

export function getModernFiltersViewportState() {
  const isNarrowWeb =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.innerWidth <= METRICS.breakpoints.tablet
      : Platform.OS === 'web'

  return {
    isNarrowWeb,
    shouldReserveResultsBadge: Platform.OS !== 'web' || isNarrowWeb,
    showsStickyFooter: Platform.OS !== 'web' || isNarrowWeb,
  }
}

export function getModernFiltersActiveCount(selectedFilters: FilterState) {
  return Object.values(selectedFilters).reduce<number>((sum, filters) => {
    if (Array.isArray(filters)) {
      return sum + filters.length
    }

    return sum
  }, 0)
}

export function splitModernFilterGroups(filterGroups: FilterGroup[]) {
  return {
    groupsWithoutSort: filterGroups.filter((group) => group.key !== 'sort'),
    sortGroup: filterGroups.find((group) => group.key === 'sort'),
  }
}

export function getModernFiltersResultsText(resultsCount?: number) {
  if (typeof resultsCount !== 'number') return ''
  return `Найдено ${resultsCount} ${getTravelLabel(resultsCount)}`
}

export function getOrderedModernFilterOptions(group: FilterGroup, selectedFilters: FilterState) {
  const rawSelected = selectedFilters[group.key]
  const isMultiSelect = group.multiSelect !== false
  const selectedArray = isMultiSelect
    ? (Array.isArray(rawSelected) ? rawSelected : [])
    : rawSelected !== undefined && rawSelected !== null && (rawSelected as any) !== ''
      ? [rawSelected].flat()
      : []
  const selectedSet = new Set(selectedArray.map(String))
  const selectedNames = group.options
    .filter((option) => selectedSet.has(String(option.id)))
    .map((option) => option.name)
  const orderedOptions = group.options.slice().sort((a, b) => {
    const aSelected = selectedSet.has(String(a.id))
    const bSelected = selectedSet.has(String(b.id))
    if (aSelected === bSelected) return 0
    return aSelected ? -1 : 1
  })

  return {
    isMultiSelect,
    orderedOptions,
    selectedArray,
    selectedCount: selectedArray.length,
    selectedNames,
    selectedSet,
  }
}
