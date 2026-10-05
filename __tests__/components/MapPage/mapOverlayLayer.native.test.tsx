/**
 * #2219 (device QA, Android 807 dp): «Моё местоположение» and «Искать в этой
 * области» over the native map pressed in JS AND let the WebView place a route
 * point under them. Android dispatches the native touch to siblings by Z
 * (elevation) before index (`ViewGroup.buildTouchDispatchChildList`), React picks
 * the JS target by zIndex: the map surface (elevation 8) out-ranked the buttons
 * (shadow elevation 2) for the native touch.
 *
 * Invariant (`MapOverlayLayer`): every interactive node over the map in the map
 * area is inside the overlay layer; the layer is the last child of the map area;
 * neither the layer nor the map surface carries elevation. This test fails on an
 * overlay control placed outside the layer, a layer moved before the map, or an
 * elevation returned to the map surface.
 */
import React from 'react'
import { Platform, StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'

jest.mock('@/components/MapPage/MapLoadingBar', () => ({ __esModule: true, MapLoadingBar: () => null }))
jest.mock('@/components/MapPage/MapPageSkeleton', () => ({ __esModule: true, MapPageSkeleton: () => null }))
jest.mock('@/components/MapPage/Map', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { __esModule: true, default: () => React.createElement(View, { testID: 'native-map' }) }
})
jest.mock('@/components/MapPage/MapRouteEngine', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/MapPage/MapPanel', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { __esModule: true, default: () => React.createElement(View, { testID: 'map-panel-stub' }) }
})

const isInteractive = (node: any) =>
  typeof node?.props?.onClick === 'function' ||
  typeof node?.props?.onResponderRelease === 'function' ||
  typeof node?.props?.onPress === 'function'

const collect = (node: any, out: any[] = [], insideLayer = false): any[] => {
  if (!node || typeof node !== 'object') return out
  const inLayer = insideLayer || node.props?.testID === 'map-overlay-layer'
  if (isInteractive(node)) out.push({ testID: node.props?.testID ?? node.props?.accessibilityLabel, inLayer })
  for (const kid of node.children ?? []) collect(kid, out, inLayer)
  return out
}

const baseProps = {
  styles: {
    mapArea: {},
    locationQualityPill: {},
    locationQualityText: {},
    geoBanner: {},
    geoBannerText: {},
    geoBannerActionPrimary: {},
    geoBannerActionPrimaryText: {},
    geoBannerActionSecondary: {},
    geoBannerActionSecondaryText: {},
    geoBannerClose: {},
    desktopSearchAreaBand: {},
    desktopSearchAreaButton: {},
    desktopSearchAreaButtonText: {},
  },
  themedColors: { primary: '#000', textMuted: '#666', warning: '#b45309', textOnPrimary: '#fff' },
  isWeb: false,
  showProgress: false,
  mapReady: true,
  mapPanelProps: { mode: 'route' },
  dismissGeoBanner: jest.fn(),
  retryLocation: jest.fn(),
  openLocationSettings: jest.fn(),
  startManualRoute: jest.fn(),
  onCenterUser: jest.fn(),
  coordinatesSource: 'default' as const,
}

describe.each(['ios', 'android'] as const)('controls over the native map on %s (#2219)', (os) => {
  const originalOS = Platform.OS
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: os })
  })
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS })
  })

  const renderCanvas = (props: Record<string, unknown>) => {
    const { MapCanvas } = require('@/components/MapPage/MapCanvas')
    return render(<MapCanvas {...baseProps} {...props} />)
  }

  const assertLayerInvariant = (utils: ReturnType<typeof render>, expected: string[]) => {
    const root = utils.toJSON() as any
    const kids = (root.children ?? []) as any[]
    const layerIndex = kids.findIndex((kid) => kid?.props?.testID === 'map-overlay-layer')
    const mapIndex = kids.findIndex((kid) => kid?.props?.testID === 'map-panel-stub')
    expect(mapIndex).toBeGreaterThanOrEqual(0)
    // The layer is the last child of the map area — after the map.
    expect(layerIndex).toBe(kids.length - 1)
    expect(layerIndex).toBeGreaterThan(mapIndex)
    expect(StyleSheet.flatten(kids[layerIndex].props.style)?.elevation).toBeUndefined()
    expect(kids[layerIndex].props.pointerEvents).toBe('box-none')

    const interactive = collect(root)
    for (const testID of expected) {
      expect(interactive.map((node) => node.testID)).toContain(testID)
    }
    expect(interactive.filter((node) => !node.inLayer)).toEqual([])
  }

  it('tablet: «Искать в этой области» and «Моё местоположение» live in the overlay layer', () => {
    const utils = renderCanvas({
      isMobile: false,
      canSearchThisArea: true,
      onSearchThisArea: jest.fn(),
      locationState: { status: 'current', coordinates: null, accuracy: 500, timestamp: Date.now(), canAskAgain: true },
      showGeoBanner: false,
    })
    assertLayerInvariant(utils, ['map-search-this-area-desktop', 'map-desktop-locate-button'])
  })

  it('phone: the geo banner actions live in the overlay layer too', () => {
    const utils = renderCanvas({
      isMobile: true,
      locationState: { status: 'denied', coordinates: null, accuracy: null, timestamp: null, canAskAgain: true },
      showGeoBanner: true,
    })
    const interactive = collect(utils.toJSON())
    expect(interactive.length).toBeGreaterThan(0)
    assertLayerInvariant(utils, [])
  })

  it('the map surface itself carries no elevation (native MapPanel root)', () => {
    const ActualMapPanel = jest.requireActual('@/components/MapPage/MapPanel').default
    const utils = render(
      <ActualMapPanel
        travelsData={[]}
        coordinates={{ latitude: 53.9, longitude: 27.56 }}
        mode="radius"
        setRouteDistance={jest.fn()}
        setFullRouteCoords={jest.fn()}
      />,
    )
    const root = utils.toJSON() as any
    const surface = Array.isArray(root) ? root[0] : root
    expect(StyleSheet.flatten(surface.props.style)?.elevation).toBeUndefined()
    expect(utils.getByTestId('native-map')).toBeTruthy()
  })
})

