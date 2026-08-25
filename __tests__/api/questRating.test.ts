import {
  hasPublicQuestRating,
  QUEST_RATING_MIN_REVIEWS,
} from '@/api/questRating'

// #1486: порог публичного агрегата. Держится одной константой, потому что
// показывается он из трёх мест — карточка каталога (два макета) и шапка детали.
describe('hasPublicQuestRating', () => {
  it('требует выборку не меньше порога', () => {
    expect(QUEST_RATING_MIN_REVIEWS).toBe(3)
    expect(hasPublicQuestRating(0)).toBe(false)
    expect(hasPublicQuestRating(1)).toBe(false)
    expect(hasPublicQuestRating(2)).toBe(false)
    expect(hasPublicQuestRating(3)).toBe(true)
    expect(hasPublicQuestRating(42)).toBe(true)
  })

  it('не падает на отсутствующем счётчике', () => {
    expect(hasPublicQuestRating(null)).toBe(false)
    expect(hasPublicQuestRating(undefined)).toBe(false)
    expect(hasPublicQuestRating(Number.NaN)).toBe(false)
  })
})
