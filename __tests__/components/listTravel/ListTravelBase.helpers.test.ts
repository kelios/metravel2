import {
  buildActiveConditionChips,
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
})
