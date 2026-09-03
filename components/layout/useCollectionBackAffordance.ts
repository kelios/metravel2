import { useResponsive } from '@/hooks/useResponsive'

import { isCollectionBackAffordanceGlobal } from './customHeaderModel'
import { resolveHeaderContextBarIsMobile } from './headerContextBarModel'

/**
 * `true`, когда «Назад» на этом экране уже рисует глобальный `HeaderContextBar`
 * и собственная шапка коллекции (`ProfileCollectionHeader`) обязана молчать во
 * ВСЕХ состояниях экрана — семья NATIVE-DUP-BACK-AFFORDANCE-001.
 *
 * Ширину читаем тем же `useResponsive` и прогоняем через тот же
 * `resolveHeaderContextBarIsMobile`, что и сам бар: иначе экран и бар отвечают
 * на вопрос «кто рисует „Назад“» по разным правилам, и на планшете/в ландшафте
 * (бар в desktop-ветке, а на этих путях `showBreadcrumbs: false`) обе шапки
 * молчали бы разом.
 */
export function useCollectionBackAffordanceGlobal(pathname: string): boolean {
  const { width, isPhone, isLargePhone } = useResponsive()

  return isCollectionBackAffordanceGlobal(
    pathname,
    resolveHeaderContextBarIsMobile({ width, isPhone, isLargePhone }),
  )
}
