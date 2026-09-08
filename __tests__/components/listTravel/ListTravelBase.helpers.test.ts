import {
  buildActiveConditionChips,
  buildEmptyStateMessage,
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
      label: 'Неопубликованные всех авторов',
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
    expect(message?.description).toContain('Неопубликованные всех авторов')
  })
})
