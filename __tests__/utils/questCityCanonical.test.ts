// #2198: язык контента квеста не должен менять группировку городов каталога —
// `cityName` у переведённого квеста локализован («Homiel»), у непереведённого
// остаётся русским источником.
import { buildCanonicalQuestCityIndex, resolveCanonicalQuestCityId } from '@/utils/questCityCanonical'

const quest = (id: string, cityId: string, cityName: string, cityNameCanonical?: string) => ({
  id, cityId, cityName, cityNameCanonical, countryCode: 'BY',
})

describe('buildCanonicalQuestCityIndex — смешанная локализация', () => {
  // Гомель 19/92 (QUEST-ALIAS-001): переведён только один квест записи 92.
  const quests = [
    quest('gomel-park', '19', 'Гомель', 'Гомель'),
    quest('gomel-palace', '92', 'Гомель', 'Гомель'),
    quest('gomel-river', '92', 'Homiel', 'Гомель'),
  ]

  it('один город — одна группа и один канонический id при любом языке квеста', () => {
    const index = buildCanonicalQuestCityIndex(quests)
    expect(index.canonicalCityIdById['92']).toBe('19')
    expect(Object.keys(index.questsByCityId)).toEqual(['19'])
    expect(index.questsByCityId['19'].map((q) => q.id)).toEqual(['gomel-park', 'gomel-palace', 'gomel-river'])
  })

  it('сегмент маршрута сцепляется с каталогом по локализованному и каноническому имени', () => {
    const index = buildCanonicalQuestCityIndex(quests)
    expect(resolveCanonicalQuestCityId(index, 'gomel', 'Homiel')).toBe('19')
    expect(resolveCanonicalQuestCityId(index, 'gomel', 'Гомель')).toBe('19')
  })

  it('ответ старого бэка без канонического имени группируется как раньше', () => {
    const index = buildCanonicalQuestCityIndex([quest('a', '19', 'Гомель'), quest('b', '92', 'Гомель')])
    expect(index.canonicalCityIdById['92']).toBe('19')
  })
})
