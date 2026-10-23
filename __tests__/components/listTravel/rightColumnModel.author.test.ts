import { areRightColumnPropsEqual } from '@/components/listTravel/rightColumnModel'

describe('catalog contribution footer memoization', () => {
  it('updates the footer destination when switching catalog and search with the same results', () => {
    const props = {
      activeFiltersCount: 0, contentPadding: 16, gridColumns: 1,
      isError: false, isMobile: true, isRecommendationsVisible: false,
      renderItem: () => null, search: '', showEmptyState: false,
      showInitialLoading: false, showNextPageLoading: false, total: 0, travels: [],
      contributionBannerVariant: 'search',
    }
    expect(areRightColumnPropsEqual(props, { ...props })).toBe(true)
    expect(areRightColumnPropsEqual(props, { ...props, contributionBannerVariant: 'author-catalog' })).toBe(false)
  })
})
