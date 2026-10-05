/**
 * Роли вкладки и ряда вкладок (#2262, IOS-TAB-ROLE-TRAIT-001) — единственный
 * владелец. Прямые `accessibilityRole="tab"`/`"tablist"` вне этого файла держит
 * `scripts/guard-tab-roles.js`; `utils/a11y.ts` реэкспортирует помощники и
 * отображает через них `getAccessibilityRole('tab' | 'tablist')`.
 *
 * Модуль без зависимостей кроме `react-native`: его тянут маршрутные чанки web
 * (док, карта, профиль, план поездки), а сборка web без tree shaking — импорт
 * всего `utils/a11y.ts` добавил бы его в каждый из них.
 *
 * RN 0.86 на iOS переводит строку роли в трейт функцией `fromString`
 * (`react-native/ReactCommon/react/renderer/components/view/accessibilityPropsConversions.h`):
 * `tab` и `tablist` в ней нет — трейт `None`, VoiceOver не слышит ни вкладку,
 * ни ряд. `button` даёт UIAccessibilityTraitButton, `tabbar` —
 * UIAccessibilityTraitTabBar (UIKit называет элементы такого контейнера
 * вкладками и объявляет «N из M»), `accessibilityState.selected` —
 * UIAccessibilityTraitSelected
 * (`react-native/React/Fabric/Mounting/ComponentViews/View/RCTViewComponentView.mm`).
 * Тот же обход — в expo-router `BottomTabItem.js` (`ios: 'button'`, FIXME про `tab`).
 * Web и Android — прежние `tab`/`tablist` (на них стоят e2e `getByRole('tab')`).
 *
 * Выбор по исходникам RN; замер Accessibility Inspector — в native-окне
 * поезда 4. Если замер покажет иное, правится только `TAB_ROLES_IOS`.
 */
import { Platform, type AccessibilityRole, type AccessibilityState } from 'react-native'

type TabRoles = Readonly<{ tab: AccessibilityRole; tablist: AccessibilityRole }>

const TAB_ROLES_DEFAULT: TabRoles = { tab: 'tab', tablist: 'tablist' }
const TAB_ROLES_IOS: TabRoles = { tab: 'button', tablist: 'tabbar' }

/** Платформа читается при вызове: iPhone и iPad дают `Platform.OS === 'ios'`. */
export const getTabRoles = (): TabRoles =>
  Platform.OS === 'ios' ? TAB_ROLES_IOS : TAB_ROLES_DEFAULT

export type TabA11yProps = {
  accessibilityRole: AccessibilityRole
  accessibilityState: AccessibilityState
  /** Только web: RN-web переводит в DOM лишь `aria-selected`. */
  'aria-selected'?: boolean
}

export type TabListA11yProps = {
  accessibilityRole: AccessibilityRole
}

/**
 * Props вкладки: роль платформы и `selected`. RN-web 0.21 не переводит
 * `accessibilityState.selected` в `aria-selected` (прод-проба #2217 нашла
 * role="tab" без выбранной вкладки), поэтому на web помощник ставит
 * `aria-selected` сам; native-разметка без него — прежняя.
 */
export const getTabA11yProps = (selected: boolean): TabA11yProps => ({
  accessibilityRole: getTabRoles().tab,
  accessibilityState: { selected },
  ...(Platform.OS === 'web' ? { 'aria-selected': selected } : null),
})

/** Props ряда вкладок: `tablist` на web и Android, `tabbar` на iOS. */
export const getTabListA11yProps = (): TabListA11yProps => ({
  accessibilityRole: getTabRoles().tablist,
})
