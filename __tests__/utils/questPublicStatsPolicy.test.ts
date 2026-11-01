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

  it('«Пройдено N раз» и первопроходец — от двух прохождений', () => {
    expect(isQuestCompletionsPublic(0)).toBe(false)
    expect(isQuestCompletionsPublic(1)).toBe(false)
    expect(isQuestCompletionsPublic(2)).toBe(true)
    expect(isQuestCompletionsPublic(undefined)).toBe(false)
  })

  it('масштаб каталога считает разные города и страны без учёта регистра и пустых', () => {
    expect(countQuestCatalogScale([
      { cityId: '4', countryCode: 'BY' },
      { cityId: '4', countryCode: 'by' },
      { cityId: 'Grodno', countryCode: 'BY' },
      { cityId: 'krakow', countryCode: 'PL' },
      { cityId: '', countryCode: '' },
      { cityId: null, countryCode: undefined },
    ])).toEqual({ cities: 3, countries: 2 })
    expect(countQuestCatalogScale([])).toEqual({ cities: 0, countries: 0 })
  })
})
