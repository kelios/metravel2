import type { QueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import type { ApiQuestMeta } from '@/api/quests'

type CatalogQuestWithoutIdentity = Omit<ApiQuestMeta, 'is_completed_by_me' | 'user_rating'> &
  Partial<Pick<ApiQuestMeta, 'is_completed_by_me' | 'user_rating'>>

const catalogFilter = { queryKey: queryKeys.quests(), exact: true } as const
const completionRefreshes = new WeakMap<QueryClient, Map<string, Promise<void>>>()
const credentialBarriers = new WeakMap<QueryClient, Promise<void>>()

export function waitForQuestsCatalogCredentials(client: QueryClient, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort)
      const error = new Error('Quest catalog request aborted')
      error.name = 'AbortError'
      reject(error)
    }
    if (signal.aborted) { onAbort(); return }
    const ready = credentialBarriers.get(client)
    if (!ready) { resolve(); return }
    signal.addEventListener('abort', onAbort, { once: true })
    ready.then(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, (error) => {
      signal.removeEventListener('abort', onAbort)
      reject(error)
    })
  })
}

export function refreshQuestsCatalogIdentity(
  client: QueryClient,
  isCurrentIdentity: () => boolean,
  credentialsReady: Promise<void> = Promise.resolve(),
): Promise<void> {
  credentialBarriers.set(client, credentialsReady)
  const cancelled = client.cancelQueries(catalogFilter)
  client.setQueryData<CatalogQuestWithoutIdentity[]>(catalogFilter.queryKey, (quests) => quests?.map((quest) => {
    const publicQuest = { ...quest }
    delete publicQuest.is_completed_by_me
    delete publicQuest.user_rating
    return publicQuest
  }))
  void client.invalidateQueries({ ...catalogFilter, refetchType: 'none' })
  return Promise.all([cancelled, credentialsReady]).then(async () => {
    if (!isCurrentIdentity()) return
    if (credentialBarriers.get(client) === credentialsReady) credentialBarriers.delete(client)
    await client.refetchQueries({ ...catalogFilter, type: 'active' }, { cancelRefetch: false })
  })
}

export function refreshQuestsCatalogCompletion(client: QueryClient, questId: string): Promise<void> {
  const quests = client.getQueryData<ApiQuestMeta[]>(catalogFilter.queryKey)
  if (quests?.find((quest) => quest.quest_id === questId)?.is_completed_by_me) return Promise.resolve()
  let pending = completionRefreshes.get(client)
  if (!pending) {
    pending = new Map()
    completionRefreshes.set(client, pending)
  }
  const existing = pending.get(questId)
  if (existing) return existing

  void client.cancelQueries(catalogFilter)
  client.setQueryData<ApiQuestMeta[]>(catalogFilter.queryKey, (current) => current?.map((quest) => (
    quest.quest_id === questId ? { ...quest, is_completed_by_me: true } : quest
  )))
  const refreshed = client.invalidateQueries(catalogFilter).finally(() => pending.delete(questId))
  pending.set(questId, refreshed)
  return refreshed
}

export function resetQuestsCatalogCompletion(client: QueryClient, questId: string): void {
  void client.cancelQueries(catalogFilter)
  client.setQueryData<ApiQuestMeta[]>(catalogFilter.queryKey, (quests) => quests?.map((quest) => (
    quest.quest_id === questId ? { ...quest, is_completed_by_me: false } : quest
  )))
}
