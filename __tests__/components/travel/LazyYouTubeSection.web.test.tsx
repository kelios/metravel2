/**
 * @jest-environment jsdom
 *
 * Ticket #818: the YouTube thumbnail is a below-the-fold, non-hero preview whose
 * `allowCriticalWebBlur` blur backdrop is fetched eagerly by the browser (CSS
 * background-image ignores `loading="lazy"`). The web variant gates the whole
 * <ImageCardMedia> behind an IntersectionObserver so `hqdefault.jpg` is not
 * requested until the section approaches the viewport. These tests pin that
 * gating wiring; the IO hook mechanics themselves are covered by
 * __tests__/hooks/useProgressiveLoading.test.tsx.
 */

import React from 'react'
import { render, screen } from '@testing-library/react-native'

let mockShouldLoad = false
const mockSetElementRef = jest.fn()

jest.mock('@/hooks/useProgressiveLoading', () => ({
  useProgressiveLoad: () => ({
    shouldLoad: mockShouldLoad,
    setElementRef: mockSetElementRef,
    elementRef: { current: null },
  }),
}))

jest.mock('@/components/travel/details/TravelDetailsStyles', () => ({
  useTravelDetailsStyles: () => ({
    playOverlay: {},
    videoContainer: {},
    videoHintText: {},
  }),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({ text: '#000', textOnDark: '#fff' }),
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  const { View } = require('react-native')
  return function MockImageCardMedia(props: Record<string, unknown>) {
    return <View testID="youtube-preview-image" {...props} />
  }
})

jest.mock('@/components/travel/details/TravelDetailsIcons', () => ({
  Icon: () => null,
}))

import { LazyYouTube } from '@/components/travel/details/sections/LazyYouTubeSection.web'

const URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

describe('LazyYouTube web offscreen gating (#818)', () => {
  beforeEach(() => {
    mockShouldLoad = false
    mockSetElementRef.mockClear()
  })

  it('does not mount the thumbnail before the section nears the viewport', () => {
    render(<LazyYouTube url={URL} />)

    // Intentional play affordance is present so the reserved 16:9 slot never
    // reads as blank (no CLS) while the image stays gated.
    expect(screen.getByLabelText('Смотреть видео')).toBeTruthy()
    // The thumbnail (and its eager CSS blur backdrop) must not be requested yet.
    expect(screen.queryByTestId('youtube-preview-image')).toBeNull()
  })

  it('mounts the hqdefault thumbnail once the section is near the viewport', () => {
    mockShouldLoad = true
    render(<LazyYouTube url={URL} />)

    const img = screen.getByTestId('youtube-preview-image')
    expect(img.props.src).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
    // Contract preserved: fit=contain + shared-source blur once the image mounts.
    expect(img.props.fit).toBe('contain')
    expect(img.props.blurBackground).toBe(true)
    expect(img.props.allowCriticalWebBlur).toBe(true)
  })
})
