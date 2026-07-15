import { DEFAULT_RADIUS_KM, formatRadiusLabel } from '@/constants/mapConfig'
import { translate as i18nT } from '@/i18n'
import { getTransportLabel, type TransportMode } from '@/components/MapPage/transportModes'


export function buildQuickFiltersData(
  filtersPanelProps: any,
  currentRadius: string | number | undefined,
) {
  const ctx = filtersPanelProps?.contextValue
  const filterValue = ctx?.filterValue ?? {}
  const filters = ctx?.filters ?? {}

  const selected: string[] = filterValue?.categoryTravelAddress ?? []
  const radiusOptions = filters?.radius ?? []
  const categoryOptions = filters?.categoryTravelAddress ?? []
  const overlayOptions = ctx?.overlayOptions ?? []
  const enabledOverlays = ctx?.enabledOverlays ?? {}

  const categoriesValue =
    selected.length === 0
      ? i18nT('shared:screens.tabs.mapScreenHelpers.vse_6cde58a0')
      : selected.length === 1
        ? selected[0]
        : i18nT('shared:screens.tabs.mapScreenHelpers.value1_vybrano_231632d5', { value1: selected.length })

  const radiusValue = formatRadiusLabel(currentRadius || DEFAULT_RADIUS_KM)

  const enabledCount = overlayOptions.filter((option: { id: string }) =>
    Boolean(enabledOverlays?.[option.id]),
  ).length
  const overlaysValue =
    enabledCount === 0 ? i18nT('shared:screens.tabs.mapScreenHelpers.vykl_a6690835') : enabledCount === 1 ? i18nT('shared:screens.tabs.mapScreenHelpers.1_vkl_a8471bf0') : i18nT('shared:screens.tabs.mapScreenHelpers.value1_vkl_53e16bc6', { value1: enabledCount })

  return {
    selected,
    radiusOptions,
    categoryOptions,
    overlayOptions,
    enabledOverlays,
    categoriesValue,
    radiusValue,
    overlaysValue,
  }
}

export function buildActiveFilterItems(
  selectedCategories: string[],
  currentRadius: string | number | undefined,
  currentMode: string | undefined,
  currentTransport: string,
): { key: string; label: string }[] {
  const items: { key: string; label: string }[] = []
  selectedCategories.forEach((cat: string) => items.push({ key: `cat:${cat}`, label: cat }))
  items.push({ key: 'radius', label: formatRadiusLabel(currentRadius || DEFAULT_RADIUS_KM) })
  if (currentMode === 'route' && currentTransport !== 'car') {
    items.push({
      key: 'transport',
      label: ['car', 'bike', 'foot'].includes(currentTransport)
        ? getTransportLabel(currentTransport as TransportMode)
        : currentTransport,
    })
  }
  return items
}
