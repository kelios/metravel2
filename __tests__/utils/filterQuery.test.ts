import {
  buildTravelQueryParams,
  mapCategoryNamesToIds,
  isCategoryFilterUnresolved,
} from '@/utils/filterQuery'

describe('buildTravelQueryParams', () => {
  it('adds default publish/moderation for public listings', () => {
    const params = buildTravelQueryParams({}, {})
    expect(params).toEqual({ moderation: 1, publish: 1 })
  })

  it('normalizes numeric arrays by trimming, deduping and sorting', () => {
    const params = buildTravelQueryParams(
      {
        countries: ['20', '3', 20, ' 3 '],
      },
      {},
    )

    expect(params.countries).toEqual([3, 20])
  })

  it('shows only published travels by default for personal /metravel area (F-14)', () => {
    const params = buildTravelQueryParams(
      {},
      { isMeTravel: true, userId: '42' },
    )

    expect(params).toEqual({ moderation: 1, publish: 1, user_id: '42' })
  })

  it('adds draft status filters for personal draft mode', () => {
    const params = buildTravelQueryParams(
      { draftsOnly: true },
      { isMeTravel: true, userId: '42' },
    )

    expect(params).toEqual({
      includeDrafts: true,
      moderation: 0,
      publish: 0,
      user_id: '42',
    })
  })

  it('forces Belarus filter for travelsby page', () => {
    const params = buildTravelQueryParams(
      { countries: [1, 2, 4] },
      { isTravelBy: true, belarusId: 3 },
    )

    expect(params.countries).toEqual([3])
  })

  it('adds publish=0 when moderation=0 is explicitly requested', () => {
    const params = buildTravelQueryParams({ moderation: 0 }, {})
    expect(params).toEqual({ moderation: 0, publish: 0 })
  })
})

describe('mapCategoryNamesToIds', () => {
  it('maps names ignoring case and removes duplicates', () => {
    const ids = mapCategoryNamesToIds(
      ['Trail', 'trail', 'Hike'],
      [
        { id: 5, name: 'Trail' },
        { id: 9, name: 'Hike' },
      ],
    )

    expect(ids).toEqual([5, 9])
  })
})

describe('isCategoryFilterUnresolved', () => {
  // Регрессия карты: категория выбрана в фильтре, но её имя не смапилось в
  // числовой backend-ID (частый кейс: API категорий пуст, чипы взяты из точек с
  // id=name) → серверный кластер-эндпоинт получает пустой category и возвращает
  // все точки. Флаг должен быть true, чтобы карта откатилась на клиентский
  // name-фильтр и снятие категории убирало маркеры.
  it('is true when a category is selected but no numeric ids resolved', () => {
    expect(isCategoryFilterUnresolved([['Замки'], []], [])).toBe(true)
    expect(isCategoryFilterUnresolved([[], ['Природа']], undefined)).toBe(true)
  })

  it('is false when no category is selected', () => {
    expect(isCategoryFilterUnresolved([[], []], [])).toBe(false)
    expect(isCategoryFilterUnresolved([undefined, null], undefined)).toBe(false)
  })

  it('is false when the selected category resolved to numeric ids', () => {
    // Имена смапились → серверный путь может фильтровать сам, откат не нужен.
    expect(isCategoryFilterUnresolved([['Замки'], []], [5])).toBe(false)
    expect(isCategoryFilterUnresolved([['Замки'], ['Природа']], [5, 9])).toBe(false)
  })
})
