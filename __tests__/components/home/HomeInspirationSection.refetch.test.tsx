import React from 'react'
import { render } from '@testing-library/react-native'
import { useQuery } from '@tanstack/react-query'
import { HomeInspirationSection } from '@/components/home/HomeInspirationSection'

let mockOwner: string | null = null
jest.mock('@/hooks/useQueryOwner', () => ({ useQueryOwner: () => mockOwner }))
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
    mockOwner = null
    mockUseQuery.mockReturnValue({ data: {}, isLoading: false } as never)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('disables refetchOnMount so fresh cache is not refetched on remount', async () => {
    await render(
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

  it('does not fetch while the home tab is blurred', async () => {
    await render(
      <HomeInspirationSection
        title="Популярное"
        queryKey="home-popular-travels"
        fetchFn={async () => ({ items: [] })}
        enabled={false}
      />
    )

    const options = mockUseQuery.mock.calls[0][0] as { enabled?: boolean }
    expect(options.enabled).toBe(false)
  })

  it('isolates home selections by session owner across login and logout', async () => {
    const ui = <HomeInspirationSection title="New" queryKey="home-new-travels" fetchFn={async () => ({ data: [], total: 0 })} />
    const view = await render(ui)
    expect(mockUseQuery.mock.lastCall?.[0].queryKey).toEqual(['home-new-travels', null])
    mockOwner = '242'
    await view.rerender(React.cloneElement(ui))
    expect(mockUseQuery.mock.lastCall?.[0].queryKey).toEqual(['home-new-travels', '242'])
    mockOwner = null
    await view.rerender(React.cloneElement(ui))
    expect(mockUseQuery.mock.lastCall?.[0].queryKey).toEqual(['home-new-travels', null])
  })
})
