// Петля возврата после финиша квеста (#1484): коллекция города и подбор
// следующего квеста. Чистые селекторы поверх каталога `QuestMeta[]` — сеть,
// React и хранилище сюда не заходят, поэтому логика проверяется юнит-тестами.

import { calculateDistance } from '@/utils/distanceCalculator'
import { createCollator } from '@/i18n/format'
import { filterQuestsByCompletion } from '@/utils/questCatalogSelection'
import type { QuestMeta } from '@/utils/questAdapters'
import {
  buildCanonicalQuestCityIndex,
  resolveCanonicalQuestCityId,
  type CanonicalQuestCityIndex,
} from '@/utils/questCityCanonical'
import { resolveQuestCitySegment } from '@/utils/questCityAlias'

/**
 * Радиус, в котором квест соседнего города ещё считается «рядом», км.
 * Нужен только как запасной вариант: в городах с единственным квестом блок
 * «следующий шаг» иначе оставался бы пустым.
 */
export const NEXT_QUEST_RADIUS_KM = 60

/** Сколько квестов показываем в блоке следующего шага. */
export const NEXT_QUEST_LIMIT = 3

/** Сколько пройденных квестов показывает профиль до «Показать все» (#1794). */
export const PROFILE_COMPLETED_QUESTS_LIMIT = 4

/**
 * Пройденные квесты в порядке для показа человеку: по городу, внутри города по
 * названию. Времени прохождения в каталоге нет, а порядок id — это порядок
 * заведения квестов в базе, то есть для истории игрока произвольный.
 */
export function selectCompletedQuests(quests: QuestMeta[]): QuestMeta[] {
  const collator = createCollator()
  return filterQuestsByCompletion(quests, true).sort(
    (a, b) =>
      collator.compare(a.cityName ?? '', b.cityName ?? '') || collator.compare(a.title ?? '', b.title ?? ''),
  )
}

export type QuestCityCollection = {
  cityId: string
  cityName?: string
  completedCount: number
  totalCount: number
  /** Доля закрытой коллекции, 0..1. */
  ratio: number
}

export type QuestSuggestion = {
  quest: QuestMeta
  /** Расстояние от только что пройденного квеста, км. `null` — координат нет. */
  distanceKm: number | null
  /** Квест другого города, попавший в радиус. */
  otherCity: boolean
}

export type QuestOrigin = { lat: number; lng: number }

const cityKey = (cityId: unknown): string => String(cityId ?? '').trim()

/**
 * Канонический id города для сегмента, пришедшего из URL квеста.
 *
 * Порядок: собственный `city_id` каталога → общий с SSG алиас-контракт
 * (`utils/questCityAlias.js`, он же разбирает `/quests/minsk/...` на
 * city-landing) → имя города из бандла квеста. Алиас идёт раньше имени
 * намеренно: это единый контракт сервера и клиента, а `city_name` в каталоге
 * бывает пустым — на таком городе полоса коллекции пропала бы снова и молча.
 */
function resolveCityIdForSegment(
  quests: QuestMeta[],
  index: CanonicalQuestCityIndex<QuestMeta>,
  cityId: string,
  cityName?: string | null,
): string {
  const byId = cityId ? index.canonicalCityIdById[cityId] : undefined
  if (byId) return byId

  const viaAlias = cityId ? resolveQuestCitySegment(cityId, quests)?.cityId : null
  if (viaAlias) return index.canonicalCityIdById[viaAlias] ?? viaAlias

  return resolveCanonicalQuestCityId(index, cityId, cityName)
}

const hasCoords = (quest: QuestMeta): boolean =>
  Number.isFinite(quest.lat) && Number.isFinite(quest.lng)

const isValidOrigin = (origin?: QuestOrigin | null): origin is QuestOrigin =>
  !!origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)

/**
 * Прохождение засчитано.
 *
 * `completedQuestId` — квест, только что закрытый в этой сессии: серверный
 * `is_completed_by_me` в кэше каталога про него ещё не знает, а у гостя его не
 * будет вовсе (аннотация требует авторизации). Без этой поправки игрок сразу
 * после финиша видел бы «Пройдено 0 из 6».
 */
function isCompleted(quest: QuestMeta, completedQuestId?: string | null): boolean {
  if (quest.isCompletedByMe) return true
  const justFinished = String(completedQuestId ?? '').trim()
  return !!justFinished && quest.id === justFinished
}

