import type { MapOnboardingTargetRegistry } from './MapOnboarding'

export interface MapMobileLayoutProps {
  targetRegistry?: MapOnboardingTargetRegistry
  travelsData: any[]
  hasMore?: boolean
  onLoadMore?: () => void
  onRefresh?: () => void
  isLoading?: boolean
  isRefreshing?: boolean
  /** Центр радиус-запроса: от него «Места рядом» считают расстояние без GPS (#2776). */
  coordinates: { latitude: number; longitude: number } | null
  transportMode: 'car' | 'bike' | 'foot'
  buildRouteTo: (item: any) => void
  focusPlace?: (item: any) => void
  totalCount?: number
  onCenterOnUser: () => void
  // Сброс фильтров и радиуса + fit ко всем точкам. Кнопка в ряду видна, только
  // когда сбрасывать есть что (#2777, useMapMobilePointSummary).
  onShowAllPlaces?: () => void
  // F-49 — Google-Maps-style "Search this area" affordance.
  canSearchThisArea?: boolean
  onSearchThisArea?: () => void
  onOpenFilters: () => void
  filtersPanelProps: any
  onToggleFavorite?: (id: string | number) => void
  favorites?: Set<string | number>
  onResetFilters?: () => void
  // True when category/search filters are active — reveals the always-visible
  // quick reset button in the top overlay (radius excluded, it always has a value).
  hasActiveFilters?: boolean
  onExpandRadius?: () => void
  // Чипы активных фильтров поверх карты при закрытой панели (общий ActiveFiltersBar).
  activeFilterItems?: ReadonlyArray<{ key: string; label: string }>
  onRemoveActiveFilter?: (key: string) => void
  // #207 — selected single marker → maps.me-style bottom card.
  selectedPlace?: any | null
  clearSelectedPlace?: () => void
  selectedPlaceUserLocation?: { latitude: number; longitude: number } | null
  userLocation?: { latitude: number; longitude: number } | null
}
