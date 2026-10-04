// #2133 (Apple 1.2(c)): жалоба на фото травела в полноэкранной галерее —
// только у фото с настоящим id галереи; индекс слайда id не считается.

import React from 'react'
import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import FullscreenGallery from '@/components/travel/FullscreenGallery'
import TravelHeroInteractiveSlider from '@/components/travel/details/TravelHeroInteractiveSlider'
import { useAuthStore } from '@/stores/authStore'

jest.mock('expo-navigation-bar', () => ({ setVisibilityAsync: jest.fn() }), { virtual: true })
jest.mock('@/components/travel/Slider', () => ({ __esModule: true, default: () => null }))
jest.mock('@/api/userSafety', () => ({
  __esModule: true,
  reportContent: jest.fn(() => Promise.resolve({ id: 1, status: 'pending' })),
  blockUser: jest.fn(() => Promise.resolve()),
  unblockUser: jest.fn(() => Promise.resolve()),
  fetchReportReasons: jest.fn(() => Promise.resolve([])),
  fetchBlockedUsers: jest.fn(() => Promise.resolve([])),
  isMockReported: jest.fn(() => false),
  isMockBlocked: jest.fn(() => false),
}))

const wrap = (node: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

const MENU = 'travel-fullscreen-gallery-safety-menu'

describe('FullscreenGallery content safety', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true, userId: '7' })
  })

  it('shows the photo safety trigger for a gallery photo with a real id', () => {
    const { getByTestId } = wrap(
      <FullscreenGallery visible images={[{ id: 11, url: 'https://example.com/1.jpg' }]} onClose={jest.fn()} safetyAuthorId={42} />,
    )
    expect(getByTestId(MENU)).toBeTruthy()
  })

  it('shows nothing for a photo without a gallery id', () => {
    const { queryByTestId } = wrap(
      <FullscreenGallery visible images={[{ url: 'https://example.com/1.jpg' }]} onClose={jest.fn()} safetyAuthorId={42} />,
    )
    expect(queryByTestId(MENU)).toBeNull()
  })

  it('hides the trigger on the travel author own photo', () => {
    useAuthStore.setState({ isAuthenticated: true, userId: '42' })
    const { queryByTestId } = wrap(
      <FullscreenGallery visible images={[{ id: 11, url: 'https://example.com/1.jpg' }]} onClose={jest.fn()} safetyAuthorId={42} />,
    )
    expect(queryByTestId(MENU)).toBeNull()
  })

  it('hero slider passes the real photo id, never the index fallback', () => {
    const images = [
      { id: 17, photoId: 17, url: 'https://example.com/a.jpg' },
      { id: 1, photoId: null, url: 'https://example.com/b.jpg' },
    ]
    const props = {
      galleryImages: images,
      isMobile: true,
      aspectRatio: 1.5,
      preloadCount: 1,
      firstImagePreloaded: false,
      onFirstImageLoad: jest.fn(),
      onImagePress: jest.fn(),
      fullscreenVisible: true,
      safetyAuthorId: 42,
    }
    const first = wrap(<TravelHeroInteractiveSlider {...props} fullscreenIndex={0} />)
    expect(first.getByTestId(MENU)).toBeTruthy()
    first.unmount()

    const second = wrap(<TravelHeroInteractiveSlider {...props} fullscreenIndex={1} />)
    expect(second.queryByTestId(MENU)).toBeNull()
  })
})
