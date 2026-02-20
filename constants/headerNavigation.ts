export type HeaderNavItemPriority = 'primary' | 'secondary';

export interface HeaderNavItem {
  path: string;
  label: string;
  icon: string;
  priority: HeaderNavItemPriority;
}

export const HEADER_NAV_ITEMS: HeaderNavItem[] = [
  { path: '/search', label: 'Идеи поездок', icon: 'compass', priority: 'primary' },
  { path: '/travelsby', label: 'Беларусь', icon: 'map', priority: 'primary' },
  { path: '/map', label: 'Карта', icon: 'map-pin', priority: 'primary' },
  { path: '/quests', label: 'Квесты', icon: 'flag', priority: 'primary' },
];

export const DOCUMENT_NAV_ITEMS: HeaderNavItem[] = [
  { path: '/privacy', label: 'Политика конфиденциальности', icon: 'shield', priority: 'secondary' },
  { path: '/cookies', label: 'Настройки cookies', icon: 'settings', priority: 'secondary' },
];

export const PRIMARY_HEADER_NAV_ITEMS = HEADER_NAV_ITEMS.filter((item) => item.priority === 'primary');
export const SECONDARY_HEADER_NAV_ITEMS = HEADER_NAV_ITEMS.filter((item) => item.priority === 'secondary');
