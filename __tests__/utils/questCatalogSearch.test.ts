// #2198: поиск каталога находит город и по локализованному, и по
// каноническому названию.
import { createQuestCatalogSearch, questMatchesSearch } from '@/utils/questCatalogSearch'
import { buildCanonicalQuestCityIndex } from '@/utils/questCityCanonical'
import type { QuestMeta } from '@/utils/questAdapters'

const krakow = {
  id: 'krakow-dragon',
  title: 'Quest po Krakowie: Smok Wawelski',
  cityId: '7',
  cityName: 'Kraków',
  cityNameCanonical: 'Краков',
  countryName: 'Польша',
  countryCode: 'PL',
  tags: [],
} as unknown as QuestMeta

describe('questMatchesSearch', () => {
  it.each(['kraków', 'краков', 'smok', 'польша'])('находит квест по «%s»', (term) => {
    expect(questMatchesSearch(krakow, term)).toBe(true)
  })

  it('не находит чужой город', () => {
    expect(questMatchesSearch(krakow, 'варшава')).toBe(false)
  })

  it('ответ старого бэка без канонического имени ищется как раньше', () => {
    const legacy = { ...krakow, cityName: 'Краков', cityNameCanonical: undefined } as QuestMeta
    expect(questMatchesSearch(legacy, 'краков')).toBe(true)
  })
})

describe('createQuestCatalogSearch — непереведённые квесты города (#2198)', () => {
  // Прод 09.10.2026, PL: у непереведённого квеста `city_name` — русский источник.
  const krakowRu = {
    ...krakow,
    id: 'krakow-ghosts',
    title: 'Призраки Кракова',
    cityName: 'Краков',
    cityNameCanonical: 'Краков',
  } as QuestMeta
  const warsawRu = {
    ...krakow,
    id: 'warsaw-mermaid',
    title: 'Варшавская русалка',
    cityId: '8',
    cityName: 'Варшава',
    cityNameCanonical: 'Варшава',
  } as QuestMeta
  // Один город под двумя city_id (QUEST-ALIAS-001), перевод есть только у одного.
  const gomel19 = {
    id: 'gomel-park', title: 'Парк Румянцевых', cityId: '19', cityName: 'Гомель',
    cityNameCanonical: 'Гомель', countryName: 'Беларусь', countryCode: 'BY', tags: [],
  } as unknown as QuestMeta
  const gomel92 = {
    ...gomel19, id: 'gomel-river', title: 'Rzeka Soż', cityId: '92', cityName: 'Homiel',
  } as QuestMeta

  const catalog = [krakow, krakowRu, warsawRu, gomel19, gomel92]
  const search = createQuestCatalogSearch(catalog, buildCanonicalQuestCityIndex(catalog).canonicalCityIdById)
  const found = (term: string) => catalog.filter((quest) => search(quest, term)).map((quest) => quest.id)

  it('локализованное имя города находит и непереведённые квесты этого города', () => {
    expect(found('kraków')).toEqual(['krakow-dragon', 'krakow-ghosts'])
  })

  it('каноническое имя по-прежнему находит все квесты города', () => {
    expect(found('краков')).toEqual(['krakow-dragon', 'krakow-ghosts'])
  })

  it('город под двумя city_id находится целиком по любому из имён', () => {
    expect(found('homiel')).toEqual(['gomel-park', 'gomel-river'])
    expect(found('гомель')).toEqual(['gomel-park', 'gomel-river'])
  })

  it('имя одного города не протекает в другой', () => {
    expect(found('kraków')).not.toContain('warsaw-mermaid')
    expect(found('варшава')).toEqual(['warsaw-mermaid'])
  })

  it('название, тег и страна ищутся как раньше', () => {
    expect(found('smok')).toEqual(['krakow-dragon'])
    expect(found('польша')).toEqual(['krakow-dragon', 'krakow-ghosts', 'warsaw-mermaid'])
  })
})
