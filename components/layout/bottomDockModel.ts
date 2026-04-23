import type { Href } from 'expo-router'

export type BottomDockIconName =
  | 'book-open'
  | 'compass'
  | 'flag'
  | 'mail'
  | 'map'
  | 'map-pin'
  | 'more-horizontal'
  | 'plus-circle'
  | 'settings'
  | 'shield'
  | 'shuffle'
  | 'user'

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
  { key: 'home', label: 'Идеи', accessibilityLabel: 'Идеи поездок', route: '/search', iconName: 'compass' },
  { key: 'search', label: 'Бел', accessibilityLabel: 'Беларусь', route: '/travelsby', iconName: 'map' },
  { key: 'map', label: 'Карта', accessibilityLabel: 'Карта', route: '/map', iconName: 'map-pin' },
  { key: 'quests', label: 'Квесты', accessibilityLabel: 'Квесты', route: '/quests', iconName: 'flag' },
  { key: 'favorites', label: 'Я', accessibilityLabel: 'Профиль', route: '/profile', iconName: 'user' },
  { key: 'more', label: 'Ещё', accessibilityLabel: 'Ещё', route: '/more', iconName: 'more-horizontal', isMore: true },
]

export const BOTTOM_DOCK_MORE_MENU_SECTIONS: BottomDockMoreMenuSection[] = [
  {
    key: 'primary',
    items: [
      { key: 'roulette', label: 'Случайная поездка', accessibilityLabel: 'Случайная поездка', route: '/roulette', iconName: 'shuffle' },
      { key: 'travel-new', label: 'Создать маршрут', accessibilityLabel: 'Создать маршрут', route: '/travel/new', iconName: 'plus-circle' },
      { key: 'export', label: 'Книга путешествий', accessibilityLabel: 'Книга путешествий', route: '/export', iconName: 'book-open' },
      { key: 'profile', label: 'Профиль', accessibilityLabel: 'Профиль', route: '/profile', iconName: 'user' },
    ],
  },
  {
    key: 'secondary',
    items: [
      { key: 'privacy', label: 'Политика конфиденциальности', accessibilityLabel: 'Политика конфиденциальности', route: '/privacy', iconName: 'shield', muted: true },
      { key: 'cookies', label: 'Настройки cookies', accessibilityLabel: 'Настройки cookies', route: '/cookies', iconName: 'settings', muted: true },
      { key: 'about', label: 'Связаться с нами', accessibilityLabel: 'Связаться с нами', route: '/about', iconName: 'mail', muted: true },
    ],
  },
]

export function normalizeBottomDockActivePath(pathname: string): string {
  const normalized = pathname.replace(/^\/\(tabs\)/, '') || '/'

  if (normalized === '/' || normalized === '/index') return '/search'
  if (normalized.startsWith('/travels/')) return ''
  if (normalized.startsWith('/travel/')) return ''
  if (normalized.startsWith('/search')) return '/search'
  if (normalized.startsWith('/travelsby')) return '/travelsby'
  if (normalized.startsWith('/export')) return '/export'
  if (normalized.startsWith('/map')) return '/map'
  if (normalized.startsWith('/profile')) return '/profile'
  if (normalized.startsWith('/quests')) return '/quests'
  if (normalized.startsWith('/roulette')) return '/search'

  return normalized
}
