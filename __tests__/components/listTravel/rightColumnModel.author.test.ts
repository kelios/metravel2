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

// #2775: the «Ещё по запросу» row lives in the list header and changes its text
// when the quest and place sources answer; the memoized column must re-render.
describe('list intro memoization', () => {
  it('re-renders when the list intro content changes', () => {
    const props = {
      activeFiltersCount: 0, contentPadding: 16, gridColumns: 1,
      isError: false, isMobile: true, isRecommendationsVisible: false,
      renderItem: () => null, search: 'Браслав', showEmptyState: false,
      showInitialLoading: false, showNextPageLoading: false, total: 7, travels: [],
      listIntroContent: 'loading',
    }
    expect(areRightColumnPropsEqual(props, { ...props })).toBe(true)
    expect(areRightColumnPropsEqual(props, { ...props, listIntroContent: 'found' })).toBe(false)
  })
})
