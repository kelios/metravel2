/**
 * Подбор карточек сайта под вопрос (#2460).
 *
 * Оценка модели v0 (#2462): ответы по форме держит, но ССЫЛКИ И НАЗВАНИЯ
 * ВЫДУМЫВАЕТ (57 несуществующих URL в 40 ответах). Поэтому ссылки даёт только
 * подбор: статьи — поиском бэкенда `/api/travels/?search=`, квесты — по
 * каталогу (у `/api/quests/` поиска нет, каталог компактный и кэшируется);
 * модель лишь формулирует ответ по подставленным карточкам. Смысловой индекс
 * (#2454/#2456) заменит этот слой тем же контрактом `AiSource[]`.
 */

import { getActiveQueryClient } from '@/api/activeQueryClient'
import { queryKeys } from '@/api/queryKeys'
import { fetchQuestsCompactCatalog, type ApiQuestMeta } from '@/api/quests'
import { fetchTravels } from '@/api/travelListQueries'
import { QUESTS_LIST_GC_TIME, QUESTS_LIST_STALE_TIME } from '@/hooks/questsListCachePolicy'
import { useAuthStore } from '@/stores/authStore'
import type { Travel } from '@/types/types'
import { buildQuestPath, buildTravelPathFromTravel } from '@/utils/routePaths'
import { buildCanonicalUrl } from '@/utils/seo'

import type { AiSource } from './types'

export const AI_SOURCES_LIMIT = 8
const TRAVELS_PAGE_SIZE = 8
const SNIPPET_MAX_LENGTH = 320
const MIN_TOKEN_LENGTH = 3

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Слова вопроса длиной от трёх знаков, без повторов; порядок сохраняется. */
export const tokenizeQuery = (query: string): string[] => {
  const seen = new Set<string>()
  const tokens: string[] = []
  for (const token of normalizeText(query).split(' ')) {
    if (token.length < MIN_TOKEN_LENGTH || seen.has(token)) continue
    seen.add(token)
    tokens.push(token)
  }
  return tokens
}

/**
 * Грубый стем для славянских окончаний: у слова длиннее пяти знаков отрезаем
 * два последних («Гродно» ≈ «Гродне», «квесты» ≈ «квест»). Этого хватает для
 * подбора по названию и городу; полноценный поиск — задача индекса (#2454).
 */
const stemToken = (token: string): string => (token.length > 5 ? token.slice(0, -2) : token)

/** Сколько слов вопроса встречается в тексте карточки. */
export const scoreText = (haystack: string, tokens: readonly string[]): number => {
  if (!tokens.length) return 0
  const normalized = normalizeText(haystack)
  if (!normalized) return 0
  let score = 0
  for (const token of tokens) {
    if (normalized.includes(stemToken(token))) score += 1
  }
  return score
}

