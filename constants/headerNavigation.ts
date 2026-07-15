import type { NavigationIconName } from './navigationIcons';
import { translate as i18nT } from '@/i18n'


export type HeaderNavItemPriority = 'primary' | 'secondary';

export interface HeaderNavItem {
  path: string;
  label: string;
  icon: NavigationIconName;
  priority: HeaderNavItemPriority;
  external?: boolean;
}

export const HEADER_NAV_ITEMS: HeaderNavItem[] = [
  { path: '/search', get label() { return i18nT('navigationStatic:constants.headerNavigation.marshruty_a87bf12a') }, icon: 'route-walk', priority: 'primary' },
  { path: '/travelsby', get label() { return i18nT('navigationStatic:constants.headerNavigation.belarus_df5087c4') }, icon: 'belarus-outline', priority: 'primary' },
  { path: '/map', get label() { return i18nT('navigationStatic:constants.headerNavigation.karta_276d5425') }, icon: 'map-fold', priority: 'primary' },
  { path: '/places', get label() { return i18nT('navigationStatic:constants.headerNavigation.mesta_809c3d35') }, icon: 'map-pin', priority: 'primary' },
  { path: '/trips', get label() { return i18nT('navigationStatic:constants.headerNavigation.poputchiki_d9961c8c') }, icon: 'users', priority: 'primary' },
  { path: '/roulette', get label() { return i18nT('navigationStatic:constants.headerNavigation.sluchaynyy_marshrut_3f437e35') }, icon: 'dice', priority: 'primary' },
  { path: '/quests', get label() { return i18nT('navigationStatic:constants.headerNavigation.kvesty_ec386501') }, icon: 'quest-route', priority: 'primary' },
  { path: 'https://metravel.by/travels/akkaunty-v-instagram-o-puteshestviyah-po-belarusi', get label() { return i18nT('navigationStatic:constants.headerNavigation.travel_blogery_belarusi_c7bcdee5') }, icon: 'instagram', priority: 'secondary', external: true },
];

export const DOCUMENT_NAV_ITEMS: HeaderNavItem[] = [
  { path: '/privacy', get label() { return i18nT('navigationStatic:constants.headerNavigation.politika_konfidentsialnosti_fd68e0db') }, icon: 'shield', priority: 'secondary' },
  { path: '/cookies', get label() { return i18nT('navigationStatic:constants.headerNavigation.nastroyki_cookies_05f84dfc') }, icon: 'settings', priority: 'secondary' },
];

export const PRIMARY_HEADER_NAV_ITEMS = HEADER_NAV_ITEMS.filter((item) => item.priority === 'primary');
export const SECONDARY_HEADER_NAV_ITEMS = HEADER_NAV_ITEMS.filter((item) => item.priority === 'secondary');
