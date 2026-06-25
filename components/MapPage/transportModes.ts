/**
 * Shared transport-mode options for route building.
 *
 * Single source of truth for the desktop filters sheet (FiltersPanelRouteSection)
 * and the mobile map toolbar (MapMobileTopOverlay) so the car/foot/bike profiles,
 * their Material icons and labels never drift between surfaces.
 *
 * Icons are rendered via `MapIcon` (iconSource 'material' → MaterialCommunityIcons
 * glyphs car / walk / bike). Profiles map to ORS via `getORSProfile`
 * (utils/routingHelpers.ts): car → driving-car, bike → cycling-regular,
 * foot → foot-walking.
 */
export type TransportMode = 'car' | 'bike' | 'foot'

export interface TransportModeOption {
  key: TransportMode
  icon: 'directions-car' | 'directions-walk' | 'directions-bike'
  label: string
  iconSource: 'material'
}

/** Rough average speeds (km/h) used for the haversine duration estimate. */
export const TRANSPORT_SPEED_KMH: Record<TransportMode, number> = {
  car: 60,
  bike: 20,
  foot: 5,
}

/** Order used in both the desktop segmented control and the mobile popover. */
export const TRANSPORT_MODES: ReadonlyArray<TransportModeOption> = [
  { key: 'car', icon: 'directions-car', label: 'Авто', iconSource: 'material' },
  { key: 'foot', icon: 'directions-walk', label: 'Пешком', iconSource: 'material' },
  { key: 'bike', icon: 'directions-bike', label: 'Велосипед', iconSource: 'material' },
]

export const TRANSPORT_LABEL: Record<TransportMode, string> = {
  car: 'Авто',
  foot: 'Пешком',
  bike: 'Велосипед',
}

export const TRANSPORT_ICON: Record<TransportMode, TransportModeOption['icon']> = {
  car: 'directions-car',
  foot: 'directions-walk',
  bike: 'directions-bike',
}
