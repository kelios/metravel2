// Канонизация городов квестов: бэкенд исторически содержит дубли одного города
// под разными id (например Гомель 19/92). Все поверхности каталога и коллекций
// обязаны группировать их одинаково.

export type QuestCityIdentity = {
  cityId?: string | null
  cityName?: string | null
  countryCode?: string | null
}

const normalizeCityName = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\u0451/g, String.fromCodePoint(0x435))
    .replace(/\s+/g, ' ')

export type CanonicalQuestCityIndex<TQuest extends QuestCityIdentity> = {
  canonicalCityIdById: Record<string, string>
  /** Нормализованное имя города → канонический id. Только однозначные имена. */
  canonicalCityIdByName: Record<string, string>
  questsByCityId: Record<string, TQuest[]>
}

export function buildCanonicalQuestCityIndex<TQuest extends QuestCityIdentity>(
  quests: TQuest[],
): CanonicalQuestCityIndex<TQuest> {
  const canonicalCityIdByGroup = new Map<string, string>()
  // Ключи приходят из URL-сегмента и данных бэкенда, поэтому индексы без
  // прототипа: иначе `/quests/constructor/...` доставал бы из lookup функцию
  // Object.prototype и выдавал её за id города.
  const canonicalCityIdById: Record<string, string> = Object.create(null)
  const questsByCityId: Record<string, TQuest[]> = Object.create(null)
  const canonicalIdsByName = new Map<string, Set<string>>()

  for (const quest of quests) {
    const cityId = String(quest.cityId ?? '').trim()
    if (!cityId) continue
    const normalizedName = normalizeCityName(quest.cityName)
    const countryCode = String(quest.countryCode ?? '').trim().toUpperCase()
    const groupKey = normalizedName ? `${countryCode}:${normalizedName}` : `id:${cityId}`
    const canonicalId = canonicalCityIdByGroup.get(groupKey) ?? cityId
    canonicalCityIdByGroup.set(groupKey, canonicalId)
    canonicalCityIdById[cityId] = canonicalId
    ;(questsByCityId[canonicalId] ||= []).push(quest)
    if (normalizedName) {
      const ids = canonicalIdsByName.get(normalizedName) ?? new Set<string>()
      ids.add(canonicalId)
      canonicalIdsByName.set(normalizedName, ids)
    }
  }

  // Одноимённые города разных стран (Брест BY/FR) по имени не разрешаем:
  // молча подставить не тот город хуже, чем не подставить ничего.
  const canonicalCityIdByName: Record<string, string> = Object.create(null)
  for (const [name, ids] of canonicalIdsByName) {
    if (ids.size === 1) canonicalCityIdByName[name] = [...ids][0]
  }

  return { canonicalCityIdById, canonicalCityIdByName, questsByCityId }
}

/**
 * Канонический id города для сегмента, пришедшего снаружи каталога.
 *
 * Маршрут квеста отдаёт `city` как сегмент URL, а он бывает алиасом
 * (`/quests/minsk/...`, см. `utils/questCityAlias.js`) — по нему в каталоге,
 * ключёванном числовым `city_id`, не находится ничего. Имя города из бандла
 * квеста в этом случае и есть точка сцепки.
 */
export function resolveCanonicalQuestCityId<TQuest extends QuestCityIdentity>(
  index: CanonicalQuestCityIndex<TQuest>,
  cityId: unknown,
  cityName?: string | null,
): string {
  const rawId = String(cityId ?? '').trim()
  const byId = rawId ? index.canonicalCityIdById[rawId] : undefined
  if (byId) return byId

  const byName = index.canonicalCityIdByName[normalizeCityName(cityName)]
  if (byName) return byName

  return rawId
}
