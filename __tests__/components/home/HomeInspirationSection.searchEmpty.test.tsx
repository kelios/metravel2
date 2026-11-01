import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { useQuery } from '@tanstack/react-query'
import { HomeInspirationSection } from '@/components/home/HomeInspirationSection'

jest.mock('@tanstack/react-query')
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('@/components/listTravel/RenderTravelItem', () => {
  const { createElement } = jest.requireActual('react')
  const { View } = jest.requireActual('react-native')
  return function MockRenderTravelItem() {
    return createElement(View, { testID: 'rail-travel-card' })
  }
})
jest.mock('@/api/map')
jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: jest.fn(),
  queueAnalyticsEvent: jest.fn(),
}))

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>

const renderSection = (surface?: 'home' | 'search_empty') =>
  render(
    <HomeInspirationSection
      title="Популярное у путешественников"
      queryKey="home-popular-travels"
      fetchFn={async () => []}
      layout="rail"
      surface={surface}
    />
  )

// #2895: под пустым поиском рельса популярных — дополнение без собственных действий.
describe('HomeInspirationSection under an empty site search', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('shows the rail without «view all» — the empty search already offers a reset', async () => {
    mockUseQuery.mockReturnValue({ data: [{ id: 1 }, { id: 2 }], isLoading: false } as never)
    await renderSection('search_empty')

    expect(screen.getByText('Популярное у путешественников')).toBeTruthy()
    expect(screen.queryByLabelText(/Открыть каталог маршрутов/)).toBeNull()
  })

  it('keeps «view all» on the home page', async () => {
    mockUseQuery.mockReturnValue({ data: [{ id: 1 }, { id: 2 }], isLoading: false } as never)
    await renderSection()

    expect(screen.getByLabelText(/Открыть каталог маршрутов/)).toBeTruthy()
  })

  it('renders nothing when there are no popular routes or the request failed', async () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false } as never)
    const empty = await renderSection('search_empty')
    expect(empty.toJSON()).toBeNull()
    await empty.unmount()

    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error('x') } as never)
    const failed = await renderSection('search_empty')
    expect(failed.toJSON()).toBeNull()
  })

  it('caps the popular rail under an empty search at six routes', async () => {
    const { default: HomePopularRoutesSection } = jest.requireActual('@/components/home/HomePopularRoutesSection')
    const data = Array.from({ length: 10 }, (_, index) => ({ id: index + 1 }))
    mockUseQuery.mockReturnValue({ data, isLoading: false } as never)
    await render(<HomePopularRoutesSection surface="search_empty" />)
    expect(screen.getAllByTestId('rail-travel-card')).toHaveLength(6)
  })
})
