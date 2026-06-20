// hooks/useQuestRatingMeta.ts
// Источник рейтинга для детальной страницы и финала квеста.
// Бандл квеста не несёт rating-полей — берём их из списка квестов и
// засеваем кеши queryKeys.quests()/questDetail, на которые опирается
// оптимистика useRateQuestMutation.

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchQuestsList, type ApiQuestMeta } from '@/api/quests'
import { queryKeys } from '@/api/queryKeys'

export type QuestRatingMeta = {
  ratingAvg: number | null
  ratingCount: number
  userRating: 1 | 2 | 3 | 4 | 5 | null
}

const EMPTY: QuestRatingMeta = { ratingAvg: null, ratingCount: 0, userRating: null }

export function useQuestRatingMeta(
  questId: string | undefined,
  questNumericId: number | undefined,
): QuestRatingMeta {
  const queryClient = useQueryClient()

  const { data } = useQuery<ApiQuestMeta[]>({
    queryKey: queryKeys.quests(),
    queryFn: async () => {
      const list = await fetchQuestsList()
      const match = list.find((meta) => meta.quest_id === questId)
      if (match) {
        queryClient.setQueryData<ApiQuestMeta>(queryKeys.questDetail(match.id), match)
      }
      return list
    },
    enabled: Boolean(questId),
    staleTime: 60_000,
  })

  if (questNumericId == null) return EMPTY

  const detail = queryClient.getQueryData<ApiQuestMeta>(queryKeys.questDetail(questNumericId))
  const meta = detail ?? data?.find((item) => item.id === questNumericId)
  if (!meta) return EMPTY

  return {
    ratingAvg: meta.rating_avg ?? null,
    ratingCount: meta.rating_count ?? 0,
    userRating: meta.user_rating ?? null,
  }
}

export default useQuestRatingMeta
