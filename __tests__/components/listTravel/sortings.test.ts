import {
  buildSortingOptions,
  getCatalogHeaderSortingOptions,
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

  it('labels newest/oldest with direction-explicit names so they read distinctly', () => {
    const byId = Object.fromEntries(
      buildSortingOptions([{ id: 'newest' }, { id: 'oldest' }]).map((o) => [o.id, o.name]),
    )
    expect(byId.newest).toBe('Сначала новые')
    expect(byId.oldest).toBe('Сначала старые')
  })

  it('keeps popular sorting in the catalog header when API sortings are partial', () => {
    expect(
      getCatalogHeaderSortingOptions([{ id: 'newest' }, { id: 'oldest' }]).map((option) => option.id),
    ).toEqual(['newest', 'oldest', 'popular_desc'])
  })
})
