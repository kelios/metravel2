import { Platform } from 'react-native'

import { useHydrationReady } from '@/hooks/useHydrationReady'
import { isWebAutomationNavigator } from '@/utils/isWebAutomation'

/**
 * Признак web-автоматизации (Playwright, приёмочные пробы) для РЕНДЕРА.
 *
 * #2912: сервер не знает `navigator.webdriver`, поэтому любое чтение флага в
 * теле компонента давало под автоматизацией первый клиентский кадр, не
 * совпадающий с серверным HTML (React #418). Хук возвращает `false` в SSR и в
 * первом кадре гидрации и переключается на реальный флаг сразу после commit —
 * ускорение приёмок сохраняется, но начинается со второго кадра, как и портал
 * бара действий в #2768.
 *
 * Для эффектов, телеметрии и аналитики остаётся модульная константа
 * `isWebAutomation` из `@/utils/isWebAutomation`: там нет разметки, которую
 * надо сверять с сервером.
 */
export function useWebAutomation(): boolean {
  const hydrationReady = useHydrationReady()
  return (
    hydrationReady &&
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    isWebAutomationNavigator(navigator)
  )
}
