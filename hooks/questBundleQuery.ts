import { useQuery, type QueryFunctionContext } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import { getQuestContentLocale } from '@/api/questContentLocale'
import { waitForQuestsCatalogCredentials } from '@/api/questsCatalogInvalidation'
import { QUESTS_LIST_GC_TIME, QUESTS_LIST_STALE_TIME } from '@/hooks/questsListCachePolicy'
import { useQuestContentLocale } from '@/hooks/useQuestContentLocale'

/**
 * One raw bundle for the route, breadcrumbs and rating/completion/pioneer.
 * The key and the request share one `locale` (#2197): the key cannot hold one
 * language while the request asks for another.
 */
export function questBundleQueryOptions(
  questId: string | null | undefined,
  locale: string = getQuestContentLocale(),
) {
  return {
    queryKey: queryKeys.questBundle(questId, locale),
    queryFn: async ({ client, signal }: QueryFunctionContext) => {
      await waitForQuestsCatalogCredentials(client, signal)
      const { fetchQuestByQuestId } = await import('@/api/quests')
      return fetchQuestByQuestId(questId!, { persistOffline: false, signal, locale })
    },
    enabled: Boolean(questId),
    // The API reads the durable bundle itself when transport is unavailable.
    networkMode: 'always',
    staleTime: QUESTS_LIST_STALE_TIME,
    gcTime: QUESTS_LIST_GC_TIME,
    retry: false,
  } as const
}

export function useQuestBundleQuery(questId: string | undefined, routeLocale?: string) {
  const activeLocale = useQuestContentLocale()
  return useQuery(questBundleQueryOptions(questId, routeLocale ?? activeLocale))
}
