import type { Href } from 'expo-router'
import type { NavigationIconName } from '@/constants/navigationIcons'
import { BOTTOM_DOCK_ROUTES } from '@/constants/bottomDockRoutes'
import { translate as i18nT } from '@/i18n'

// Eager navigation owns only the five links; sheet/account data stays deferred.
export const BOTTOM_DOCK_HEIGHT = 56
/** Canonical first-frame CSS producer; consumers pass their visibility boundary. */
export function buildWebDockReserveCss(maxWidth: number): string {
  return `:root{--mt-dock-h:0px}@media (max-width:${maxWidth}px){:root{--mt-dock-h:calc(${BOTTOM_DOCK_HEIGHT}px + env(safe-area-inset-bottom, 0px))}body:has([data-mt-dock="off"]){--mt-dock-h:0px}}`
}
export const OPEN_WEB_DOCK_MORE_EVENT = 'metravel:open-bottom-dock-more'
export type BottomDockIconName = NavigationIconName
export type BottomDockItemDef = {
  accessibilityLabel: string
  iconName: BottomDockIconName
  isMore?: boolean
  key: string
  label: string
  route: Href
}

export const BOTTOM_DOCK_ITEM_DEFS: BottomDockItemDef[] = [
  { key: 'home', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.marshruty_b92d1480') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.marshruty_b92d1480') }, route: BOTTOM_DOCK_ROUTES.home, iconName: 'route-walk' },
  { key: 'map', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.karta_909db565') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.karta_909db565') }, route: BOTTOM_DOCK_ROUTES.map, iconName: 'map-fold' },
  { key: 'quests', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.kvesty_c1acc754') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.kvesty_c1acc754') }, route: BOTTOM_DOCK_ROUTES.quests, iconName: 'quest-map-person' },
  { key: 'favorites', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.profil_1f899ea9') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.profil_1f899ea9') }, route: BOTTOM_DOCK_ROUTES.favorites, iconName: 'user' },
  { key: 'more', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.esche_6ad6f662') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.esche_6ad6f662') }, route: '/more', iconName: 'more-horizontal', isMore: true },
]

export function normalizeBottomDockActivePath(pathname: string): string {
  const normalized = pathname.replace(/^\/\(tabs\)/, '') || '/'

  if (normalized === '/' || normalized === '/index') return ''
  if (normalized.startsWith('/travels/')) return ''
  if (normalized.startsWith('/travel/')) return ''
  if (normalized.startsWith('/search')) return '/search'
  if (normalized.startsWith('/travelsby')) return '/travelsby'
  if (normalized.startsWith('/export')) return '/export'
  if (normalized.startsWith('/map')) return '/map'
  if (normalized.startsWith('/places')) return '/places'
  if (normalized.startsWith('/trips')) return '/trips'
  if (normalized.startsWith('/profile')) return '/profile'
  if (normalized.startsWith('/quests')) return '/quests'
  if (normalized.startsWith('/roulette')) return '/search'

  return normalized
}
