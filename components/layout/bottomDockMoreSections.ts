import { buildAccountRoleEntries } from './accountMenuModel'
import {
  BOTTOM_DOCK_MORE_MENU_SECTIONS,
  type BottomDockMoreMenuItem,
  type BottomDockMoreMenuSection,
} from './bottomDockModel'

/**
 * Секции листа «Ещё» для текущего пользователя: статические пункты плюс ролевые
 * пункты аккаунта из `buildAccountRoleEntries` (#2152) — одной секцией между
 * навигацией и документами. Литерала ролевого пункта здесь нет: состав и роль
 * задаёт модель меню аккаунта, док только отображает. Считается при показе листа,
 * чтобы подпись шла на текущем языке.
 *
 * Отдельный модуль, а не `bottomDockModel.ts`: ту модель (ради `BOTTOM_DOCK_HEIGHT`)
 * импортирует `constants/layout.ts` из entry-чанка, а модель меню аккаунта туда
 * тянуть незачем — лист «Ещё» грузится вместе с доком.
 */
export function buildBottomDockMoreSections({ isSuperuser }: { isSuperuser?: boolean }): BottomDockMoreMenuSection[] {
  const roleItems: BottomDockMoreMenuItem[] = buildAccountRoleEntries({ isSuperuser }).map((entry) => ({
    key: entry.key,
    label: entry.title,
    accessibilityLabel: entry.accessibilityLabel ?? entry.title,
    iconName: entry.icon,
    accountTarget: entry.target,
  }))
  if (roleItems.length === 0) return BOTTOM_DOCK_MORE_MENU_SECTIONS

  const [primary, ...rest] = BOTTOM_DOCK_MORE_MENU_SECTIONS
  return [primary, { key: 'role', items: roleItems }, ...rest]
}
