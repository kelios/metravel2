import {
  buildActiveConditionChips,
  buildEmptyStateMessage,
  buildSearchAnalyticsFilters,
  summarizeFilterValues,
} from '@/components/listTravel/ListTravelBase.helpers'

describe('ListTravelBase helpers', () => {
  it('does not expose raw numeric filter ids while options are unresolved', () => {
    expect(summarizeFilterValues('Что посмотреть', [12], undefined)).toBeNull()

    const chips = buildActiveConditionChips({
      debSearch: '',
      filter: { categoryTravelAddress: [12] } as any,
      options: undefined,
      onSelect: jest.fn(),
      setSearch: jest.fn(),
    })

    expect(chips).toEqual([])
  })

  it('uses real option names without raw group titles for active filter chips when options are loaded', () => {
    const chips = buildActiveConditionChips({
      debSearch: '',
      filter: { categoryTravelAddress: [12] } as any,
      options: {
        categoryTravelAddress: [{ id: 12, name: 'Водопады' }],
      } as any,
      onSelect: jest.fn(),
      setSearch: jest.fn(),
    })

    expect(chips.map((chip) => chip.label)).toEqual(['Водопады'])
  })

  it('keeps the all-authors unpublished scope visible and removable', () => {
    const onSelect = jest.fn()
    const chips = buildActiveConditionChips({
      debSearch: '',
      filter: { allAuthorsUnpublishedOnly: true },
      onSelect,
      setSearch: jest.fn(),
    })

    expect(chips).toHaveLength(1)
    expect(chips[0]).toMatchObject({
      key: 'allAuthorsUnpublishedOnly',
      label: 'Неопубликованные (на модерации)',
    })
    chips[0].onRemove()
    expect(onSelect).toHaveBeenCalledWith('allAuthorsUnpublishedOnly', undefined)
  })

  it('explains an empty all-authors result as a filter result', () => {
    const message = buildEmptyStateMessage({
      showEmptyState: true,
      filter: { allAuthorsUnpublishedOnly: true },
      debSearch: '',
      isMeTravel: true,
      onCreateTravel: jest.fn(),
    })

    expect(message?.variant).toBe('search')
    expect(message?.description).toContain('Неопубликованные (на модерации)')
  })

  // #2895: пустой поиск без фильтров называет сам запрос и не советует «убрать фильтры».
  it('words a query-only empty result around the query itself', () => {
    const message = buildEmptyStateMessage({
      showEmptyState: true,
      filter: {},
      debSearch: 'qwertyuiop',
      isMeTravel: false,
      showPopularFallback: true,
      onCreateTravel: jest.fn(),
    })

    expect(message).toMatchObject({
      variant: 'search',
      title: 'Ничего не найдено',
      description: 'По запросу «qwertyuiop» маршрутов нет.',
      popularFallback: true,
    })
  })

  it('keeps the filter wording when the query comes with filters', () => {
    const message = buildEmptyStateMessage({
      showEmptyState: true,
      filter: { companions: [1] } as any,
      debSearch: 'qwertyuiop',
      isMeTravel: false,
      onCreateTravel: jest.fn(),
    })

    expect(message?.variant).toBe('search')
    expect(message?.description).toContain('qwertyuiop')
    expect(message?.description).toContain('Попробуйте убрать фильтры')
    expect(message).toMatchObject({ popularFallback: false })
  })

  // #2908: re-sorting the same query is neither a new search nor a filter.
  it('keeps sort out of the search analytics identity and has_filters', () => {
    const base = { moderation: 1, publish: 1 }
    const unsorted = buildSearchAnalyticsFilters(base, {})
    const sorted = buildSearchAnalyticsFilters({ ...base, sort: 'popular' }, { sort: 'popular' })

    expect(sorted).toEqual(unsorted)
    expect(sorted.hasFilters).toBe(false)

    const filtered = buildSearchAnalyticsFilters({ ...base, categories: [2] }, { categories: [2] } as any)
    expect(filtered.hasFilters).toBe(true)
    expect(filtered.filtersKey).not.toBe(unsorted.filtersKey)
  })
})
