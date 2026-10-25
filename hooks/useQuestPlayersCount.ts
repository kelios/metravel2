// Число разных людей, прошедших хотя бы один квест (#2761). Считает бэкенд
// (`GET /api/quests/stats/`, #2760): сумма `completions_count` по каталогу —
// это прохождения, а не люди.
import { useQuery } from '@tanstack/react-query'

import { fetchQuestStats } from '@/api/quests'
import { queryKeys } from '@/api/queryKeys'

const STATS_STALE_TIME_MS = 10 * 60 * 1000

/** `null`, пока числа нет, при ошибке и при нуле — тогда UI его не показывает. */
export function useQuestPlayersCount(enabled = true): number | null {
  const { data } = useQuery({
    queryKey: queryKeys.questsStats(),
    queryFn: ({ signal }) => fetchQuestStats({ signal }),
    enabled,
    staleTime: STATS_STALE_TIME_MS,
    retry: 1,
  })
  const playersCount = data?.players_count ?? 0
  return playersCount > 0 ? playersCount : null
}

export default useQuestPlayersCount
