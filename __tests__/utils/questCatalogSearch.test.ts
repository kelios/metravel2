// #2198: поиск каталога находит город и по локализованному, и по
// каноническому названию. #3239: словоформы, опечатки, латиница и признаки
// квеста («для детей»).
import {
  createQuestCatalogSearch,
  normalizeQuestSearchText,
  stemQuestSearchToken,
} from '@/utils/questCatalogSearch'
import { buildCanonicalQuestCityIndex } from '@/utils/questCityCanonical'
import type { QuestMeta } from '@/utils/questAdapters'

const quest = (fields: Partial<QuestMeta> & Pick<QuestMeta, 'id' | 'title' | 'cityId'>) =>
  ({ countryName: 'Беларусь', countryCode: 'BY', tags: [], ...fields }) as QuestMeta

const krakow = quest({
  id: 'krakow-dragon',
  title: 'Quest po Krakowie: Smok Wawelski',
  cityId: '7',
  cityName: 'Kraków',
  cityNameCanonical: 'Краков',
  countryName: 'Польша',
  countryCode: 'PL',
})

const searchIn = (catalog: QuestMeta[]) => {
  const search = createQuestCatalogSearch(catalog, buildCanonicalQuestCityIndex(catalog).canonicalCityIdById)
  return (term: string) => {
    const result = search(term)
    return { ids: result.quests.map((item) => item.id), approximate: result.approximate }
  }
}

describe('normalizeQuestSearchText', () => {
  it('сводит кириллицу, польскую и латинскую запись к одному скелету', () => {
    expect(normalizeQuestSearchText('Гродно')).toBe('grodno')
    expect(normalizeQuestSearchText('Grodno')).toBe('grodno')
    expect(normalizeQuestSearchText('Kraków')).toBe(normalizeQuestSearchText('Краков'))
    expect(normalizeQuestSearchText('Ёлка, «Мир»!')).toBe('elka mir')
    expect(normalizeQuestSearchText('детей Київ')).toBe('detej kiyiv')
  })

  it('основа слова снимает падежное окончание', () => {
    expect(stemQuestSearchToken(normalizeQuestSearchText('Гродна'))).toBe('grodn')
    expect(stemQuestSearchToken(normalizeQuestSearchText('Гродно'))).toBe('grodn')
  })
})

describe('createQuestCatalogSearch — название, страна, тег', () => {
  const find = searchIn([krakow])

  it.each(['kraków', 'краков', 'smok', 'польша', 'Krakow'])('находит квест по «%s»', (term) => {
    expect(find(term)).toEqual({ ids: ['krakow-dragon'], approximate: false })
  })

  it('не находит чужой город', () => {
    expect(find('варшава').ids).toEqual([])
  })

  it('ответ старого бэка без канонического имени ищется как раньше', () => {
    const legacy = { ...krakow, cityName: 'Краков', cityNameCanonical: undefined } as QuestMeta
    expect(searchIn([legacy])('краков').ids).toEqual(['krakow-dragon'])
  })
})

describe('createQuestCatalogSearch — непереведённые квесты города (#2198)', () => {
  // Прод 09.10.2026, PL: у непереведённого квеста `city_name` — русский источник.
  const krakowRu = { ...krakow, id: 'krakow-ghosts', title: 'Призраки Кракова', cityName: 'Краков' } as QuestMeta
  const warsawRu = quest({
    id: 'warsaw-mermaid', title: 'Варшавская русалка', cityId: '8', cityName: 'Варшава',
    cityNameCanonical: 'Варшава', countryName: 'Польша', countryCode: 'PL',
  })
  // Один город под двумя city_id (QUEST-ALIAS-001), перевод есть только у одного.
  const gomel19 = quest({ id: 'gomel-park', title: 'Парк Румянцевых', cityId: '19', cityName: 'Гомель', cityNameCanonical: 'Гомель' })
  const gomel92 = { ...gomel19, id: 'gomel-river', title: 'Rzeka Soż', cityId: '92', cityName: 'Homiel' } as QuestMeta

  const find = searchIn([krakow, krakowRu, warsawRu, gomel19, gomel92])

  it('локализованное имя города находит и непереведённые квесты этого города', () => {
    expect(find('kraków').ids).toEqual(['krakow-dragon', 'krakow-ghosts'])
  })

  it('каноническое имя по-прежнему находит все квесты города', () => {
    expect(find('краков').ids).toEqual(['krakow-dragon', 'krakow-ghosts'])
  })

  it('город под двумя city_id находится целиком по любому из имён', () => {
    expect(find('homiel').ids).toEqual(['gomel-park', 'gomel-river'])
    expect(find('гомель').ids).toEqual(['gomel-park', 'gomel-river'])
  })

  it('имя одного города не протекает в другой', () => {
    expect(find('kraków').ids).not.toContain('warsaw-mermaid')
    expect(find('варшава').ids).toEqual(['warsaw-mermaid'])
  })

  it('название, тег и страна ищутся как раньше', () => {
    expect(find('smok').ids).toEqual(['krakow-dragon'])
    expect(find('польша').ids).toEqual(['krakow-dragon', 'krakow-ghosts', 'warsaw-mermaid'])
  })
})

