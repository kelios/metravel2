/**
 * Карточка страницы, с которой открыт ассистент (#2897): экран показывает её заголовок и примеры вопросов
 * под контекст. Карточки под вопрос подбирает только служба `/ai/ask`; клиентского подбора по словам нет
 * (#3297) — здесь остались построители карточки статьи и квеста из ответа API. Строку фактов они собирают
 * тем же `sourceFacts.ts`, что служба и слепок обучения: тест сверяет строки (`sourceFacts.test.ts`).
 */

import { getActiveQueryClient } from '@/api/activeQueryClient'
import { queryKeys } from '@/api/queryKeys'
import { fetchQuestsCompactCatalog, type ApiQuestMeta } from '@/api/quests'
import { fetchTravel } from '@/api/travelDetailsQueries'
import { QUESTS_LIST_GC_TIME, QUESTS_LIST_STALE_TIME } from '@/hooks/questsListCachePolicy'
import { useAuthStore } from '@/stores/authStore'
import type { Travel } from '@/types/types'
import { enabledQuestTags } from '@/utils/questTags'
import { buildQuestPath, buildTravelPathFromTravel } from '@/utils/routePaths'
import { buildCanonicalUrl } from '@/utils/seo'

import { questFactsLine, questFactsOf, travelFactsLine, travelFactsOf } from './sourceFacts'
import type { AiSourceRef } from './sourceRef'
import type { AiSource } from './types'

const SNIPPET_MAX_LENGTH = 320

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

export const travelToSource = (travel: Travel): AiSource | null => {
  const path = buildTravelPathFromTravel(travel)
  const title = String(travel?.name ?? '').trim()
  if (!path || !title) return null
  const body = htmlToSnippet(travel.description)
  // Строка фактов (#3287) — тем же построителем, что у службы и слепка обучения: страна, число дней, месяцы.
  // `cityName` статьи — подпись первой точки маршрута, в строку фактов она не идёт (#3347).
  // Список статей отдаёт `month` номерами (`[6, 7, 8]`), в типе `Travel` его нет.
  const facts = travelFactsOf(Number(travel.id), { number_days: travel.number_days, month: (travel as { month?: unknown }).month })
  const snippet = joinParts([travelFactsLine(facts, { country: travel.countryName }), body])
  return {
    type: 'travel',
    source_id: String(travel.id),
    title,
    url: buildCanonicalUrl(path),
    path,
    snippet,
    // Балл ставит подбор службы; карточке страницы-источника он не нужен.
    score: 0,
    // Город статьи в каталоге — точка маршрута, а не город; месту карточки служит только страна (#3315).
    place: { countries: [travel.countryName] },
    // Запись фактов — для проверки условий вопроса (#3289, `arrangeSources`).
    facts,
  }
}

export const questToSource = (quest: ApiQuestMeta): AiSource | null => {
  const path = buildQuestPath(quest.city_alias || quest.city_id, quest.quest_id)
  const title = String(quest?.title ?? '').trim()
  if (!path || !title) return null
  const city = String(quest.city_name_localized || quest.city_name || '').trim()
  const country = String(quest.country_name ?? '').trim()
  // Строка фактов (#3276, #3287): вид квеста, возраст и «Со взрослым» по тегам каталога, число точек,
  // длительность, сложность, «Можно с собакой». Тот же построитель у службы `/ai/ask` и слепка обучения.
  const facts = questFactsOf(Number(quest.id), {
    points: quest.points,
    duration_min: quest.duration_min,
    difficulty: quest.difficulty,
    pet_friendly: quest.pet_friendly,
    tags: enabledQuestTags(quest.tags),
  })
  const snippet = questFactsLine(facts, { city, country })
  return {
    type: 'quest',
    source_id: quest.quest_id,
    title,
    url: buildCanonicalUrl(path),
    path,
    snippet,
    score: 0,
    place: { cities: [quest.city_name_localized, quest.city_name, quest.city_name_canonical], countries: [country] },
    facts,
  }
}

/**
 * Компактный каталог квестов — из того же кэша React Query, что у
 * `useQuestsCompactCatalog` (`hooks/useQuestCityCollection.ts`): посетитель,
 * уже открывавший `/quests`, не тянет каталог заново, и свежесть у экранов и
 * ассистента одна. Без смонтированного клиента (тесты, ранний boot) — прямой
 * запрос.
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

/**
 * Карточка страницы, с которой открыт ассистент (#2897): статья — из того же кэша
 * React Query, что у экрана статьи (`queryKeys.travel(id)`, посетитель пришёл
 * оттуда и повторного запроса обычно нет), квест — из компактного каталога по
 * числовому `id` (бандл ради заголовка и длительности не нужен). Нет материала
 * (404, снят с публикации) — `null`: диалог идёт без закреплённой карточки.
 */
export async function loadSourceCard(ref: AiSourceRef, locale: string, signal?: AbortSignal): Promise<AiSource | null> {
  try {
    if (ref.type === 'travel') {
      const client = getActiveQueryClient()
      const travel = client
        ? await client.fetchQuery<Travel>({ queryKey: queryKeys.travel(ref.id), queryFn: ({ signal: querySignal }) => fetchTravel(ref.id, { signal: querySignal }) })
        : await fetchTravel(ref.id, signal ? { signal } : undefined)
      return travel ? travelToSource(travel) : null
    }
    const quest = (await loadQuestCatalog(locale)).find((item) => Number(item.id) === ref.id)
    return quest ? questToSource(quest) : null
  } catch {
    return null
  }
}
