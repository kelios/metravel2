import type { ApiQuestMeta } from '@/api/quests'
import { buildQuestCityPath, buildQuestPath } from '@/utils/routePaths'

/** Источник события клика по верхней строке; у нижнего блока — `travel_detail`. */
export const TRAVEL_QUEST_TEASER_SOURCE = 'travel_detail_top'

/**
 * Потолок подбора квестов статьи (`utils/travelLinkGraphContract.js`, 6 строк).
 * Полный подбор значит, что в городе квестов может быть больше, чем пришло.
 */
export const TRAVEL_QUEST_MATCH_LIMIT = 6

export type TravelQuestTeaser = {
  cityName: string
  cityId: string
  /** Квестов города: всего по `city_quest_count` (#3327), иначе — в подборе статьи. */
  count: number
  /** `false`, когда подбор заполнен до потолка: точное число квестов города неизвестно. */
  exact: boolean
  href: string
  /** Задан, когда строка ведёт на единственный квест, а не на страницу города. */
  questId?: string
}

/** Поля строки подбора, которые читает верхняя строка (сырой ответ загрузчика). */
export type TravelQuestTeaserRow = Pick<ApiQuestMeta, 'quest_id' | 'city_id' | 'city_name' | 'city_name_localized' | 'city_alias' | 'city_quest_count'>

/**
 * Строка «<Город>: N бесплатных квестов-прогулок» для начала статьи (#3221).
 * Берёт тот же подбор, что и полный блок «Квесты по этому городу и рядом» внизу,
 * поэтому не делает ни одного запроса. Город — у первого, самого близкого квеста.
 *
 * Читает сырые строки подбора, а не `adaptMeta`: модуль адаптеров квестов тяжёлый
 * и живёт в отложенном чанке блока, в первый экран статьи его тянуть нельзя.
 */
export function resolveTravelQuestTeaser(quests: ReadonlyArray<TravelQuestTeaserRow>): TravelQuestTeaser | null {
  const primary = quests[0]
  const cityName = String(primary?.city_name_localized || primary?.city_name || '').trim()
  if (!primary || !cityName) return null

  const cityQuests = quests.filter((quest) => String(quest.city_id) === String(primary.city_id))
  // #3327: подбор ограничен шестью строками, а бэк (#3282) знает число квестов
  // всего города. Число меньше пришедших строк — испорченный ответ, ему не верим.
  const cityTotal = primary.city_quest_count
  const knownTotal = typeof cityTotal === 'number' && Number.isSafeInteger(cityTotal) && cityTotal >= cityQuests.length
    ? cityTotal
    : null
  const count = knownTotal ?? cityQuests.length
  // Квестов в городе больше одного — строка ведёт на страницу города, даже если
  // в подбор попал один из них.
  const cityPath = count > 1 ? buildQuestCityPath(primary.city_alias) : null
  const href = cityPath ?? buildQuestPath(primary.city_id, primary.quest_id)
  if (!href) return null

  return {
    cityName,
    cityId: String(primary.city_id),
    count,
    exact: knownTotal !== null || quests.length < TRAVEL_QUEST_MATCH_LIMIT,
    href,
    ...(cityPath ? null : { questId: String(primary.quest_id) }),
  }
}
