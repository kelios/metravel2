// hooks/useQuestCompletionMeta.ts
// Источник полей прохождения (#363) для детальной страницы и финала квеста.
// Бандл квеста не несёт completions-полей — берём их из списка квестов,
// который уже кешируется queryKeys.quests() (см. useQuestRatingMeta).

import { useQuery } from '@tanstack/react-query'

import { fetchQuestsList, type ApiQuestMeta } from '@/api/quests'
import { queryKeys } from '@/api/queryKeys'
import { QUESTS_LIST_GC_TIME, QUESTS_LIST_STALE_TIME } from '@/hooks/useQuestsApi'

export type QuestCompletionMeta = {
  isCompletedByMe: boolean
  completionsCount: number
}

const EMPTY: QuestCompletionMeta = { isCompletedByMe: false, completionsCount: 0 }

export function useQuestCompletionMeta(
  questId: string | undefined,
  questNumericId: number | undefined,
): QuestCompletionMeta {
  const { data } = useQuery<ApiQuestMeta[]>({
    queryKey: queryKeys.quests(),
    queryFn: fetchQuestsList,
    enabled: Boolean(questId),
    staleTime: QUESTS_LIST_STALE_TIME,
    gcTime: QUESTS_LIST_GC_TIME,
  })

  const meta = data?.find(
    (item) => item.id === questNumericId || item.quest_id === questId,
  )
  if (!meta) return EMPTY

  return {
    isCompletedByMe: meta.is_completed_by_me ?? false,
    completionsCount: meta.completions_count ?? 0,
  }
}

export default useQuestCompletionMeta
