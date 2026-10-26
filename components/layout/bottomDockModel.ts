import { Platform } from 'react-native'
import type { Href } from 'expo-router'
import type { BottomDockIconName } from './bottomDockItemDefs'
import { translate as i18nT } from '@/i18n'
import { BOTTOM_DOCK_SECTION_PATHS } from '@/constants/bottomDockRoutes'
import {
  DOCUMENT_NAV_ITEMS,
  PRIMARY_HEADER_NAV_ITEMS,
  SECONDARY_HEADER_NAV_ITEMS,
  SUPPLEMENTARY_NAV_ITEMS,
  type HeaderNavItem,
} from '@/constants/headerNavigation'
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
  /**
   * Пункт-действие вместо перехода: подэкран этого же листа (#2100 «Язык
   * интерфейса», #2779 «Тема оформления»).
   */
  action?: 'language' | 'theme'
  /** Пункт аккаунта (#2152): цель исполняет общий `runAccountMenuTarget`, как в меню шапки. */
  accountTarget?: AccountMenuTarget
  /** Внешняя ссылка из общего списка навигации (Travel-блогеры). */
  external?: boolean
  /** Короткое пояснение раздела под подписью (#2779: «Беларусь», «Места», «Статьи»). */
  hint?: string
  /** Непрочитанные сообщения: лист рисует бейдж у пункта. */
  unreadCount?: number
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
 *
 * #2779: лист «Ещё» — ЕДИНСТВЕННОЕ меню телефона (кнопка меню шапки открывает
 * его же). Навигационные пункты не переписываются здесь руками, а выводятся из
 * `HEADER_NAV_ITEMS` минус корни дока: раньше у шапки и листа были свои списки,
 * и «Попутчики» жили только в одном, «Вы смотрели» — только в другом. Своё у
 * листа — лишь то, чего в шапке нет: «Приложение», «Создать маршрут»,
 * настройки и документы; «Статьи», «Вы смотрели» и др. — общий с desktop
 * `SUPPLEMENTARY_NAV_ITEMS`. «Профиля» в листе нет: он в доке.
 */
const DOCK_ROOT_PATHS = new Set<string>(BOTTOM_DOCK_SECTION_PATHS)

// Подпись — геттер исходного пункта: читается при показе листа, на текущем языке
// (#2156). Поэтому пункт собирается литералом, а не spread'ом — spread вычислил бы
// геттер при загрузке модуля.
const toMoreNavItem = (item: HeaderNavItem, muted?: true): BottomDockMoreMenuItem => ({
  key: item.external ? `external-${item.icon}` : item.path.replace(/^\//, ''),
  get label() { return item.label },
  get accessibilityLabel() { return item.accessibilityLabel ?? item.label },
  get hint() { return item.hint },
  iconName: item.icon,
  route: item.path as Href,
  ...(item.external ? { external: true } : null),
  ...(muted ? { muted } : null),
})

const moreNavItemsFrom = (items: readonly HeaderNavItem[]): BottomDockMoreMenuItem[] =>
  items.filter((item) => !DOCK_ROOT_PATHS.has(item.path)).map((item) => toMoreNavItem(item))

export const BOTTOM_DOCK_MORE_MENU_SECTIONS: BottomDockMoreMenuSection[] = [
  {
    key: 'primary',
    items: [
      // «Скачать приложение» — только на web (внутри native-приложения пункт бессмысленен).
      ...(Platform.OS === 'web'
        ? [{ key: 'app', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.prilozhenie_7069c639') }, get accessibilityLabel() { return i18nT('navigationStatic:bottomDock.appDownload.a11y') }, route: '/app' as Href, iconName: 'smartphone' as BottomDockIconName }]
        : []),
      ...moreNavItemsFrom(PRIMARY_HEADER_NAV_ITEMS),
      // «Статьи», «Хочу поехать», «Вы смотрели», «О сайте» — общий с меню аккаунта
      // desktop список (вне HEADER_NAV_ITEMS, чтобы не стать разделами навигации).
      ...moreNavItemsFrom(SUPPLEMENTARY_NAV_ITEMS),
      ...moreNavItemsFrom(SECONDARY_HEADER_NAV_ITEMS),
      { key: 'travel-new', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.sozdat_marshrut_a61a17b8') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.sozdat_marshrut_a61a17b8') }, route: '/travel/new', iconName: 'plus-circle' },
      // Экспорт в PDF («Книга путешествий») на сайте — только десктоп; в приложении он
      // приходит секцией аккаунта (`isBookExportEntryVisible`).
    ],
  },
  {
    key: 'settings',
    items: [
      { key: 'theme', get label() { return i18nT('navigation:components.layout.AccountMenu.tema_oformleniya_06b0d02a') }, get accessibilityLabel() { return i18nT('navigation:components.layout.AccountMenu.tema_oformleniya_06b0d02a') }, action: 'theme', iconName: 'sun' },
      // #2100: на вложенных экранах телефона бренд-строки с переключателем языка нет.
      { key: 'language', get label() { return i18nT('common:language.settingTitle') }, get accessibilityLabel() { return i18nT('common:language.settingTitle') }, action: 'language', iconName: 'globe' },
    ],
  },
  {
    key: 'secondary',
    items: [
      ...DOCUMENT_NAV_ITEMS.map((item) => toMoreNavItem(item, true)),
      { key: 'terms', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.polzovatelskoe_soglashenie_07f34cdf') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.polzovatelskoe_soglashenie_07f34cdf') }, route: '/terms', iconName: 'file-text', muted: true },
      { key: 'disclaimer', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.otkaz_ot_otvetstvennosti_8830a94d') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.otkaz_ot_otvetstvennosti_8830a94d') }, route: '/disclaimer', iconName: 'alert-triangle', muted: true },
      { key: 'community-rules', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.pravila_soobschestva_e452d5c1') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.pravila_soobschestva_e452d5c1') }, route: '/community-rules', iconName: 'users', muted: true },
      { key: 'trip-rules', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.pravila_uchastiya_v_poezdkah_09160929') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.pravila_uchastiya_v_poezdkah_09160929') }, route: '/trip-rules', iconName: 'map', muted: true },
      { key: 'contact', get label() { return i18nT('navigationStatic:components.layout.bottomDockModel.svyazatsya_s_nami_657cb895') }, get accessibilityLabel() { return i18nT('navigationStatic:components.layout.bottomDockModel.svyazatsya_s_nami_657cb895') }, route: '/contact', iconName: 'mail', muted: true },
    ],
  },
]
