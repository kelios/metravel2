import React from 'react'
import { PanResponder, Platform, StyleSheet } from 'react-native'

const renderer = require('react-test-renderer')
const originalUseWindowDimensions = require('react-native').useWindowDimensions
require('react-native').useWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}))

const mockCreatePopupArgs: any[] = []
const mockPanResponderConfigs: any[] = []
const originalPanResponderCreate = PanResponder.create.bind(PanResponder)
const panResponderCreateSpy = jest
  .spyOn(PanResponder, 'create')
  .mockImplementation((config: any) => {
    mockPanResponderConfigs.push(config)
    return originalPanResponderCreate(config)
  })

jest.mock('@/components/MapPage/Map/createMapPopupComponent', () => ({
  __esModule: true,
  createMapPopupComponent: (args: any) => {
    mockCreatePopupArgs.push(args)
    return (
    function MockPopup() {
      const React = require('react')
      const { Text } = require('react-native')
      return React.createElement(Text, { testID: 'mock-popup-content' }, 'content')
    })
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
    backgroundSecondary: '#f0f0f0',
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
    require('react-native').useWindowDimensions = originalUseWindowDimensions
    panResponderCreateSpy.mockRestore()
  })

  beforeEach(() => {
    mockCreatePopupArgs.length = 0
    mockPanResponderConfigs.length = 0
  })

  it('renders a bottom-anchored content-sized sheet over a soft backdrop', () => {
    const onClose = jest.fn()
    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <MapPlaceBottomCard
          point={point}
          userLocation={null}
          onClose={onClose}
          bottomInset={72}
          topInset={116}
        />,
      )
    })

    // Root: absolute-fill, bottom-anchored (the sheet sits at the bottom over the map).
    const root = tree.root.findByProps({ testID: 'map-place-bottom-card' })
    const rootStyle = StyleSheet.flatten(root.props.style)
    expect(rootStyle.justifyContent).toBe('flex-end')
    expect(rootStyle.top).toBe(0)
    expect(rootStyle.bottom).toBe(0)
    expect(root.props.pointerEvents).toBe('auto')
    expect(rootStyle.zIndex).toBeGreaterThan(18)
    expect(rootStyle.elevation).toBe(rootStyle.zIndex)

    // Backdrop closes on tap and uses the exact soft scrim color.
    const backdrop = tree.root.findByProps({ testID: 'map-place-bottom-card-backdrop' })
    const backdropStyle = StyleSheet.flatten(backdrop.props.style)
    expect(backdropStyle.backgroundColor).toBe('rgba(15, 23, 42, 0.18)')
    renderer.act(() => {
      backdrop.props.onTouchEnd()
      backdrop.props.onPress()
    })
    // Raw touch-end + Pressability release are one physical gesture.
    expect(onClose).toHaveBeenCalledTimes(1)

    // Panel caps at nativeSheetMaxHeight and clears the bottom chrome.
    // bottomChromeInset = 72 + safe.bottom(8) = 80
    // nativeSheetMaxHeight = round(max(360, 844 - 80 - safe.top(24) - 12)) = 728
    expect(tree.root.findByProps({ testID: 'map-place-bottom-card-close' })).toBeTruthy()
    const { View } = require('react-native')
    const panel = tree.root.findAll(
      (node: any) =>
        node.type === View &&
        StyleSheet.flatten(node.props.style)?.maxHeight === 728,
    )[0]
    const panelStyle = StyleSheet.flatten(panel.props.style)
    expect(panelStyle.maxHeight).toBe(728)
    // Panel sits flush on the dock: bottomChromeInset(80) − DOCK_BREATHING_GAP(16) = 64.
    expect(panelStyle.marginBottom).toBe(64)

    // Hero-caption relayout — title/address/coords live ON the photo, so below the
    // hero only the status row + 4-icon action row remain (reserve 414 → 224) and
    // the hero grows: max(180, min(round(844*0.56)=473, 728-224=504)) = 473.
    expect(mockCreatePopupArgs[0]?.bottomCardImageHeight).toBe(473)
    expect(mockCreatePopupArgs[0]?.shareInActionRow).toBe(true)

    // Budget guard: after the header row (~40) and the hero, the panel must still
    // leave room for the status row + full action row (≈192px measured) so they are
    // not forced into the ScrollView overflow on the standard 390×844 screen.
    const HANDLE_ROW = 40
    const heroHeight = mockCreatePopupArgs[0]?.bottomCardImageHeight as number
    expect(728 - HANDLE_ROW - heroHeight).toBeGreaterThanOrEqual(200)

    // One content-driven ScrollView fallback for tall content.
    const scrolls = tree.root.findAllByType(require('react-native').ScrollView)
    expect(scrolls.length).toBe(1)
    const contentStyle = StyleSheet.flatten(scrolls[0].props.contentContainerStyle)
    expect(contentStyle.paddingBottom).toBe(12)
  })

  it('captures a downward handle drag before native children and keeps the responder', () => {
    const onClose = jest.fn()
    let tree: any
    renderer.act(() => {
      tree = renderer.create(
        <MapPlaceBottomCard
          point={point}
          userLocation={null}
          onClose={onClose}
        />,
      )
    })

    expect(tree.root.findByProps({ testID: 'map-place-bottom-card' })).toBeTruthy()
    const responderConfig = mockPanResponderConfigs.at(-1)
    expect(responderConfig.onMoveShouldSetPanResponderCapture).toEqual(expect.any(Function))
    expect(responderConfig.onMoveShouldSetPanResponderCapture({}, { dy: 12, dx: 1 })).toBe(true)
    expect(responderConfig.onPanResponderTerminationRequest()).toBe(false)
    expect(responderConfig.onShouldBlockNativeResponder()).toBe(true)
    renderer.act(() => {
      responderConfig.onPanResponderTerminate({}, { dy: 120, dx: 1 })
    })
    expect(onClose).not.toHaveBeenCalled()
    renderer.act(() => {
      responderConfig.onPanResponderRelease({}, { dy: 65, dx: 1 })
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
