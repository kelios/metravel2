import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { LazyYouTube } from '@/components/travel/details/sections/LazyYouTubeSection.native'

jest.mock('@/components/travel/details/TravelDetailsStyles', () => ({
  useTravelDetailsStyles: () => ({
    fallback: {},
    playOverlay: {},
    videoContainer: {},
    videoHintText: {},
  }),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    textOnDark: '#fff',
  }),
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

describe('LazyYouTube native', () => {
  it('mounts the Android-compatible WebView player after the preview is pressed', async () => {
    render(<LazyYouTube url="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />)

    fireEvent.press(screen.getByLabelText('Смотреть видео'))

    await waitFor(() => {
      expect(screen.getByTestId('travel-youtube-webview')).toBeTruthy()
    })

    const webView = screen.getByTestId('travel-youtube-webview')
    // Прямой uri на /embed/ грузится как документ верхнего уровня — YouTube
    // отвечает «Ошибка 153» (эмбед без Referer). Поэтому только html+baseUrl.
    expect(webView.props.source.uri).toBeUndefined()
    expect(webView.props.source.baseUrl).toBe('https://metravel.by')
    expect(webView.props.source.html).toContain(
      'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=https%3A%2F%2Fmetravel.by'
    )
    expect(webView.props.source.html).toContain('allowfullscreen')
    expect(webView.props.javaScriptEnabled).toBe(true)
    expect(webView.props.domStorageEnabled).toBe(true)
    expect(webView.props.mediaPlaybackRequiresUserAction).toBe(false)
    expect(webView.props.allowsFullscreenVideo).toBe(true)
    expect(webView.props.setSupportMultipleWindows).toBe(false)
    expect(webView.props.androidLayerType).toBe('hardware')
  })
})
