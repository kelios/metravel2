// #2197: адрес лендинга города не зависит от языка контента. API локализует
// `city_name` по `?lang=` («Kraków»), а alias — латиница русского имени, поэтому
// эвристика читает `city_name_canonical`. Фикстура — все города и квесты прода
// (`__tests__/fixtures/questCitiesLocalized.json`, снимок `?lang=pl`).
import { buildQuestCityAliasMap } from '@/utils/questCityAlias'

import fixture from '../fixtures/questCitiesLocalized.json'

type CityRow = [number, string, string]
type QuestRow = [number, string]

const cities = new Map((fixture.cities as CityRow[]).map(([id, name, canonical]) => [id, { name, canonical }]))
const quests = fixture.quests as QuestRow[]

/** Ответ старого бэкенда: русское имя, канонического поля нет, alias API нет — работает эвристика. */
const russianRecords = () =>
  quests.map(([cityId, questId]) => ({
    city_id: String(cityId),
    quest_id: questId,
    city_name: cities.get(cityId)?.canonical ?? '',
  }))

/** Ответ на другой локали: имя локализовано, русское — в `city_name_canonical`. */
const localizedRecords = (localize: (canonical: string, name: string) => string, withCanonical = true) =>
  quests.map(([cityId, questId]) => {
    const city = cities.get(cityId)
    return {
      city_id: String(cityId),
      quest_id: questId,
      city_name: localize(city?.canonical ?? '', city?.name ?? ''),
      ...(withCanonical ? { city_name_canonical: city?.canonical ?? '' } : {}),
    }
  })

const asObject = (map: Map<string, string>) => Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b)))

// Имя, у которого число слов и длина расходятся с русским: худший случай для
// эвристики, мерящей alias длиной имени (#1931).
const distorted = (canonical: string) => (canonical.includes(' ') ? 'X' : 'Xx Yy Zz Ww')

describe('quest city alias is stable across content locales', () => {
  it('covers every city of the production snapshot', () => {
    expect(cities.size).toBeGreaterThanOrEqual(167)
    expect(quests.length).toBeGreaterThan(0)
    for (const [cityId] of quests) expect(cities.has(cityId)).toBe(true)
  })

  it('gives the same aliases for Russian and real Polish city names', () => {
    expect(asObject(buildQuestCityAliasMap(localizedRecords((_canonical, name) => name)))).toEqual(
      asObject(buildQuestCityAliasMap(russianRecords())),
    )
  })

  it('gives the same aliases when every localized name differs in shape from the Russian one', () => {
    expect(asObject(buildQuestCityAliasMap(localizedRecords(distorted)))).toEqual(
      asObject(buildQuestCityAliasMap(russianRecords())),
    )
  })

  it('would move aliases without the canonical field — the guard above is not vacuous', () => {
    expect(asObject(buildQuestCityAliasMap(localizedRecords(distorted, false)))).not.toEqual(
      asObject(buildQuestCityAliasMap(russianRecords())),
    )
  })
})
