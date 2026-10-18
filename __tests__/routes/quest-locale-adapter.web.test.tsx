import React from 'react'
import { Text } from 'react-native'
import { act, render, screen, waitFor } from '@testing-library/react-native'

// One web stack card: its own catch-all segments, the global pathname and the
// focus flag change independently, as in expo-router's web stack.
let mockPathname = '/pl/quests/4/minsk-cmok'
let mockCardPath = mockPathname
let mockFocused = true
const mockFocusListeners = new Set<() => void>()
const setFocused = (focused: boolean) => {
  mockFocused = focused
  for (const listener of mockFocusListeners) listener()
}
const mockDetail = jest.fn((_props: unknown) => null as React.ReactNode)
const mockNotFound = jest.fn(() => null)

jest.mock('expo-router', () => {
  const { useSyncExternalStore } = jest.requireActual('react')
  return {
    usePathname: () => mockPathname,
    useLocalSearchParams: () => ({ missing: mockCardPath.split('/').filter(Boolean) }),
    useIsFocused: () => useSyncExternalStore(
      (listener: () => void) => { mockFocusListeners.add(listener); return () => mockFocusListeners.delete(listener) },
      () => mockFocused,
    ),
  }
})
jest.mock('@/components/layout/CustomHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/app/(tabs)/quests/[city]/[questId]', () => ({
  __esModule: true, default: (props: unknown) => mockDetail(props),
}))
jest.mock('@/components/screens/NotFoundContent', () => ({ __esModule: true, NotFoundContent: () => mockNotFound() }))

import QuestLocaleRouteScreen from '@/app/[...missing].web'

const { useIsFocused } = jest.requireMock('expo-router') as { useIsFocused: () => boolean }

describe('quest-only web catch-all', () => {
  beforeEach(() => {
    mockDetail.mockReset()
    mockDetail.mockImplementation(() => null)
    mockNotFound.mockClear()
    mockFocusListeners.clear()
    mockFocused = true
  })

  it.each(['be', 'uk', 'pl', 'en'])('delegates an exact %s prefix with stable city and slug', async (locale) => {
    mockPathname = mockCardPath = `/${locale}/quests/4/minsk-cmok`
    render(<QuestLocaleRouteScreen />)
    // The quest screen is a lazy boundary (#2389): it resolves after the first render.
    await waitFor(() => expect(mockDetail).toHaveBeenCalledWith(expect.objectContaining({
      route: { locale, cityId: 4, questSlug: 'minsk-cmok', path: mockCardPath },
    })))
    expect(mockNotFound).not.toHaveBeenCalled()
  })

  it.each(['/de/quests/4/minsk-cmok', '/ru/quests/4/minsk-cmok', '/pl/quests/minsk', '/pl/quests/minsk/minsk-cmok', '/pl/travels/example'])('keeps unsupported path %s in the existing not-found screen', (path) => {
    mockPathname = mockCardPath = path
    render(<QuestLocaleRouteScreen />)
    expect(mockDetail).not.toHaveBeenCalled()
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('renders an already loaded quest screen in the first commit, without a Suspense fallback (#2465)', async () => {
    mockPathname = mockCardPath = '/pl/quests/4/minsk-cmok'
    const first = render(<QuestLocaleRouteScreen />)
    await waitFor(() => expect(mockDetail).toHaveBeenCalled())
    first.unmount()
    mockDetail.mockClear()

    // The translated document ships the chunk (#2465): the module is in before
    // mount, so the screen must not suspend — its retry would be throttled.
    render(<QuestLocaleRouteScreen />)
    expect(mockDetail).toHaveBeenCalledWith(expect.objectContaining({
      route: expect.objectContaining({ locale: 'pl', questSlug: 'minsk-cmok' }),
    }))
  })

  it('freezes a hidden card on its own address after a language link pushes another locale (#2464)', async () => {
    // The detail derives availability from focus-gated queries: a blurred
    // render is exactly the stale "version unavailable" heading.
    mockDetail.mockImplementation((props) => {
      const { route } = props as { route: { path: string } }
      return <DetailHeading path={route.path} />
    })
    mockPathname = mockCardPath = '/be/quests/1/krakow-dragon'
    render(<QuestLocaleRouteScreen />)
    expect(await screen.findByText('detail /be/quests/1/krakow-dragon')).toBeTruthy()
    const rendersBeforePush = mockDetail.mock.calls.length

    // router.push('/uk/…'): the global path moves, this card stays BE and blurs.
    act(() => {
      mockPathname = '/uk/quests/1/krakow-dragon'
      setFocused(false)
    })
    expect(mockDetail).toHaveBeenCalledTimes(rendersBeforePush)
    expect(screen.queryByText(/unavailable/, { includeHiddenElements: true })).toBeNull()
    expect(screen.getAllByText(/^detail /, { includeHiddenElements: true })).toHaveLength(1)

    // Back: the same BE card is shown again without remounting another identity.
    act(() => {
      mockPathname = '/be/quests/1/krakow-dragon'
      setFocused(true)
    })
    expect(screen.getByText('detail /be/quests/1/krakow-dragon')).toBeTruthy()
    expect(mockDetail.mock.calls.every(([props]) =>
      (props as { route: { path: string } }).route.path === '/be/quests/1/krakow-dragon')).toBe(true)
  })
})

function DetailHeading({ path }: { path: string }) {
  const focused = useIsFocused()
  return <Text accessibilityRole="header">{focused ? `detail ${path}` : `unavailable ${path}`}</Text>
}
