import { Platform } from 'react-native'
import type { Href } from 'expo-router'
import type { NavigationIconName } from '@/constants/navigationIcons'

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
  { key: 'home', label: 'Маршруты', accessibilityLabel: 'Маршруты', route: '/search', iconName: 'route-walk' },
  { key: 'map', label: 'Карта', accessibilityLabel: 'Карта', route: '/map', iconName: 'map-fold' },
  { key: 'quests', label: 'Квесты', accessibilityLabel: 'Квесты', route: '/quests', iconName: 'quest-map-person' },
  { key: 'favorites', label: 'Профиль', accessibilityLabel: 'Профиль', route: '/profile', iconName: 'user' },
  { key: 'more', label: 'Ещё', accessibilityLabel: 'Ещё', route: '/more', iconName: 'more-horizontal', isMore: true },
]

export const BOTTOM_DOCK_MORE_MENU_SECTIONS: BottomDockMoreMenuSection[] = [
  {
    key: 'primary',
    items: [
      // «Скачать приложение» — только на web (внутри native-приложения пункт бессмысленен).
      ...(Platform.OS === 'web'
        ? [{ key: 'app', label: 'Приложение', accessibilityLabel: 'Скачать приложение MeTravel для Android', route: '/app' as Href, iconName: 'smartphone' as BottomDockIconName }]
        : []),
      { key: 'search', label: 'Беларусь', accessibilityLabel: 'Беларусь', route: '/travelsby', iconName: 'belarus-outline' },
      { key: 'places', label: 'Места', accessibilityLabel: 'Места', route: '/places', iconName: 'map-pin' },
      { key: 'articles', label: 'Статьи', accessibilityLabel: 'Статьи', route: '/articles', iconName: 'file-text' },
      { key: 'roulette', label: 'Случайный маршрут', accessibilityLabel: 'Случайный маршрут', route: '/roulette', iconName: 'dice' },
      { key: 'history', label: 'Вы смотрели', accessibilityLabel: 'Вы смотрели: история просмотров', route: '/history', iconName: 'clock' },
      { key: 'travel-new', label: 'Создать маршрут', accessibilityLabel: 'Создать маршрут', route: '/travel/new', iconName: 'plus-circle' },
      // Экспорт в PDF («Книга путешествий») — только десктоп; в мобильном доке пункт убран.
      { key: 'profile', label: 'Профиль', accessibilityLabel: 'Профиль', route: '/profile', iconName: 'user' },
    ],
  },
  {
    key: 'secondary',
    items: [
      { key: 'privacy', label: 'Политика конфиденциальности', accessibilityLabel: 'Политика конфиденциальности', route: '/privacy', iconName: 'shield', muted: true },
      { key: 'cookies', label: 'Настройки cookies', accessibilityLabel: 'Настройки cookies', route: '/cookies', iconName: 'settings', muted: true },
      { key: 'terms', label: 'Пользовательское соглашение', accessibilityLabel: 'Пользовательское соглашение', route: '/terms', iconName: 'file-text', muted: true },
      { key: 'disclaimer', label: 'Отказ от ответственности', accessibilityLabel: 'Отказ от ответственности', route: '/disclaimer', iconName: 'alert-triangle', muted: true },
      { key: 'community-rules', label: 'Правила сообщества', accessibilityLabel: 'Правила сообщества', route: '/community-rules', iconName: 'users', muted: true },
      { key: 'trip-rules', label: 'Правила участия в поездках', accessibilityLabel: 'Правила участия в поездках', route: '/trip-rules', iconName: 'map', muted: true },
      { key: 'about', label: 'Связаться с нами', accessibilityLabel: 'Связаться с нами', route: '/contact', iconName: 'mail', muted: true },
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
