import React, { StrictMode, Suspense } from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { Animated, Platform } from 'react-native'
import type { Travel } from '@/types/types'
import type { AnchorsMap } from '@/components/travel/details/TravelDetailsTypes'
import { TravelDetailsContentBlock } from '@/components/travel/details/TravelDetailsHeroDeferredColumn'
import TravelDetailsCriticalShell from '@/components/travel/details/TravelDetailsCriticalShell'

let mockPending: Promise<void> | null = null
let mockFocused = true
const mockFocusListeners = new Set<() => void>()
jest.mock('@/components/travel/CompactSideBarTravel', () => () => null)
jest.mock('@/components/travel/details/TravelDetailsSkeletonOverlay', () => () => null)
jest.mock('@/components/travel/details/TravelHeroStickyNavNative', () => () => null)
jest.mock('@/components/travel/details/TravelHeroSlots', () => ({ TravelHeroFavoriteToggleSlot: () => null }))
jest.mock('@/components/travel/details/TravelDetailsSections', () => ({ TravelHeroSection: () => null }))
jest.mock('@/components/travel/details/sections/TravelDetailsContentSection', () => ({
  TravelDetailsContentSection: ({ travel }: { travel: Travel }) => {
    if (mockPending) throw mockPending
    return <div>committed article {travel.id}</div>
  },
}))
jest.mock('expo-router', () => ({
  useIsFocused: () => require('react').useSyncExternalStore(
    (listener: () => void) => { mockFocusListeners.add(listener); return () => mockFocusListeners.delete(listener) },
    () => mockFocused,
    () => false,
  ),
}))
jest.mock('@/context/AuthContext', () => ({
  useAuth: (selector: (state: { authReady: boolean }) => unknown) => selector({ authReady: true }),
}))

it('records the real article owner only after its suspended content commits', async () => {
  const originalFetch = global.fetch
  const originalOS = Platform.OS
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  const fetchMock = jest.fn().mockResolvedValue({ status: 204 })
  global.fetch = fetchMock
  let release!: () => void
  mockPending = new Promise(resolve => { release = resolve })
  const travel = { id: 17, name: 'Fixture article' } as Travel
  const anchors = Object.fromEntries(
    ['gallery', 'video', 'description', 'recommendation', 'plus', 'minus', 'map', 'points', 'near', 'popular', 'excursions', 'comments']
      .map(key => [key, { current: null }]),
  ) as AnchorsMap
  try {
    const view = render(
      <Suspense fallback={<div>loading article</div>}>
        <TravelDetailsContentBlock travel={travel} isMobile anchors={anchors} forceOpenKey={null} />
      </Suspense>,
    )
    expect(screen.getByText('loading article')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()

    await act(async () => { mockPending = null; release() })

    expect(screen.getByText('committed article 17')).toBeTruthy()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/travels\/17\/view\/$/)
    view.unmount()
  } finally {
    mockPending = null
    global.fetch = originalFetch
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
  }
})

it.each(['web', 'android', 'ios'])('keeps one view when the real %s shell changes its responsive content ancestry', async platform => {
  const originalFetch = global.fetch
  const originalOS = Platform.OS
  Object.defineProperty(Platform, 'OS', { configurable: true, value: platform })
  const fetchMock = jest.fn().mockResolvedValue({ status: 204 })
  global.fetch = fetchMock
  const props = {
    travel: { id: 17, name: 'Fixture article' } as Travel,
    wrapperStyle: {}, styles: {}, skeletonPhase: 'hidden' as const, skeletonFallback: null,
    scrollRef: { current: null }, scrollViewStyle: {}, scrollEventHandler: () => {},
    handleContentSizeChange: () => {}, handleLayout: () => {}, contentHorizontalPadding: 16,
    anchors: {} as AnchorsMap, onFirstImageLoad: () => {}, sectionLinks: [], onQuickJump: () => {},
    deferHeroExtras: false, forceOpenKey: null, activeSection: null, closeMenu: () => {},
    onNavigate: () => {}, menuWidthNum: 320, animatedX: new Animated.Value(0),
    sideMenuPlatformStyles: {}, deferredContent: null, mainAriaLabel: 'Fixture article',
  }
  const shell = (isMobile: boolean) => (
    <StrictMode><TravelDetailsCriticalShell {...props} isMobile={isMobile} screenWidth={isMobile ? 390 : 1440} /></StrictMode>
  )
  try {
    const view = render(shell(true))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    view.rerender(shell(false))
    await act(async () => { await Promise.resolve() })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    view.rerender(shell(true))
    await act(async () => { await Promise.resolve() })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    act(() => { mockFocused = false; mockFocusListeners.forEach(listener => listener()) })
    view.rerender(shell(false))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    act(() => { mockFocused = true; mockFocusListeners.forEach(listener => listener()) })
    view.rerender(shell(false))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    view.unmount()
  } finally {
    mockFocused = true
    global.fetch = originalFetch
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
  }
})
