// Петля возврата после финиша квеста (#1484): коллекция города и подбор
// следующего квеста. Чистые селекторы поверх каталога `QuestMeta[]` — сеть,
// React и хранилище сюда не заходят, поэтому логика проверяется юнит-тестами.

import { calculateDistance } from '@/utils/distanceCalculator'
import { createCollator } from '@/i18n/format'
import type { QuestMeta } from '@/utils/questAdapters'
import { buildCanonicalQuestCityIndex } from '@/utils/questCityCanonical'

/**
 * Радиус, в котором квест соседнего города ещё считается «рядом», км.
 * Нужен только как запасной вариант: в городах с единственным квестом блок
 * «следующий шаг» иначе оставался бы пустым.
 */
export const NEXT_QUEST_RADIUS_KM = 60

/** Сколько квестов показываем в блоке следующего шага. */
export const NEXT_QUEST_LIMIT = 3

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

  const { canonicalCityIdById, questsByCityId } = buildCanonicalQuestCityIndex(quests)
  const canonicalCityId = canonicalCityIdById[cityId] ?? cityId
  const cityQuests = questsByCityId[canonicalCityId] ?? []
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
    origin?: QuestOrigin | null
    limit?: number
    radiusKm?: number
  },
): QuestSuggestion[] {
  const currentId = String(options.currentQuestId ?? '').trim()
  const cityId = cityKey(options.cityId)
  const { canonicalCityIdById } = buildCanonicalQuestCityIndex(quests)
  const canonicalCityId = canonicalCityIdById[cityId] ?? cityId
  const origin = isValidOrigin(options.origin) ? options.origin : null
  const radiusKm = options.radiusKm ?? NEXT_QUEST_RADIUS_KM
  const limit = options.limit ?? NEXT_QUEST_LIMIT

  const suggestions: QuestSuggestion[] = []
  for (const quest of quests) {
    if (currentId && quest.id === currentId) continue
    if (isCompleted(quest, currentId)) continue

    const questCityId = cityKey(quest.cityId)
    const otherCity =
      !canonicalCityId || (canonicalCityIdById[questCityId] ?? questCityId) !== canonicalCityId
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
