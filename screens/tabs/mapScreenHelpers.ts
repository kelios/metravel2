import { DEFAULT_RADIUS_KM } from '@/constants/mapConfig'

export const TRANSPORT_LABELS: Record<string, string> = { bike: 'Велосипед', foot: 'Пешком' }

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
      ? 'Все'
      : selected.length === 1
        ? selected[0]
        : `${selected.length} выбрано`

  const radiusValue = currentRadius ? `${currentRadius} км` : `${DEFAULT_RADIUS_KM} км`

  const enabledCount = overlayOptions.filter((option: { id: string }) =>
    Boolean(enabledOverlays?.[option.id]),
  ).length
  const overlaysValue =
    enabledCount === 0 ? 'Выкл' : enabledCount === 1 ? '1 вкл' : `${enabledCount} вкл`

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
  const radiusVal = currentRadius || String(DEFAULT_RADIUS_KM)
  items.push({ key: 'radius', label: `${radiusVal} км` })
  if (currentMode === 'route' && currentTransport !== 'car') {
    items.push({
      key: 'transport',
      label: TRANSPORT_LABELS[currentTransport] ?? currentTransport,
    })
  }
  return items
}
