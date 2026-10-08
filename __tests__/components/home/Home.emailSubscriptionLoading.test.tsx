import { act, render, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Home from '@/components/home/Home'

jest.mock('home-email-loading-probe', () => ({
  loads: 0,
  subscribers: new Set(),
}), { virtual: true })
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false }) }))
jest.mock('@/api/travelUserQueries', () => ({ fetchMyTravels: jest.fn() }))
jest.mock('@/components/home/HomeHero', () => ({ __esModule: true, default: () => null }))
jest.mock('@/hooks/useProgressiveLoading', () => {
  const { useEffect, useState } = require('react')
  return {
    useProgressiveLoad: ({ priority }: { priority: string }) => {
      const [shouldLoad, setShouldLoad] = useState(priority === 'immediate' || priority === 'high')
      useEffect(() => {
        const { subscribers } = jest.requireMock('home-email-loading-probe')
        subscribers.add(setShouldLoad)
        return () => { subscribers.delete(setShouldLoad) }
      }, [])
      return { shouldLoad, setElementRef: jest.fn() }
    },
  }
})
jest.mock('@/components/common/EmailSubscriptionForm', () => {
  jest.requireMock('home-email-loading-probe').loads += 1
  const { Text } = require('react-native')
  return {
    __esModule: true,
    default: (props: unknown) => (
      <Text testID="home-email-form" accessibilityHint={JSON.stringify(props)} />
    ),
  }
})
jest.mock('@/components/home/homeDeferredSections', () => ({
  ...jest.requireActual('@/components/home/homeDeferredSections.web'),
  HomeAppPromoSection: () => null,
  HomeBottomCtaSection: () => null,
  HomeFAQSection: () => null,
  HomeInspirationSections: () => null,
  HomeNewRoutesSection: () => null,
  HomePopularRoutesSection: () => null,
  HomeQuestsPromoSection: () => null,
  HomeWeekendRoutesSection: () => null,
}))

it('loads the subscription module only when its existing visibility gate opens', async () => {
  const probe = jest.requireMock('home-email-loading-probe') as {
    loads: number
    subscribers: Set<(visible: boolean) => void>
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const screen = () => <QueryClientProvider client={client}><Home /></QueryClientProvider>
  const { queryByTestId, getByTestId, rerender, unmount } = render(screen())

  expect(probe.loads).toBe(0)
  expect(queryByTestId('home-email-form')).toBeNull()

  act(() => {
    probe.subscribers.forEach((setVisible) => setVisible(true))
  })
  await waitFor(() => expect(getByTestId('home-email-form')).toBeTruthy())
  expect(probe.loads).toBe(1)
  expect(JSON.parse(getByTestId('home-email-form').props.accessibilityHint)).toEqual({
    source: 'home',
    pageUrl: 'https://metravel.by/',
    clientOnly: true,
  })

  rerender(screen())
  expect(probe.loads).toBe(1)
  unmount()
  client.clear()
})

it('retains the directly available form in the native adapter', () => {
  const nativeSections = jest.requireActual('@/components/home/homeDeferredSections')
  const form = jest.requireMock('@/components/common/EmailSubscriptionForm').default

  expect(nativeSections.EmailSubscriptionForm).toBe(form)
})
