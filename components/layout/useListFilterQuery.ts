import { useGlobalSearchParams, useLocalSearchParams } from 'expo-router'

import { hasListFilterQuery } from './topLevelSections'

// Моки expo-router в юнит-тестах нередко отдают только useLocalSearchParams —
// тот же приём, что и в hooks/useBreadcrumbModel.ts. Выбор делается один раз на
// загрузке модуля, поэтому порядок хуков в рендере остаётся постоянным.
const useRouteParams: () => Record<string, unknown> =
  typeof useGlobalSearchParams === 'function'
    ? (useGlobalSearchParams as unknown as () => Record<string, unknown>)
    : typeof useLocalSearchParams === 'function'
      ? (useLocalSearchParams as unknown as () => Record<string, unknown>)
      : () => ({})

/**
 * Несёт ли текущий адрес фильтр списка маршрутов (#1725).
 *
 * `enabled=false` на web до гидратации: статический HTML один на `/search` и на
 * `/search?categoryTravelAddress=33,43`, поэтому решение по параметрам запроса
 * на первом рендере дало бы расхождение SSR→клиент (React #418). После
 * гидратации значение становится настоящим.
 */
export function useHasListFilterQuery(enabled: boolean = true): boolean {
  const params = useRouteParams() ?? {}
  return enabled ? hasListFilterQuery(params) : false
}
