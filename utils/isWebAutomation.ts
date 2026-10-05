import { Platform } from 'react-native'

// #2192: единственный признак web-автоматизации (Playwright, приёмочные пробы).
// Инлайн-скрипт аналитики (`utils/analyticsInlineScript.ts`) исполняется до
// бандла и импортировать модуль не может — он повторяет это выражение, а
// совпадение обеих реализаций по таблице входов держит
// `__tests__/app/analyticsInlineScript.test.ts`.
export const isWebAutomationNavigator = (nav: unknown): boolean =>
  Boolean(nav && (nav as { webdriver?: unknown }).webdriver)

export const isWebAutomation =
  Platform.OS === 'web' &&
  typeof navigator !== 'undefined' &&
  isWebAutomationNavigator(navigator)
