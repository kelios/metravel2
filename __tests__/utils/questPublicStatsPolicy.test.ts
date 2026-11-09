/**
 * #2906: пороги публичной статистики квестов живут в одном месте и возвращают
 * прежний формат сами, как только числа дорастают до порога.
 */
import {
  QUEST_PUBLIC_STATS_THRESHOLDS,
  countQuestCatalogScale,
  isCatalogCompletionsPublic,
  isCatalogPlayersPublic,
  isQuestCompletionsPublic,
} from '@/utils/questPublicStatsPolicy'

describe('questPublicStatsPolicy (#2906)', () => {
  it('скрывает прохождения каталога ниже порога и показывает от порога', () => {
    const { catalogCompletions } = QUEST_PUBLIC_STATS_THRESHOLDS
    expect(isCatalogCompletionsPublic(0)).toBe(false)
    expect(isCatalogCompletionsPublic(catalogCompletions - 1)).toBe(false)
    expect(isCatalogCompletionsPublic(catalogCompletions)).toBe(true)
    expect(isCatalogCompletionsPublic(Number.NaN)).toBe(false)
  })

  it('скрывает число игроков ниже порога, без числа и при null', () => {
    const { catalogPlayers } = QUEST_PUBLIC_STATS_THRESHOLDS
    expect(isCatalogPlayersPublic(null)).toBe(false)
    expect(isCatalogPlayersPublic(undefined)).toBe(false)
    expect(isCatalogPlayersPublic(catalogPlayers - 1)).toBe(false)
    expect(isCatalogPlayersPublic(catalogPlayers)).toBe(true)
  })

  it('«Пройдено N раз» и первопроходец — с первого прохождения, «Будьте первым» — только при нуле', () => {
    expect(isQuestCompletionsPublic(0)).toBe(false)
    expect(isQuestCompletionsPublic(1)).toBe(true)
    expect(isQuestCompletionsPublic(2)).toBe(true)
    expect(isQuestCompletionsPublic(undefined)).toBe(false)
    expect(isQuestCompletionsPublic(null)).toBe(false)
    expect(isQuestCompletionsPublic(Number.NaN)).toBe(false)
  })

  it('масштаб каталога считает разные города и страны без учёта регистра и пустых', () => {
    const quest = (id: string, cityId: string | null, countryCode?: string) => ({ id, cityId, countryCode })
    expect(countQuestCatalogScale([
      quest('a', '4', 'BY'),
      quest('b', '4', 'by'),
      quest('c', '11', 'BY'),
      quest('d', '27', 'PL'),
      quest('e', '', ''),
      quest('f', null, undefined),
    ])).toEqual({ cities: 3, countries: 2 })
    expect(countQuestCatalogScale([])).toEqual({ cities: 0, countries: 0 })
  })

  it('город с двумя id и общим alias — один город, как его лендинг (#2914)', () => {
    // Прод 02.11.2026: Могилёв живёт под city_id 14 и 93 с alias `mogilev`.
    expect(countQuestCatalogScale([
      { id: 'mogilev-a', cityId: '14', cityAlias: 'mogilev', countryCode: 'BY' },
      { id: 'mogilev-b', cityId: '93', cityAlias: 'mogilev', countryCode: 'BY' },
      { id: 'minsk-a', cityId: '4', cityAlias: 'minsk', countryCode: 'BY' },
    ])).toEqual({ cities: 2, countries: 1 })
  })
})