/** Прогресс коллекции одного города или `null`, если квестов города нет в каталоге. */
export function buildQuestCityCollection(
  quests: QuestMeta[],
  options: { cityId: unknown; cityName?: string | null; completedQuestId?: string | null },
): QuestCityCollection | null {
  const cityId = cityKey(options.cityId)
  if (!cityId) return null

  const index = buildCanonicalQuestCityIndex(quests)
  const canonicalCityId = resolveCityIdForSegment(quests, index, cityId, options.cityName)
  const cityQuests = index.questsByCityId[canonicalCityId] ?? []
  if (!cityQuests.length) return null

  const completedCount = cityQuests.filter((quest) =>
    isCompleted(quest, options.completedQuestId),
  ).length

  return {
    cityId: canonicalCityId,
    cityName: options.cityName?.trim() || cityQuests.find((q) => q.cityName)?.cityName,
    completedCount,
    totalCount: cityQuests.length,
    ratio: cityQuests.length ? completedCount / cityQuests.length : 0,
  }
}

/**
 * Коллекции всех городов, где у игрока есть хотя бы одно прохождение, —
 * для профиля. Города без прохождений не показываем: там нечего «закрывать»,
 * а весь каталог в профиле превратился бы в список из десятков нулевых полос.
 */
export function buildQuestCityCollections(
  quests: QuestMeta[],
  options?: { completedQuestId?: string | null },
): QuestCityCollection[] {
  const { questsByCityId } = buildCanonicalQuestCityIndex(quests)

  const collections: QuestCityCollection[] = []
  for (const [cityId, cityQuests] of Object.entries(questsByCityId)) {
    const collection = buildQuestCityCollection(cityQuests, {
      cityId,
      completedQuestId: options?.completedQuestId,
    })
    if (collection && collection.completedCount > 0) collections.push(collection)
  }

  // Сначала почти закрытые коллекции: их и хочется дозакрыть.
  const collator = createCollator()
  return collections.sort(
    (a, b) =>
      b.ratio - a.ratio ||
      b.completedCount - a.completedCount ||
      collator.compare(a.cityName ?? '', b.cityName ?? ''),
  )
}

/**
 * Следующие квесты: сначала непройденные в том же городе (ближние первыми),
 * затем — если своих не хватило — непройденные в радиусе {@link NEXT_QUEST_RADIUS_KM}.
 */
export function pickNextQuests(
  quests: QuestMeta[],
  options: {
    currentQuestId?: string | null
    cityId?: unknown
    /** Имя города из бандла квеста: сцепка, когда `cityId` — алиас из URL. */
    cityName?: string | null
    origin?: QuestOrigin | null
    limit?: number
    radiusKm?: number
  },
): QuestSuggestion[] {
  const currentId = String(options.currentQuestId ?? '').trim()
  const cityId = cityKey(options.cityId)
  const index = buildCanonicalQuestCityIndex(quests)
  const canonicalCityId = resolveCityIdForSegment(quests, index, cityId, options.cityName)
  const origin = isValidOrigin(options.origin) ? options.origin : null
  const radiusKm = options.radiusKm ?? NEXT_QUEST_RADIUS_KM
  const limit = options.limit ?? NEXT_QUEST_LIMIT

  const suggestions: QuestSuggestion[] = []
  for (const quest of quests) {
    if (currentId && quest.id === currentId) continue
    if (isCompleted(quest, currentId)) continue

    const questCityId = cityKey(quest.cityId)
    const otherCity =
      !canonicalCityId || (index.canonicalCityIdById[questCityId] ?? questCityId) !== canonicalCityId
    const distanceKm =
      origin && hasCoords(quest)
        ? calculateDistance(origin, { lat: quest.lat, lng: quest.lng })
        : null

    // Чужой город берём только с известным расстоянием и только из радиуса:
    // «следующий квест рядом» не должен предлагать другой конец страны.
    if (otherCity && (distanceKm === null || distanceKm > radiusKm)) continue

    suggestions.push({ quest, distanceKm, otherCity })
  }

  suggestions.sort(
    (a, b) =>
      Number(a.otherCity) - Number(b.otherCity) ||
      (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY) ||
      a.quest.id.localeCompare(b.quest.id),
  )

  return suggestions.slice(0, Math.max(0, limit))
}
