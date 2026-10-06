// #2197: каталог и бандл лежат под ключом на каждую локаль контента. Отметка
// «Пройден», её сброс, число прохождений и смена identity обязаны дойти до копий
// на ВСЕХ языках — иначе после переключения языка всплывёт устаревший статус.
import { QueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/api/queryKeys'
import type { ApiQuestBundle, ApiQuestMeta } from '@/api/quests'
import {
  refreshQuestCompletionsCount,
  refreshQuestsCatalogCompletion,
  refreshQuestsCatalogIdentity,
  resetQuestsCatalogCompletion,
} from '@/api/questsCatalogInvalidation'

const LOCALES = ['ru', 'pl']
const QUEST = 'krakow-dragon'

const catalog = (mark: boolean) =>
  [{ quest_id: QUEST, title: 'q', is_completed_by_me: mark, user_rating: 4 }] as unknown as ApiQuestMeta[]
const bundle = (mark: boolean) =>
  ({ id: 1, quest_id: QUEST, title: 'q', is_completed_by_me: mark, user_rating: 4 }) as unknown as ApiQuestBundle

describe('quest catalog invalidation spans every content locale', () => {
  let client: QueryClient

  const seed = (mark: boolean) => {
    for (const locale of LOCALES) {
      client.setQueryData(queryKeys.questsCatalog(locale), catalog(mark))
      client.setQueryData(queryKeys.questBundle(QUEST, locale), bundle(mark))
    }
  }
  const catalogMarks = () =>
    LOCALES.map((locale) => client.getQueryData<ApiQuestMeta[]>(queryKeys.questsCatalog(locale))?.[0]?.is_completed_by_me)
  const bundleMarks = () =>
    LOCALES.map((locale) => client.getQueryData<ApiQuestBundle>(queryKeys.questBundle(QUEST, locale))?.is_completed_by_me)

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  })
  afterEach(() => client.clear())

  it('marks completion in every locale copy, including one marked only in another language', async () => {
    seed(false)
    client.setQueryData(queryKeys.questBundle(QUEST, 'ru'), bundle(true))

    await refreshQuestsCatalogCompletion(client, QUEST)

    expect(catalogMarks()).toEqual([true, true])
    expect(bundleMarks()).toEqual([true, true])
    for (const locale of LOCALES) {
      expect(client.getQueryState(queryKeys.questsCatalog(locale))?.isInvalidated).toBe(true)
      expect(client.getQueryState(queryKeys.questBundle(QUEST, locale))?.isInvalidated).toBe(true)
    }
  })

  it('does nothing when every locale copy is already marked', async () => {
    seed(true)
    await refreshQuestsCatalogCompletion(client, QUEST)
    expect(client.getQueryState(queryKeys.questsCatalog('pl'))?.isInvalidated).toBe(false)
  })

  it('reset drops the mark in every locale copy', () => {
    seed(true)
    resetQuestsCatalogCompletion(client, QUEST)
    expect(catalogMarks()).toEqual([false, false])
    expect(bundleMarks()).toEqual([false, false])
  })

  it('completions_count refresh invalidates every locale copy but not neighbouring slices', async () => {
    seed(false)
    client.setQueryData(queryKeys.questsPreview(2, 'ru'), catalog(false))
    client.setQueryData(queryKeys.questBundle('other-quest', 'pl'), bundle(false))

    await refreshQuestCompletionsCount(client, QUEST)

    for (const locale of LOCALES) {
      expect(client.getQueryState(queryKeys.questsCatalog(locale))?.isInvalidated).toBe(true)
      expect(client.getQueryState(queryKeys.questBundle(QUEST, locale))?.isInvalidated).toBe(true)
    }
    expect(client.getQueryState(queryKeys.questsPreview(2, 'ru'))?.isInvalidated).toBe(false)
    expect(client.getQueryState(queryKeys.questBundle('other-quest', 'pl'))?.isInvalidated).toBe(false)
  })

  it('identity change scrubs personal fields from every locale copy', async () => {
    seed(true)
    await refreshQuestsCatalogIdentity(client, () => true)
    for (const locale of LOCALES) {
      expect(client.getQueryData<ApiQuestMeta[]>(queryKeys.questsCatalog(locale))?.[0]).not.toHaveProperty('is_completed_by_me')
      expect(client.getQueryData<ApiQuestBundle>(queryKeys.questBundle(QUEST, locale))).not.toHaveProperty('user_rating')
    }
  })
})