/** HTML описания → один абзац данных для промпта. Без i18n-фолбэка и DOMPurify. */
export const htmlToSnippet = (html: unknown, maxLength = SNIPPET_MAX_LENGTH): string => {
  const text = String(html ?? '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= maxLength) return text
  const cut = text.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(' ')
  return `${lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut}…`
}

const joinParts = (parts: Array<string | null | undefined>): string =>
  parts.map((part) => String(part ?? '').trim()).filter(Boolean).join('. ')

export const travelToSource = (travel: Travel, tokens: readonly string[]): AiSource | null => {
  const path = buildTravelPathFromTravel(travel)
  const title = String(travel?.name ?? '').trim()
  if (!path || !title) return null
  const place = [travel.countryName, travel.cityName].map((v) => String(v ?? '').trim()).filter(Boolean).join(', ')
  const snippet = joinParts([place, htmlToSnippet(travel.description)])
  // Бэкенд уже отобрал статью по вопросу — базовый балл 1, совпадения слов сверху.
  const score = 1 + scoreText(`${title} ${place} ${snippet}`, tokens)
  return {
    type: 'travel',
    source_id: String(travel.id),
    title,
    url: buildCanonicalUrl(path),
    path,
    snippet,
    score,
  }
}

const DIFFICULTY_RU: Record<string, string> = { easy: 'лёгкий', medium: 'средний', hard: 'сложный' }

export const questToSource = (quest: ApiQuestMeta, tokens: readonly string[]): AiSource | null => {
  const path = buildQuestPath(quest.city_alias || quest.city_id, quest.quest_id)
  const title = String(quest?.title ?? '').trim()
  if (!path || !title) return null
  const city = String(quest.city_name_localized || quest.city_name || '').trim()
  const country = String(quest.country_name ?? '').trim()
  const score = scoreText(
    [title, city, quest.city_name, quest.city_name_canonical, country].filter(Boolean).join(' '),
    tokens,
  )
  if (score <= 0) return null
  const points = Number.parseInt(String(quest.points), 10)
  const difficulty = quest.difficulty ? DIFFICULTY_RU[quest.difficulty] : ''
  const snippet = joinParts([
    `Городской квест${city ? ` по городу ${city}` : ''}${country ? ` (${country})` : ''}`,
    Number.isFinite(points) && points > 0 ? `Точек: ${points}` : '',
    quest.duration_min ? `Длительность: ${quest.duration_min} мин` : '',
    difficulty ? `Сложность: ${difficulty}` : '',
  ])
  return {
    type: 'quest',
    source_id: quest.quest_id,
    title,
    url: buildCanonicalUrl(path),
    path,
    snippet,
    score,
  }
}

/** Слияние: по убыванию балла, при равенстве статьи раньше квестов; без дублей URL. */
export const mergeSources = (sources: readonly AiSource[], limit = AI_SOURCES_LIMIT): AiSource[] => {
  const ranked = [...sources].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.type !== b.type) return a.type === 'travel' ? -1 : 1
    return 0
  })
  const seen = new Set<string>()
  const result: AiSource[] = []
  for (const source of ranked) {
    if (seen.has(source.url)) continue
    seen.add(source.url)
    result.push(source)
    if (result.length >= limit) break
  }
  return result
}

/**
 * Компактный каталог квестов — из того же кэша React Query, что у
 * `useQuestsCompactCatalog` (`hooks/useQuestCityCollection.ts`): посетитель,
 * уже открывавший `/quests`, не тянет каталог заново, и свежесть у экранов и
 * ассистента одна. Без смонтированного клиента (тесты, ранний boot) — прямой
 * запрос. Сигнал одного вопроса каталог не отменяет: его переиспользуют
 * следующие вопросы.
 */
const loadQuestCatalog = (locale: string): Promise<ApiQuestMeta[]> => {
  const client = getActiveQueryClient()
  if (!client) return fetchQuestsCompactCatalog({ locale })
  const userId = useAuthStore.getState().userId
  const identity = userId == null ? null : String(userId)
  return client.fetchQuery<ApiQuestMeta[]>({
    queryKey: queryKeys.questsCompactCatalog(identity, locale),
    queryFn: ({ signal }) => fetchQuestsCompactCatalog({ signal, locale }),
    staleTime: QUESTS_LIST_STALE_TIME,
    gcTime: QUESTS_LIST_GC_TIME,
  })
}

export type SearchSiteMaterialsOptions = {
  query: string
  locale: string
  signal?: AbortSignal
  limit?: number
}

/**
 * Карточки под вопрос. Ошибка одного источника не роняет подбор: статьи и квесты
 * запрашиваются независимо, пустой результат — честный «материалов нет».
 */
export async function searchSiteMaterials({
  query,
  locale,
  signal,
  limit = AI_SOURCES_LIMIT,
}: SearchSiteMaterialsOptions): Promise<AiSource[]> {
  const tokens = tokenizeQuery(query)
  const [travelsResult, questsResult] = await Promise.allSettled([
    fetchTravels(1, TRAVELS_PAGE_SIZE, query.trim(), {}, signal ? { signal } : undefined),
    loadQuestCatalog(locale),
  ])

  const candidates: AiSource[] = []
  if (travelsResult.status === 'fulfilled') {
    for (const travel of travelsResult.value?.data ?? []) {
      const source = travelToSource(travel, tokens)
      if (source) candidates.push(source)
    }
  }
  if (questsResult.status === 'fulfilled') {
    for (const quest of questsResult.value ?? []) {
      const source = questToSource(quest, tokens)
      if (source) candidates.push(source)
    }
  }
  return mergeSources(candidates, limit)
}
