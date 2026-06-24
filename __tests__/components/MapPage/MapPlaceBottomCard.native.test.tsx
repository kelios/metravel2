import React from 'react'
import { Platform, StyleSheet } from 'react-native'

const renderer = require('react-test-renderer')

jest.mock('@/components/MapPage/Map/createMapPopupComponent', () => ({
  __esModule: true,
  createMapPopupComponent: () =>
    function MockPopup() {
      const React = require('react')
      const { Text } = require('react-native')
      return React.createElement(Text, { testID: 'mock-popup-content' }, 'content')
    },
}))

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}))

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({}),
  useThemedColors: () => ({
    surface: '#fff',
    surfaceMuted: '#f4f4f4',
    text: '#111',
    textOnPrimary: '#fff',
    borderLight: '#ddd',
    borderStrong: '#999',
  }),
}))

jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({
  useSafeAreaInsetsSafe: () => ({ top: 24, bottom: 8, left: 0, right: 0 }),
}))

const originalPlatform = Platform.OS
;(Platform as any).OS = 'ios'
const MapPlaceBottomCard = require('@/components/MapPage/MapPlaceBottomCard').default

const point = { id: '1', lat: 53.9, lng: 27.56, title: 'Test point' } as any

describe('MapPlaceBottomCard native layout', () => {
  afterAll(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('keeps the fullscreen card flush to the bottom and moves dock space into content padding', () => {
    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <MapPlaceBottomCard
          point={point}
          userLocation={null}
          onClose={jest.fn()}
          bottomInset={72}
        />,
      )
    })

    const root = tree.root.findByProps({ testID: 'map-place-bottom-card' })
    const rootStyle = StyleSheet.flatten(root.props.style)
    expect(rootStyle.paddingBottom).toBeUndefined()
    expect(rootStyle.paddingTop).toBe(24)

    const scroll = tree.root.findByType(require('react-native').ScrollView)
    const contentStyle = StyleSheet.flatten(scroll.props.contentContainerStyle)
    expect(contentStyle.paddingBottom).toBe(92)
  })
})
