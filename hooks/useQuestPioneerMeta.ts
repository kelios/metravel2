// Metadata shares the route's single-quest bundle, never the full catalog.
import { useQuestBundleQuery } from '@/hooks/questBundleQuery'

export type QuestPioneer = { id: number; name: string; avatar: string | null }

export function useQuestPioneerMeta(
  questId: string | undefined,
  questNumericId: number | undefined,
): QuestPioneer | null {
  const { data } = useQuestBundleQuery(questId)
  const meta = data && (questNumericId == null || data.id === questNumericId) ? data : undefined
  return meta?.first_completer ?? null
}

export default useQuestPioneerMeta
