import { Platform } from 'react-native'
import type { Href } from 'expo-router'
import type { NavigationIconName } from '@/constants/navigationIcons'
import { translate as i18nT } from '@/i18n'


export type BottomDockIconName = NavigationIconName

export type BottomDockItemDef = {
  accessibilityLabel: string
  iconName: BottomDockIconName
  isMore?: boolean
  key: string
  label: string
  route: Href
}

export type BottomDockMoreMenuItem = {
  accessibilityLabel: string
  iconName: BottomDockIconName
  key: string
  label: string
  muted?: boolean
  route: Href
}

export type BottomDockMoreMenuSection = {
  key: string
  items: BottomDockMoreMenuItem[]
}

export const BOTTOM_DOCK_ITEM_DEFS: BottomDockItemDef[] = [
  { key: 'home', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.marshruty_b92d1480') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.marshruty_b92d1480') }, route: '/search', iconName: 'route-walk' },
  { key: 'map', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.karta_909db565') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.karta_909db565') }, route: '/map', iconName: 'map-fold' },
  { key: 'quests', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.kvesty_c1acc754') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.kvesty_c1acc754') }, route: '/quests', iconName: 'quest-map-person' },
  { key: 'favorites', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.profil_1f899ea9') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.profil_1f899ea9') }, route: '/profile', iconName: 'user' },
  { key: 'more', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.esche_6ad6f662') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.esche_6ad6f662') }, route: '/more', iconName: 'more-horizontal', isMore: true },
]

export const BOTTOM_DOCK_MORE_MENU_SECTIONS: BottomDockMoreMenuSection[] = [
  {
    key: 'primary',
    items: [
      // «Скачать приложение» — только на web (внутри native-приложения пункт бессмысленен).
      ...(Platform.OS === 'web'
        ? [{ key: 'app', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.prilozhenie_7069c639') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.skachat_prilozhenie_metravel_dlya_android_fd918863') }, route: '/app' as Href, iconName: 'smartphone' as BottomDockIconName }]
        : []),
      { key: 'search', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.belarus_8e52cdc9') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.belarus_8e52cdc9') }, route: '/travelsby', iconName: 'belarus-outline' },
      { key: 'places', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.mesta_9ad589a8') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.mesta_9ad589a8') }, route: '/places', iconName: 'map-pin' },
      { key: 'articles', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.stati_ad8e46b8') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.stati_ad8e46b8') }, route: '/articles', iconName: 'file-text' },
      { key: 'roulette', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.sluchaynyy_marshrut_d57f325e') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.sluchaynyy_marshrut_d57f325e') }, route: '/roulette', iconName: 'dice' },
      { key: 'history', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.vy_smotreli_b91d245f') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.vy_smotreli_istoriya_prosmotrov_1ce8007f') }, route: '/history', iconName: 'clock' },
      { key: 'travel-new', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.sozdat_marshrut_a61a17b8') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.sozdat_marshrut_a61a17b8') }, route: '/travel/new', iconName: 'plus-circle' },
      // Экспорт в PDF («Книга путешествий») — только десктоп; в мобильном доке пункт убран.
      { key: 'profile', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.profil_1f899ea9') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.profil_1f899ea9') }, route: '/profile', iconName: 'user' },
    ],
  },
  {
    key: 'secondary',
    items: [
      { key: 'privacy', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.politika_konfidentsialnosti_5631c326') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.politika_konfidentsialnosti_5631c326') }, route: '/privacy', iconName: 'shield', muted: true },
      { key: 'cookies', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.nastroyki_cookies_cc1adbbe') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.nastroyki_cookies_cc1adbbe') }, route: '/cookies', iconName: 'settings', muted: true },
      { key: 'terms', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.polzovatelskoe_soglashenie_07f34cdf') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.polzovatelskoe_soglashenie_07f34cdf') }, route: '/terms', iconName: 'file-text', muted: true },
      { key: 'disclaimer', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.otkaz_ot_otvetstvennosti_8830a94d') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.otkaz_ot_otvetstvennosti_8830a94d') }, route: '/disclaimer', iconName: 'alert-triangle', muted: true },
      { key: 'community-rules', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.pravila_soobschestva_e452d5c1') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.pravila_soobschestva_e452d5c1') }, route: '/community-rules', iconName: 'users', muted: true },
      { key: 'trip-rules', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.pravila_uchastiya_v_poezdkah_09160929') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.pravila_uchastiya_v_poezdkah_09160929') }, route: '/trip-rules', iconName: 'map', muted: true },
      { key: 'about', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.svyazatsya_s_nami_657cb895') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.svyazatsya_s_nami_657cb895') }, route: '/contact', iconName: 'mail', muted: true },
    ],
  },
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
