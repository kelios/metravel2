import { useQuery } from '@tanstack/react-query'

import { fetchAppTelemetryStats, type AppTelemetryStatsQuery } from '@/api/appTelemetryStats'
import { queryKeys } from '@/api/queryKeys'
import { queryConfigs } from '@/utils/reactQueryConfig'

export function useAppTelemetryStats(query: AppTelemetryStatsQuery, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.appTelemetryStats(query),
    queryFn: () => fetchAppTelemetryStats(query),
    enabled,
    ...queryConfigs.dynamic,
    // Повтор — кнопка на экране. Автоповтор прятал бы ошибку до трёх попыток.
    retry: false,
  })
}
