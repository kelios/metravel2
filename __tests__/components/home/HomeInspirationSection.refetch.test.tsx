import { render } from '@testing-library/react-native'
import { useQuery } from '@tanstack/react-query'
import { HomeInspirationSection } from '@/components/home/HomeInspirationSection'

jest.mock('@tanstack/react-query')
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('@/components/listTravel/RenderTravelItem', () => {
  return function MockRenderTravelItem() {
    return null
  }
})
jest.mock('@/api/map')
jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: jest.fn(),
  queueAnalyticsEvent: jest.fn(),
}))

const mockUseQuery = useQuery as jest.MockedFunction<typeof useQuery>

describe('HomeInspirationSection query config (#738)', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({ data: {}, isLoading: false } as never)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('disables refetchOnMount so fresh cache is not refetched on remount', () => {
    render(
      <HomeInspirationSection
        title="Популярное"
        subtitle="sub"
        queryKey="home-popular-travels"
        fetchFn={async () => ({ items: [] })}
      />
    )

    expect(mockUseQuery).toHaveBeenCalled()
    const options = mockUseQuery.mock.calls[0][0] as { refetchOnMount?: boolean }
    // queryConfigs.dynamic still sets refetchOnMount:true globally; the home
    // section must override it to false (scoped fix — see #738).
    expect(options.refetchOnMount).toBe(false)
  })
})
