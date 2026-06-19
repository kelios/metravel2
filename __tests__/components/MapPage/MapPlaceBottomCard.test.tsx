import React from 'react'
import { Platform } from 'react-native'

const renderer = require('react-test-renderer')

// Keep the heavy popup factory (router/stores/api) out of the unit test: the
// bottom-card fullscreen layout is what we assert here, not the popup content.
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
    text: '#111',
    textOnPrimary: '#fff',
    borderLight: '#ddd',
    borderStrong: '#999',
  }),
}))

jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({
  useSafeAreaInsetsSafe: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

// `MapPlaceBottomCard` captures `IS_WEB = Platform.OS === 'web'` at module load,
// so flip the platform BEFORE requiring it (mirrors the real web bundle, where
// Platform.OS is 'web' from the start).
const originalPlatform = Platform.OS
;(Platform as any).OS = 'web'
const MapPlaceBottomCard = require('@/components/MapPage/MapPlaceBottomCard').default

const point = { id: '1', lat: 53.9, lng: 27.56, title: 'Test point' } as any

describe('MapPlaceBottomCard', () => {
  const originalUseWindowDimensions = require('react-native').useWindowDimensions

  afterAll(() => {
    ;(Platform as any).OS = originalPlatform
  })

  afterEach(() => {
    require('react-native').useWindowDimensions = originalUseWindowDimensions
  })

  it('renders a fullscreen scrollable sheet on mobile web so every element stays reachable', () => {
    require('react-native').useWindowDimensions = jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 }))

    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <MapPlaceBottomCard point={point} userLocation={null} onClose={jest.fn()} />,
      )
    })

    // Fullscreen layer uses a ScrollView so tall photo-dominant content is reachable.
    expect(tree.root.findByProps({ testID: 'map-place-bottom-card-scroll' })).toBeTruthy()
    // Close button is present and reachable.
    const close = tree.root.findByProps({ testID: 'map-place-bottom-card-close' })
    expect(close).toBeTruthy()
    expect(tree.root.findByProps({ testID: 'mock-popup-content' })).toBeTruthy()
  })

  it('calls onClose from the fullscreen close button', () => {
    require('react-native').useWindowDimensions = jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 }))
    const onClose = jest.fn()

    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <MapPlaceBottomCard point={point} userLocation={null} onClose={onClose} />,
      )
    })

    const close = tree.root.findByProps({ testID: 'map-place-bottom-card-close' })
    renderer.act(() => {
      close.props.onPress()
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the compact bottom-sheet (no extra ScrollView) on wider viewports', () => {
    require('react-native').useWindowDimensions = jest.fn(() => ({ width: 900, height: 800, scale: 1, fontScale: 1 }))

    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <MapPlaceBottomCard point={point} userLocation={null} onClose={jest.fn()} />,
      )
    })

    expect(tree.root.findAllByProps({ testID: 'map-place-bottom-card-scroll' }).length).toBe(0)
    expect(tree.root.findByProps({ testID: 'map-place-bottom-card' })).toBeTruthy()
  })
})
