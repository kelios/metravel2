import { translate as i18nT } from '@/i18n'

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
const TRANSPORT_MODE_DEFINITIONS: ReadonlyArray<Omit<TransportModeOption, 'label'>> = [
  { key: 'car', icon: 'directions-car', iconSource: 'material' },
  { key: 'foot', icon: 'directions-walk', iconSource: 'material' },
  { key: 'bike', icon: 'directions-bike', iconSource: 'material' },
]

export const getTransportLabel = (mode: TransportMode): string => {
  switch (mode) {
    case 'bike':
      return i18nT('map:components.MapPage.transportModes.velosiped_82cf8bea')
    case 'foot':
      return i18nT('map:components.MapPage.transportModes.peshkom_f6e70267')
    default:
      return i18nT('map:components.MapPage.transportModes.avto_320b0f3d')
  }
}

export const getTransportModes = (): ReadonlyArray<TransportModeOption> =>
  TRANSPORT_MODE_DEFINITIONS.map((option) => ({
    ...option,
    label: getTransportLabel(option.key),
  }))

export const TRANSPORT_ICON: Record<TransportMode, TransportModeOption['icon']> = {
  car: 'directions-car',
  foot: 'directions-walk',
  bike: 'directions-bike',
}
