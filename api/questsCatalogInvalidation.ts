import type { QueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import type { ApiQuestBundle, ApiQuestMeta } from '@/api/quests'

type CatalogQuestWithoutIdentity = Omit<ApiQuestMeta, 'is_completed_by_me' | 'user_rating'> &
  Partial<Pick<ApiQuestMeta, 'is_completed_by_me' | 'user_rating'>>

// Каталог и бандлы лежат под ключом на каждую локаль контента (#2197): все
// фильтры здесь — префиксы «все локали», иначе после смены языка всплыл бы
// устаревший личный статус из копии на другом языке.
const catalogFilter = { queryKey: queryKeys.questsCatalogAllLocales() } as const
const bundlesFilter = { queryKey: queryKeys.questBundles() } as const
const questBundleFilter = (questId: string) => ({ queryKey: queryKeys.questBundleAllLocales(questId) }) as const
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
  client.setQueriesData<CatalogQuestWithoutIdentity[]>(catalogFilter, (quests) => quests?.map((quest) => {
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

const markCatalogQuest = (questId: string, mark: boolean) => (current: ApiQuestMeta[] | undefined) =>
  current?.map((quest) => (quest.quest_id === questId ? { ...quest, is_completed_by_me: mark } : quest))

const markBundle = (mark: boolean) => (current: ApiQuestBundle | undefined) =>
  current ? { ...current, is_completed_by_me: mark } : current

/** Отметки квеста во всех закэшированных копиях: бандлах и каталогах на любой локали. */
function cachedCompletionMarks(client: QueryClient, questId: string): boolean[] {
  const bundles = client.getQueriesData<ApiQuestBundle>(questBundleFilter(questId))
    .flatMap(([, bundle]) => (bundle ? [Boolean(bundle.is_completed_by_me)] : []))
  const catalogs = client.getQueriesData<ApiQuestMeta[]>(catalogFilter)
    .flatMap(([, quests]) => {
      const quest = quests?.find((item) => item.quest_id === questId)
      return quest ? [Boolean(quest.is_completed_by_me)] : []
    })
  return [...bundles, ...catalogs]
}

export function refreshQuestsCatalogCompletion(client: QueryClient, questId: string): Promise<void> {
  // Повторная отметка ничего не меняет, только если ни одна копия на любой
  // локали её ещё не ждёт.
  const marks = cachedCompletionMarks(client, questId)
  if (marks.length > 0 && marks.every(Boolean)) return Promise.resolve()
  let pending = completionRefreshes.get(client)
  if (!pending) {
    pending = new Map()
    completionRefreshes.set(client, pending)
  }
  const existing = pending.get(questId)
  if (existing) return existing

  void client.cancelQueries(catalogFilter)
  client.setQueriesData<ApiQuestMeta[]>(catalogFilter, markCatalogQuest(questId, true))
  void client.cancelQueries(questBundleFilter(questId))
  client.setQueriesData<ApiQuestBundle>(questBundleFilter(questId), markBundle(true))
  const refreshed = Promise.all([
    client.invalidateQueries(catalogFilter),
    client.invalidateQueries(questBundleFilter(questId)),
  ]).then(() => undefined).finally(() => pending.delete(questId))
  pending.set(questId, refreshed)
  return refreshed
}

// Снимается только стоящая отметка. Кэш без неё чинить нечего, а отмена его
// первой загрузки откатывает запрос в pending без повтора — экран квеста или
// каталога остался бы в вечной загрузке. Сброс зовёт и очередь, в том числе на
// старте приложения, пока бандл ещё грузится (#2033). Копии на разных локалях
// проверяются и чинятся по отдельности (#2197).
export function resetQuestsCatalogCompletion(client: QueryClient, questId: string): void {
  for (const [queryKey, bundle] of client.getQueriesData<ApiQuestBundle>(questBundleFilter(questId))) {
    if (!bundle?.is_completed_by_me) continue
    void client.cancelQueries({ queryKey, exact: true })
    client.setQueryData<ApiQuestBundle>(queryKey, markBundle(false))
  }
  for (const [queryKey, quests] of client.getQueriesData<ApiQuestMeta[]>(catalogFilter)) {
    if (!quests?.some((quest) => quest.quest_id === questId && quest.is_completed_by_me)) continue
    void client.cancelQueries({ queryKey, exact: true })
    client.setQueryData<ApiQuestMeta[]>(queryKey, markCatalogQuest(questId, false))
  }
}

// `completions_count` считает сервер, и удалённая строка прохождения его
// уменьшила: локально число не выводится — каталог и бандл перечитываются, как
// после отметки «Пройден». Каталог со снятой отметкой и прежним числом записал
// бы квест в «Пройденные другими» (#2092).
export function refreshQuestCompletionsCount(client: QueryClient, questId: string): Promise<void> {
  return Promise.all([
    client.invalidateQueries(catalogFilter),
    client.invalidateQueries(questBundleFilter(questId)),
  ]).then(() => undefined)
}
