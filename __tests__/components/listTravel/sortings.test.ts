import {
  buildSortingOptions,
  getDefaultSortingOptions,
} from '@/components/listTravel/utils/sortings'

describe('listTravel sortings', () => {
  it('hides created date aliases that duplicate newest and oldest sorting', () => {
    const options = buildSortingOptions([
      { id: 'newest' },
      { id: 'oldest' },
      { id: 'created_desc' },
      { id: 'created_asc' },
      { id: 'popular_desc' },
    ])

    expect(options.map((option) => option.id)).toEqual([
      'newest',
      'oldest',
      'popular_desc',
    ])
  })

  it('does not include created aliases in the mobile default sorting row', () => {
    expect(getDefaultSortingOptions().map((option) => option.id)).not.toEqual(
      expect.arrayContaining(['created_desc', 'created_asc']),
    )
  })
})
