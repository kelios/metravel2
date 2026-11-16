import type { ComponentProps } from 'react'
import type { Root } from 'react-dom/client'
import type { View, ViewProps } from 'react-native'

let React: typeof import('react')
let createRoot: typeof import('react-dom/client').createRoot
let Profile: typeof import('@/components/travel/details/sections/RouteElevationProfile').default
let buildCriticalCSS: typeof import('@/utils/criticalCSSBuilder').buildCriticalCSS
let onProfileLayout: ComponentProps<typeof View>['onLayout']

beforeAll(() => {
  jest.resetModules()
  React = require('react')
  jest.doMock('react-native', () => {
    const actual = jest.requireActual('react-native-web')
    return {
      ...actual,
      View: React.forwardRef<HTMLDivElement, ViewProps>((props, ref) => {
        if (props.testID === 'route-elevation-profile') onProfileLayout = props.onLayout
        return React.createElement(actual.View, { ...props, ref })
      }),
    }
  })
  // Real DOM SVG, rather than the regular native-View Jest SVG stand-in.
  jest.doMock('react-native-svg', () => {
    const elements = jest.requireActual('react-native-svg/lib/commonjs/elements.web')
    return { ...elements, __esModule: true, default: elements.Svg }
  })
  jest.doMock('@expo/vector-icons/Feather', () => () => null)
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => ({}) }))
  jest.doMock('@/hooks/useResponsive', () => ({ useResponsiveWidth: () => 390 }))
  jest.doMock('@/i18n', () => ({ translate: (key: string) => key }))
  ;({ createRoot } = require('react-dom/client'))
  Profile = require('@/components/travel/details/sections/RouteElevationProfile').default
  ;({ buildCriticalCSS } = require('@/utils/criticalCSSBuilder'))
})

it('keeps the chart box height when the real SVG replaces its reserve under critical media CSS', async () => {
  const mount = document.createElement('div')
  const critical = document.createElement('style')
  critical.textContent = buildCriticalCSS()
  document.head.append(critical)
  document.body.append(mount)
  let root: Root | undefined
  try {
    await React.act(async () => {
      root = createRoot(mount)
      root.render(React.createElement(Profile, { preview: {
        linePoints: [{ coord: '53.9,27.56', elevation: 100 }, { coord: '53.91,27.57', elevation: 200 }],
        elevationProfile: [{ distanceKm: 0, elevationM: 100 }, { distanceKm: 1.4, elevationM: 200 }],
      } }))
    })
    const reserve = mount.querySelector<HTMLElement>('[data-testid="route-elevation-chart-reserve"]')!
    const reservedHeight = getComputedStyle(reserve).height
    expect(reservedHeight).toBe('120px')
    await React.act(async () => onProfileLayout?.({ nativeEvent: { layout: { x: 0, y: 0, width: 370, height: 511 } } } as Parameters<NonNullable<typeof onProfileLayout>>[0]))
    const svg = mount.querySelector('svg')!
    expect(svg).toBeInstanceOf(SVGSVGElement)
    expect(svg.getAttribute('height')).toBe('120')
    // The global media reset has height:auto; an SVG attribute alone loses to it.
    expect(getComputedStyle(svg).height).toBe(reservedHeight)
    expect(mount.querySelector('[data-testid="route-elevation-chart-reserve"]')).toBeNull()
  } finally {
    await React.act(async () => root?.unmount())
    mount.remove()
    critical.remove()
  }
})