describe('createQuestCatalogSearch — словоформы, опечатки, латиница (#3239)', () => {
  const grodnoCastle = quest({ id: 'grodno-castle', title: 'Тайны Старого замка', cityId: '11', cityName: 'Гродно', cityNameCanonical: 'Гродно' })
  const grodnoKids = quest({
    id: 'grodno-kids', title: 'Гродненские сказки', cityId: '91', cityName: 'Гродно',
    cityNameCanonical: 'Гродно', tags: ['age-8-10'],
  })
  const minsk = quest({ id: 'minsk-teens', title: 'Минск подростковый', cityId: '1', cityName: 'Минск', cityNameCanonical: 'Минск', tags: ['teens'] })
  const pinsk = quest({ id: 'pinsk-river', title: 'Пина и Полесье', cityId: '2', cityName: 'Пинск', cityNameCanonical: 'Пинск' })
  const nesvizh = quest({ id: 'nesvizh-lady', title: 'Чёрная дама', cityId: '3', cityName: 'Несвиж', cityNameCanonical: 'Несвиж' })
  const bike = quest({ id: 'brest-bike', title: 'Вдоль Буга', cityId: '4', cityName: 'Брест', cityNameCanonical: 'Брест', tags: ['bike'] })
  const detective = quest({ id: 'lida-detective', title: 'Лидский детектив', cityId: '5', cityName: 'Лида', cityNameCanonical: 'Лида', tags: ['detective'] })

  const find = searchIn([grodnoCastle, grodnoKids, minsk, pinsk, nesvizh, bike, detective])
  const grodno = ['grodno-castle', 'grodno-kids']

  it.each(['Гродно', 'Гродна', 'гродне', 'Grodno', 'GRODNO'])('«%s» находит квесты Гродно точно', (term) => {
    expect(find(term)).toEqual({ ids: grodno, approximate: false })
  })

  it.each(['грдно', 'Hrodna', 'Gordno'])('опечатка «%s» даёт квесты Гродно как похожие', (term) => {
    expect(find(term)).toEqual({ ids: grodno, approximate: true })
  })

  it('опечатка в Несвиже находит его, а не соседей', () => {
    expect(find('несвж')).toEqual({ ids: ['nesvizh-lady'], approximate: true })
  })

  it('точное совпадение выключает нечёткий уровень: «Пинск» не приносит Минск', () => {
    expect(find('пинск')).toEqual({ ids: ['pinsk-river'], approximate: false })
    expect(find('минск')).toEqual({ ids: ['minsk-teens'], approximate: false })
  })

  it('«для детей» находит все детские и подростковые квесты, но не детектив', () => {
    for (const term of ['для детей', 'дети', 'for kids', 'dla dzieci', 'для дітей']) {
      expect(find(term)).toEqual({ ids: ['grodno-kids', 'minsk-teens'], approximate: false })
    }
  })

  it('запрос из нескольких слов требует совпадения каждого', () => {
    expect(find('квесты для детей в Гродно')).toEqual({ ids: ['grodno-kids'], approximate: false })
  })

  it('тег квеста ищется словом на любом языке: «замок» находит квест с тегом castle', () => {
    const castle = quest({ id: 'mir-castle', title: 'Тайна Мирского', cityId: '6', cityName: 'Мир', tags: ['castle'] })
    const findCastle = searchIn([castle, pinsk])
    for (const term of ['замок', 'замки', 'zamek', 'castle']) {
      expect(findCastle(term)).toEqual({ ids: ['mir-castle'], approximate: false })
    }
  })

  it('короткая основа слова квеста не ловит длинный запрос: «Полацк» ≠ «Пола»', () => {
    const boston = quest({ id: 'boston', title: 'Фонари Пола Ревира', cityId: '9', cityName: 'Бостон' })
    const polotsk = quest({ id: 'polotsk', title: 'Святая София', cityId: '10', cityName: 'Полоцк' })
    expect(searchIn([boston, polotsk])('Полацк')).toEqual({ ids: ['polotsk'], approximate: true })
  })

  it('велоквест находится словом на любом языке', () => {
    expect(find('велосипед').ids).toEqual(['brest-bike'])
    expect(find('rower').ids).toEqual(['brest-bike'])
  })

  it('пустой и бессмысленный запрос ничего не находит', () => {
    expect(find('   ')).toEqual({ ids: [], approximate: false })
    expect(find('атлантида')).toEqual({ ids: [], approximate: false })
  })
})
