import { useIsScreenHeaderMobile, useScreenHeader } from '@/components/layout/ScreenHeaderContext'
import { translate as i18nT } from '@/i18n'

/**
 * #2099: на телефоне название раздела и «←» рисует строка HeaderContextBar.
 * Возвращает признак телефонной шапки: тогда sr-only h1 каталога не нужен —
 * заголовок первого уровня уже в строке.
 */
export function usePlacesScreenHeader(): boolean {
  useScreenHeader({ title: i18nT('map:screens.tabs.PlacesScreen.mesta_eff0ba98') })
  return useIsScreenHeaderMobile()
}
