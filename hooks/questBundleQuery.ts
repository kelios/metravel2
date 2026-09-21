import { useQuery, type QueryFunctionContext } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { waitForQuestsCatalogCredentials } from '@/api/questsCatalogInvalidation'
import { QUESTS_LIST_GC_TIME, QUESTS_LIST_STALE_TIME } from '@/hooks/questsListCachePolicy'

/** One raw bundle for the route, breadcrumbs and rating/completion/pioneer. */
export function questBundleQueryOptions(questId: string | null | undefined) {
  return {
    queryKey: queryKeys.questBundle(questId),
    queryFn: async ({ client, signal }: QueryFunctionContext) => {
      await waitForQuestsCatalogCredentials(client, signal)
      const { fetchQuestByQuestId } = await import('@/api/quests')
      return fetchQuestByQuestId(questId!, { persistOffline: false, signal })
    },
    enabled: Boolean(questId),
    // The API reads the durable bundle itself when transport is unavailable.
    networkMode: 'always',
    staleTime: QUESTS_LIST_STALE_TIME,
    gcTime: QUESTS_LIST_GC_TIME,
    retry: false,
  } as const
}

export function useQuestBundleQuery(questId: string | undefined) {
  return useQuery(questBundleQueryOptions(questId))
}
