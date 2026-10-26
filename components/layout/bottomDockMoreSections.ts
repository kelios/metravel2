import { Platform } from 'react-native'

import { isNavRouteAvailable } from '@/constants/platformNavRoutes'
import { buildAccountMenuModel, type AccountMenuEntry, type AccountMenuInput } from './accountMenuModel'
import {
  BOTTOM_DOCK_MORE_MENU_SECTIONS,
  type BottomDockMoreMenuItem,
  type BottomDockMoreMenuSection,
} from './bottomDockModel'

export type BottomDockMoreAccountState = Partial<
  Pick<AccountMenuInput, 'isAuthenticated' | 'isSuperuser' | 'userId' | 'username' | 'unreadCount'>
>

const toAccountItem = (entry: AccountMenuEntry): BottomDockMoreMenuItem => ({
  key: entry.key,
  label: entry.title,
  accessibilityLabel: entry.accessibilityLabel ?? entry.title,
  iconName: entry.icon,
  accountTarget: entry.target,
  ...(entry.unreadCount !== undefined ? { unreadCount: entry.unreadCount } : null),
})

/**
 * Секции листа «Ещё» — единственного меню телефона (#2779) — для текущего
 * пользователя: навигация, секция аккаунта, настройки и документы.
 *
 * Секция аккаунта — из общей модели меню аккаунта (`buildAccountMenuModel`, та же,
 * что у desktop-меню), без «Личного кабинета» (он — пункт «Профиль» дока) и без
 * пунктов, которые уже есть в навигации листа («Создать маршрут»). Ролевые пункты
 * (#2152) приходят в ней же. Гостю секции нет: «Войти» стоит в шапке, а «Профиль»
 * дока ведёт гостя на вход.
 *
 * Пункты, недоступные на платформе (настройки cookies на native, #2135), отсекает
 * общая политика `isNavRouteAvailable` — одна для всех веток листа.
 *
 * Считается при показе листа, чтобы подпись шла на текущем языке. Отдельный модуль,
 * а не `bottomDockModel.ts`: ту модель (ради константы высоты дока) импортирует
 * `constants/layout.ts` из entry-чанка, а модель меню аккаунта туда тянуть незачем —
 * лист «Ещё» грузится вместе с доком.
 */
export function buildBottomDockMoreSections(
  state: BottomDockMoreAccountState,
  platform: string = Platform.OS,
): BottomDockMoreMenuSection[] {
  const [primary, ...rest] = BOTTOM_DOCK_MORE_MENU_SECTIONS
  const primaryKeys = new Set(primary.items.map((item) => item.key))
  const account = buildAccountMenuModel({
    surface: 'mobile',
    platform,
    isAuthenticated: Boolean(state.isAuthenticated),
    isSuperuser: state.isSuperuser,
    userId: state.userId,
    username: state.username,
    favoritesCount: 0,
    unreadCount: state.unreadCount ?? 0,
  })
  const accountItems = [...account.travels, ...account.account]
    .filter((entry) => !primaryKeys.has(entry.key))
    .map(toAccountItem)

  const sections = accountItems.length > 0 ? [primary, { key: 'account', items: accountItems }, ...rest] : [primary, ...rest]

  return sections
    .map((section) => ({
      key: section.key,
      items: section.items.filter((item) => item.route === undefined || isNavRouteAvailable(item.route, platform)),
    }))
    .filter((section) => section.items.length > 0)
}
