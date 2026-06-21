import type { Href } from 'expo-router'

type BottomDockFeatherIconName =
  | 'alert-triangle'
  | 'book-open'
  | 'clock'
  | 'compass'
  | 'disc'
  | 'file-text'
  | 'flag'
  | 'mail'
  | 'map'
  | 'map-pin'
  | 'more-horizontal'
  | 'plus-circle'
  | 'settings'
  | 'shield'
  | 'shuffle'
  | 'target'
  | 'user'
  | 'users'

export type BottomDockIconName = BottomDockFeatherIconName | 'belarus-outline'

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
  iconName: BottomDockFeatherIconName
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
  { key: 'home', label: 'Маршруты', accessibilityLabel: 'Маршруты', route: '/search', iconName: 'compass' },
  { key: 'map', label: 'Карта', accessibilityLabel: 'Карта', route: '/map', iconName: 'map' },
  { key: 'quests', label: 'Квесты', accessibilityLabel: 'Квесты', route: '/quests', iconName: 'target' },
  { key: 'favorites', label: 'Профиль', accessibilityLabel: 'Профиль', route: '/profile', iconName: 'user' },
  { key: 'more', label: 'Ещё', accessibilityLabel: 'Ещё', route: '/more', iconName: 'more-horizontal', isMore: true },
]

export const BOTTOM_DOCK_MORE_MENU_SECTIONS: BottomDockMoreMenuSection[] = [
  {
    key: 'primary',
    items: [
      { key: 'search', label: 'Беларусь', accessibilityLabel: 'Беларусь', route: '/travelsby', iconName: 'flag' },
      { key: 'places', label: 'Места', accessibilityLabel: 'Места', route: '/places', iconName: 'map-pin' },
      { key: 'trips', label: 'Попутчики', accessibilityLabel: 'Попутчики', route: '/trips', iconName: 'users' },
      { key: 'articles', label: 'Статьи', accessibilityLabel: 'Статьи', route: '/articles', iconName: 'file-text' },
      { key: 'roulette', label: 'Случайный маршрут', accessibilityLabel: 'Случайный маршрут', route: '/roulette', iconName: 'shuffle' },
      { key: 'history', label: 'История просмотров', accessibilityLabel: 'История просмотров', route: '/history', iconName: 'clock' },
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
      { key: 'terms', label: 'Пользовательское соглашение', accessibilityLabel: 'Пользовательское соглашение', route: '/terms', iconName: 'file-text', muted: true },
      { key: 'disclaimer', label: 'Отказ от ответственности', accessibilityLabel: 'Отказ от ответственности', route: '/disclaimer', iconName: 'alert-triangle', muted: true },
      { key: 'community-rules', label: 'Правила сообщества', accessibilityLabel: 'Правила сообщества', route: '/community-rules', iconName: 'users', muted: true },
      { key: 'trip-rules', label: 'Правила участия в поездках', accessibilityLabel: 'Правила участия в поездках', route: '/trip-rules', iconName: 'map', muted: true },
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
  if (normalized.startsWith('/places')) return '/places'
  if (normalized.startsWith('/trips')) return '/trips'
  if (normalized.startsWith('/profile')) return '/profile'
  if (normalized.startsWith('/quests')) return '/quests'
  if (normalized.startsWith('/roulette')) return '/search'

  return normalized
}
