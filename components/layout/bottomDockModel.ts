import { Platform } from 'react-native'
import type { Href } from 'expo-router'
import type { BottomDockIconName } from './bottomDockItemDefs'
import { translate as i18nT } from '@/i18n'
import type { AccountMenuTarget } from './accountMenuModel'

/**
 * Высота полосы дока без safe-area (dp). Экраны, чей контент скроллится под доком,
 * обязаны компенсировать её нижним отступом — иначе хвост контента недостижим
 * (#1277: последняя секция «Контакты» юридических страниц уходила под таб-бар).
 * На native к этому значению добавляется `insets.bottom`.
 */
export { BOTTOM_DOCK_HEIGHT, BOTTOM_DOCK_ITEM_DEFS, normalizeBottomDockActivePath } from './bottomDockItemDefs'
export type { BottomDockIconName, BottomDockItemDef } from './bottomDockItemDefs'

export type BottomDockMoreMenuItem = {
  accessibilityLabel: string
  iconName: BottomDockIconName
  key: string
  label: string
  muted?: boolean
  /** Пункт-действие вместо перехода (#2100: «Язык интерфейса» открывает лист выбора). */
  action?: 'language'
  /** Пункт аккаунта (#2152): цель исполняет общий `runAccountMenuTarget`, как в меню шапки. */
  accountTarget?: AccountMenuTarget
  route?: Href
}

export type BottomDockMoreMenuSection = {
  key: string
  items: BottomDockMoreMenuItem[]
}

/**
 * Пять пунктов дока. Пункта «Главная» здесь СОЗНАТЕЛЬНО нет: ключ `home` ведёт
 * на `/search` («Маршруты») — это и есть основной вход в продукт с телефона, а
 * шестой пункт разрушил бы ширину строки на 360 pt.
 *
 * #1725: раньше отсутствие «Главной» ничем не компенсировалось — контекст-бар
 * прятали на «верхних разделах» под обещание, что раздел назван в доке, и с
 * `/search?categoryTravelAddress=33,43` вернуться было некуда. Выбран второй
 * вариант из двух: состав дока не трогаем, а решение «показывать ли строку
 * возврата» больше не опирается на док — оно опирается на то, попали ли на
 * экран переходом (`components/layout/topLevelSections.ts`).
 *
 * Набор маршрутов дока при этом остаётся частью определения «раздел навигации»:
 * `/profile` есть только здесь и в основном меню отсутствует.
 */
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
      // #2100: на вложенных экранах телефона бренд-строки с переключателем языка нет.
      { key: 'language', get label() { return i18nT('common:language.settingTitle') }, get accessibilityLabel() { return i18nT('common:language.settingTitle') }, action: 'language', iconName: 'globe' },
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
