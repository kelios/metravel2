// hooks/useQuestPioneerMeta.ts
// Источник поля «первопроходец» (#364) для детальной страницы и финала квеста.
// Бандл квеста не несёт first_completer — берём из списка квестов, который уже
// кешируется queryKeys.quests() (см. useQuestRatingMeta/useQuestCompletionMeta).

import { useQuery } from '@tanstack/react-query'

import { fetchQuestsList, type ApiQuestMeta } from '@/api/quests'
import { queryKeys } from '@/api/queryKeys'

export type QuestPioneer = { id: number; name: string; avatar: string | null }

export function useQuestPioneerMeta(
  questId: string | undefined,
  questNumericId: number | undefined,
): QuestPioneer | null {
  const { data } = useQuery<ApiQuestMeta[]>({
    queryKey: queryKeys.quests(),
    queryFn: fetchQuestsList,
    enabled: Boolean(questId),
    staleTime: 60_000,
  })

  const meta = data?.find(
    (item) => item.id === questNumericId || item.quest_id === questId,
  )
  return meta?.first_completer ?? null
}

export default useQuestPioneerMeta
