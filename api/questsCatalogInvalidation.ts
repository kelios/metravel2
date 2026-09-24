import type { QueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import type { ApiQuestBundle, ApiQuestMeta } from '@/api/quests'

type CatalogQuestWithoutIdentity = Omit<ApiQuestMeta, 'is_completed_by_me' | 'user_rating'> &
  Partial<Pick<ApiQuestMeta, 'is_completed_by_me' | 'user_rating'>>

const catalogFilter = { queryKey: queryKeys.quests(), exact: true } as const
const bundlesFilter = { queryKey: queryKeys.questBundles() } as const
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
  const cancelled = Promise.all([client.cancelQueries(catalogFilter), client.cancelQueries(bundlesFilter)])
  client.setQueryData<CatalogQuestWithoutIdentity[]>(catalogFilter.queryKey, (quests) => quests?.map((quest) => {
    const publicQuest = { ...quest }
    delete publicQuest.is_completed_by_me
    delete publicQuest.user_rating
    return publicQuest
  }))
  client.setQueriesData<ApiQuestBundle>(bundlesFilter, (bundle) => {
    if (!bundle) return bundle
    const publicBundle = { ...bundle }
    delete publicBundle.is_completed_by_me
    delete publicBundle.user_rating
    return publicBundle
  })
  void client.invalidateQueries({ ...catalogFilter, refetchType: 'none' })
  void client.invalidateQueries({ ...bundlesFilter, refetchType: 'none' })
  return Promise.all([cancelled, credentialsReady]).then(async () => {
    if (!isCurrentIdentity()) return
    if (credentialBarriers.get(client) === credentialsReady) credentialBarriers.delete(client)
    await Promise.all([
      client.refetchQueries({ ...catalogFilter, type: 'active' }, { cancelRefetch: false }),
      client.refetchQueries({ ...bundlesFilter, type: 'active' }, { cancelRefetch: false }),
    ])
  })
}

export function refreshQuestsCatalogCompletion(client: QueryClient, questId: string): Promise<void> {
  const quests = client.getQueryData<ApiQuestMeta[]>(catalogFilter.queryKey)
  const bundleKey = queryKeys.questBundle(questId)
  const bundle = client.getQueryData<ApiQuestBundle>(bundleKey)
  if (bundle?.is_completed_by_me || quests?.find((quest) => quest.quest_id === questId)?.is_completed_by_me) return Promise.resolve()
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
  void client.cancelQueries({ queryKey: bundleKey, exact: true })
  client.setQueryData<ApiQuestBundle>(bundleKey, (current) => current ? { ...current, is_completed_by_me: true } : current)
  const refreshed = Promise.all([
    client.invalidateQueries(catalogFilter),
    client.invalidateQueries({ queryKey: bundleKey, exact: true }),
  ]).then(() => undefined).finally(() => pending.delete(questId))
  pending.set(questId, refreshed)
  return refreshed
}

// Снимается только стоящая отметка. Кэш без неё чинить нечего, а отмена его
// первой загрузки откатывает запрос в pending без повтора — экран квеста или
// каталога остался бы в вечной загрузке. Сброс зовёт и очередь, в том числе на
// старте приложения, пока бандл ещё грузится (#2033).
export function resetQuestsCatalogCompletion(client: QueryClient, questId: string): void {
  const bundleKey = queryKeys.questBundle(questId)
  if (client.getQueryData<ApiQuestBundle>(bundleKey)?.is_completed_by_me) {
    void client.cancelQueries({ queryKey: bundleKey, exact: true })
    client.setQueryData<ApiQuestBundle>(bundleKey, (bundle) => bundle ? { ...bundle, is_completed_by_me: false } : bundle)
  }
  const quests = client.getQueryData<ApiQuestMeta[]>(catalogFilter.queryKey)
  if (quests?.some((quest) => quest.quest_id === questId && quest.is_completed_by_me)) {
    void client.cancelQueries(catalogFilter)
    client.setQueryData<ApiQuestMeta[]>(catalogFilter.queryKey, (current) => current?.map((quest) => (
      quest.quest_id === questId ? { ...quest, is_completed_by_me: false } : quest
    )))
  }
}

// `completions_count` считает сервер, и удалённая строка прохождения его
// уменьшила: локально число не выводится — каталог и бандл перечитываются, как
// после отметки «Пройден». Каталог со снятой отметкой и прежним числом записал
// бы квест в «Пройденные другими» (#2092).
export function refreshQuestCompletionsCount(client: QueryClient, questId: string): Promise<void> {
  return Promise.all([
    client.invalidateQueries(catalogFilter),
    client.invalidateQueries({ queryKey: queryKeys.questBundle(questId), exact: true }),
  ]).then(() => undefined)
}
