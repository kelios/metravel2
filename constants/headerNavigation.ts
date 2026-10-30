import type { NavigationIconName } from './navigationIcons';
import { translate as i18nT } from '@/i18n'
import { isAiAssistantEnabled } from '@/utils/aiAssistantConfig'


export type HeaderNavItemPriority = 'primary' | 'secondary';

export interface HeaderNavItem {
  path: string;
  label: string;
  icon: NavigationIconName;
  priority: HeaderNavItemPriority;
  external?: boolean;
  /**
   * `false` — пункта нет в строке навигации desktop-шапки (не хватает ширины),
   * но он есть в меню аккаунта desktop и в листе «Ещё» телефона (#2779).
   */
  desktopBar?: false;
  /** Подпись для скринридера, если она длиннее видимой. */
  accessibilityLabel?: string;
  /** Короткое пояснение под подписью в листе «Ещё» телефона (#2779). */
  hint?: string;
}

export const HEADER_NAV_ITEMS: HeaderNavItem[] = [
  { path: '/search', get label() { return i18nT('navigationStatic:constants.headerNavigation.marshruty_a87bf12a') }, icon: 'route-walk', priority: 'primary' },
  { path: '/travelsby', get label() { return i18nT('navigationStatic:constants.headerNavigation.belarus_df5087c4') }, get hint() { return i18nT('navigationStatic:constants.headerNavigation.hint.belarus') }, icon: 'belarus-outline', priority: 'primary' },
  { path: '/map', get label() { return i18nT('navigationStatic:constants.headerNavigation.karta_276d5425') }, icon: 'map-fold', priority: 'primary' },
  { path: '/places', get label() { return i18nT('navigationStatic:constants.headerNavigation.mesta_809c3d35') }, get hint() { return i18nT('navigationStatic:constants.headerNavigation.hint.places') }, icon: 'map-pin', priority: 'primary' },
  { path: '/trips', get label() { return i18nT('navigationStatic:constants.headerNavigation.poputchiki_d9961c8c') }, icon: 'users', priority: 'primary', desktopBar: false },
  { path: '/roulette', get label() { return i18nT('navigationStatic:constants.headerNavigation.sluchaynyy_marshrut_3f437e35') }, icon: 'dice', priority: 'primary' },
  { path: '/quests', get label() { return i18nT('navigationStatic:constants.headerNavigation.kvesty_ec386501') }, icon: 'quest-route', priority: 'primary' },
  { path: '/books', get label() { return i18nT('books:title') }, icon: 'book-open', priority: 'primary', desktopBar: false },
  // #2460: ассистент сайта — только под фича-флагом (локально включён, на проде выключен).
  ...(isAiAssistantEnabled()
    ? [{ path: '/assistant', get label() { return i18nT('aiAssistStatic:nav.assistant') }, icon: 'message-circle' as const, priority: 'primary' as const }]
    : []),
  { path: 'https://metravel.by/travels/akkaunty-v-instagram-o-puteshestviyah-po-belarusi', get label() { return i18nT('navigationStatic:constants.headerNavigation.travel_blogery_belarusi_c7bcdee5') }, icon: 'instagram', priority: 'secondary', external: true },
];

/**
 * Дополнительные пункты навигации (#2779): их нет в строке шапки, но они есть и в
 * меню аккаунта desktop («Навигация»), и в листе «Ещё» телефона — один список на
 * обе поверхности. Вне `HEADER_NAV_ITEMS` намеренно: там путь стал бы разделом
 * навигации (`TOP_LEVEL_SECTION_PATHS`) и потерял бы строку «Назад».
 */
export const SUPPLEMENTARY_NAV_ITEMS: HeaderNavItem[] = [
  { path: '/articles', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.stati_ad8e46b8') }, get hint() { return i18nT('navigationStatic:constants.headerNavigation.hint.articles') }, icon: 'file-text', priority: 'secondary' },
  { path: '/favorites', get label() { return i18nT('navigationStatic:components.layout.AccountMenu.hochu_poehat_fa6b46d5') }, icon: 'heart', priority: 'secondary' },
  { path: '/history', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.vy_smotreli_b91d245f') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.vy_smotreli_istoriya_prosmotrov_1ce8007f') }, icon: 'clock', priority: 'secondary' },
  { path: '/about', get label() { return i18nT('navigationStatic:components.layout.AccountMenu.o_sayte_50990f19') }, icon: 'info', priority: 'secondary' },
];

export const DOCUMENT_NAV_ITEMS: HeaderNavItem[] = [
  { path: '/privacy', get label() { return i18nT('navigationStatic:constants.headerNavigation.politika_konfidentsialnosti_fd68e0db') }, icon: 'shield', priority: 'secondary' },
  { path: '/cookies', get label() { return i18nT('navigationStatic:constants.headerNavigation.nastroyki_cookies_05f84dfc') }, icon: 'settings', priority: 'secondary' },
];

/**
 * Единственный источник навигационных пунктов (#2779): строка desktop-шапки,
 * меню аккаунта desktop и лист «Ещё» телефона (`components/layout/bottomDockModel.ts`,
 * минус корни нижнего дока) берут пункты отсюда, а не держат свои списки.
 */
export const PRIMARY_HEADER_NAV_ITEMS = HEADER_NAV_ITEMS.filter((item) => item.priority === 'primary');
export const SECONDARY_HEADER_NAV_ITEMS = HEADER_NAV_ITEMS.filter((item) => item.priority === 'secondary');
export const DESKTOP_BAR_NAV_ITEMS = PRIMARY_HEADER_NAV_ITEMS.filter((item) => item.desktopBar !== false);
