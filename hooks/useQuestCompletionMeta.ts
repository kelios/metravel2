// Metadata shares the route's single-quest bundle, never the full catalog.
import { useQuestBundleQuery } from '@/hooks/questBundleQuery'

export type QuestCompletionMeta = {
  isCompletedByMe: boolean
  completionsCount: number
}

const EMPTY: QuestCompletionMeta = { isCompletedByMe: false, completionsCount: 0 }

export function useQuestCompletionMeta(
  questId: string | undefined,
  questNumericId: number | undefined,
): QuestCompletionMeta {
  const { data } = useQuestBundleQuery(questId)
  const meta = data && (questNumericId == null || data.id === questNumericId) ? data : undefined
  if (!meta) return EMPTY
  return { isCompletedByMe: meta.is_completed_by_me ?? false, completionsCount: meta.completions_count ?? 0 }
}

export default useQuestCompletionMeta
