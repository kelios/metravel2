// #2198: поиск каталога находит город и по локализованному, и по
// каноническому названию.
import { questMatchesSearch } from '@/utils/questCatalogSearch'
import type { QuestMeta } from '@/utils/questAdapters'

const krakow = {
  id: 'krakow-dragon',
  title: 'Quest po Krakowie: Smok Wawelski',
  cityName: 'Kraków',
  cityNameCanonical: 'Краков',
  countryName: 'Польша',
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
