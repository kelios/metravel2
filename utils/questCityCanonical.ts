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

export function buildCanonicalQuestCityIndex<TQuest extends QuestCityIdentity>(quests: TQuest[]): {
  canonicalCityIdById: Record<string, string>
  questsByCityId: Record<string, TQuest[]>
} {
  const canonicalCityIdByGroup = new Map<string, string>()
  const canonicalCityIdById: Record<string, string> = {}
  const questsByCityId: Record<string, TQuest[]> = {}

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
  }

  return { canonicalCityIdById, questsByCityId }
}
