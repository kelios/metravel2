import type { NavigationIconName } from './navigationIcons';

export type HeaderNavItemPriority = 'primary' | 'secondary';

export interface HeaderNavItem {
  path: string;
  label: string;
  icon: NavigationIconName;
  priority: HeaderNavItemPriority;
  external?: boolean;
}

export const HEADER_NAV_ITEMS: HeaderNavItem[] = [
  { path: '/search', label: 'Идеи поездок', icon: 'compass', priority: 'primary' },
  { path: '/travelsby', label: 'Беларусь', icon: 'belarus-outline', priority: 'primary' },
  { path: '/map', label: 'Карта', icon: 'map', priority: 'primary' },
  { path: '/places', label: 'Места', icon: 'map-pin', priority: 'primary' },
  { path: '/trips', label: 'Попутчики', icon: 'users', priority: 'primary' },
  { path: '/roulette', label: 'Случайный маршрут', icon: 'coin-flip', priority: 'primary' },
  { path: '/quests', label: 'Квесты', icon: 'quest-route', priority: 'primary' },
  { path: 'https://metravel.by/travels/akkaunty-v-instagram-o-puteshestviyah-po-belarusi', label: 'Travel-блогеры Беларуси', icon: 'users', priority: 'secondary', external: true },
];

export const DOCUMENT_NAV_ITEMS: HeaderNavItem[] = [
  { path: '/privacy', label: 'Политика конфиденциальности', icon: 'shield', priority: 'secondary' },
  { path: '/cookies', label: 'Настройки cookies', icon: 'settings', priority: 'secondary' },
];

export const PRIMARY_HEADER_NAV_ITEMS = HEADER_NAV_ITEMS.filter((item) => item.priority === 'primary');
export const SECONDARY_HEADER_NAV_ITEMS = HEADER_NAV_ITEMS.filter((item) => item.priority === 'secondary');
