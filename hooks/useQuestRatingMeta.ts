// Metadata shares the route's single-quest bundle, never the full catalog.
import { useQuestBundleQuery } from '@/hooks/questBundleQuery'

export type QuestRatingMeta = {
  ratingAvg: number | null
  ratingCount: number
}

const EMPTY: QuestRatingMeta = { ratingAvg: null, ratingCount: 0 }

export function useQuestRatingMeta(
  questId: string | undefined,
  questNumericId: number | undefined,
): QuestRatingMeta {
  const { data } = useQuestBundleQuery(questId)
  const meta = data && (questNumericId == null || data.id === questNumericId) ? data : undefined
  if (!meta) return EMPTY
  return { ratingAvg: meta.rating_avg ?? null, ratingCount: meta.rating_count ?? 0 }
}

export default useQuestRatingMeta
