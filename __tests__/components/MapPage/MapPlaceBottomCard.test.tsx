import { getOnlyHost } from '@/__tests__/helpers/hostQueries'
import React from 'react'
import { Platform, StyleSheet } from 'react-native'
import { createRootRegistry } from '@/__tests__/helpers/rawRootLifecycle'

const renderer = createRootRegistry()

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

  afterEach(async () => {
    await renderer.cleanup()
    require('react-native').useWindowDimensions = originalUseWindowDimensions
  })

  it('renders a bounded bottom sheet on mobile web so the map stays visible', async () => {
    require('react-native').useWindowDimensions = jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 }))

    let tree: any
    await React.act(() => {
      tree = renderer.createRoot();
      tree.render(<MapPlaceBottomCard point={point} userLocation={null} onClose={jest.fn()} />)
    })

    // The mobile web card is now a bounded maps.me-style sheet; the popup content
    // owns its split scrolling region instead of this wrapper adding a ScrollView.
    expect(getOnlyHost(tree.container, (node: any) => node.props?.["testID"] === 'map-place-bottom-card')).toBeTruthy()
    expect(tree.container.queryAll((node: any) => node.props?.["testID"] === 'map-place-bottom-card-scroll', { includeSelf: true }).length).toBe(0)
    // Close button is present and reachable.
    const close = getOnlyHost(tree.container, (node: any) => node.props?.["testID"] === 'map-place-bottom-card-close')
    expect(close).toBeTruthy()
    expect(getOnlyHost(tree.container, (node: any) => node.props?.["testID"] === 'mock-popup-content')).toBeTruthy()
  })

  it('sizes mobile web sheet to the measured viewport and the bottom footer edge', async () => {
    require('react-native').useWindowDimensions = jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 }))

    let tree: any
    await React.act(() => {
      tree = renderer.createRoot();
      tree.render(<MapPlaceBottomCard
          point={point}
          userLocation={null}
          onClose={jest.fn()}
          topInset={20}
          bottomInset={56}
        />)
    })

    const sheet = tree.container.queryAll((node: any) => node.type === 'View', { includeSelf: true }).find((node: any) => {
      const style = StyleSheet.flatten(node.props.style)
      return style?.height === 'calc(var(--metravel-map-vh, 100svh) - 76px)'
    })
    const sheetStyle = StyleSheet.flatten(sheet?.props.style)

    expect(sheetStyle?.maxHeight).toBe('calc(var(--metravel-map-vh, 100svh) - 76px)')
    expect(sheetStyle?.marginTop).toBe(20)
    expect(sheetStyle?.marginBottom).toBe(56)
  })

  it('calls onClose from the fullscreen close button', async () => {
    require('react-native').useWindowDimensions = jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 }))
    const onClose = jest.fn()

    let tree: any
    await React.act(() => {
      tree = renderer.createRoot();
      tree.render(<MapPlaceBottomCard point={point} userLocation={null} onClose={onClose} />)
    })

    const close = getOnlyHost(tree.container, (node: any) => node.props?.["testID"] === 'map-place-bottom-card-close')
    await React.act(() => {
      close.props.onPress()
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on pointerup before WebKit drops touchend and suppresses the ghost click', async () => {
    require('react-native').useWindowDimensions = jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 }))
    const onClose = jest.fn()

    let tree: any
    await React.act(() => {
      tree = renderer.createRoot();
      tree.render(<MapPlaceBottomCard point={point} userLocation={null} onClose={onClose} />)
    })

    const close = getOnlyHost(tree.container, (node: any) => node.props?.["testID"] === 'map-place-bottom-card-close')
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      nativeEvent: {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn(),
      },
    }

    await React.act(() => {
      close.props.onPointerDown(event)
      close.props.onPointerUp(event)
      // Some WebKit versions still deliver these after pointerup. They must be
      // harmless when the same physical tap has already closed the card.
      close.props.onTouchEnd(event)
      close.props.onPress()
    })

    expect(event.preventDefault).toHaveBeenCalledTimes(3)
    expect(event.nativeEvent.preventDefault).toHaveBeenCalledTimes(3)
    expect(event.nativeEvent.stopImmediatePropagation).toHaveBeenCalledTimes(3)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('swallows only the closing gesture ghost click; the next gesture at the same point gets its click (#2813)', async () => {
    require('react-native').useWindowDimensions = jest.fn(() => ({ width: 390, height: 844, scale: 1, fontScale: 1 }))

    let tree: any
    await React.act(() => {
      tree = renderer.createRoot();
      tree.render(<MapPlaceBottomCard point={point} userLocation={null} onClose={jest.fn()} />)
    })
    const close = getOnlyHost(tree.container, (node: any) => node.props?.["testID"] === 'map-place-bottom-card-close')
    const tap = { clientX: 360, clientY: 120 }
    const closeEvent = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      nativeEvent: { ...tap, preventDefault: jest.fn(), stopPropagation: jest.fn(), stopImmediatePropagation: jest.fn() },
    }
    const onDocumentClick = jest.fn()
    document.addEventListener('click', onDocumentClick)
    const clickAtTap = () => {
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, ...tap })
      document.body.dispatchEvent(click)
      return click
    }

    try {
      // Touch: the guard is armed twice (pointerup + touchend).
      await React.act(() => {
        close.props.onPointerUp(closeEvent)
        close.props.onTouchEnd(closeEvent)
      })
      expect(clickAtTap().defaultPrevented).toBe(true)
      expect(onDocumentClick).not.toHaveBeenCalled()

      // A new gesture starts: no ghost click of the closing tap can follow, so a
      // deliberate tap at the same point (e.g. «Маршрут» in the top toolbar) passes.
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      expect(clickAtTap().defaultPrevented).toBe(false)
      expect(onDocumentClick).toHaveBeenCalledTimes(1)
    } finally {
      document.removeEventListener('click', onDocumentClick)
    }
  })

  it('keeps the compact bottom-sheet (no extra ScrollView) on wider viewports', async () => {
    require('react-native').useWindowDimensions = jest.fn(() => ({ width: 900, height: 800, scale: 1, fontScale: 1 }))

    let tree: any
    await React.act(() => {
      tree = renderer.createRoot();
      tree.render(<MapPlaceBottomCard point={point} userLocation={null} onClose={jest.fn()} />)
    })

    expect(tree.container.queryAll((node: any) => node.props?.["testID"] === 'map-place-bottom-card-scroll', { includeSelf: true }).length).toBe(0)
    expect(getOnlyHost(tree.container, (node: any) => node.props?.["testID"] === 'map-place-bottom-card')).toBeTruthy()
  })
})
