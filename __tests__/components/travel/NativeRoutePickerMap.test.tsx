import React from 'react'
import { StyleSheet, useWindowDimensions } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

import {
  resolveRoutePickerMapHeight,
  ROUTE_PICKER_MAP_HEIGHT_MAX,
  ROUTE_PICKER_MAP_HEIGHT_MIN,
} from '@/components/travel/stepRoute/helpers'
import {
  NativeRoutePickerMap,
  type NativeRoutePickerMapHandle,
} from '@/components/travel/stepRoute/NativeRoutePickerMap'

const mockInjectJavaScript = jest.fn()


// Общий мок из `__tests__/setup.ts` — функциональный компонент без ref, поэтому
// `webViewRef.current` там всегда null и мост RN → WebView не наблюдаем.
// #1722 добавил кнопку, которая ходит именно через мост, — подменяем мок на
// forwardRef, чтобы проверять сам вызов, а не «ничего не упало».
jest.mock('react-native-webview', () => {
  const ReactModule = require('react')
  const RN = require('react-native')

  const WebView = ReactModule.forwardRef(function WebView(props: any, ref: any) {
    ReactModule.useImperativeHandle(ref, () => ({ injectJavaScript: mockInjectJavaScript }), [])
    return ReactModule.createElement(RN.View, props)
  })

  return { __esModule: true, WebView, default: WebView }
})

describe('NativeRoutePickerMap', () => {
  beforeEach(() => {
    mockInjectJavaScript.mockClear()
  })

  const renderMap = (ref?: React.Ref<NativeRoutePickerMapHandle>) =>
    render(
      <NativeRoutePickerMap
        ref={ref}
        markers={[]}
        onAddPoint={jest.fn()}
        onMovePoint={jest.fn()}
        onSelectPoint={jest.fn()}
      />,
    )

  it('stacks the hint above a full-width primary add action on narrow native screens', () => {
    const screen = renderMap()

    expect(StyleSheet.flatten(screen.getByTestId('travel-wizard.step-route.native-map-controls').props.style))
      .toEqual(expect.objectContaining({
        flexDirection: 'column',
        alignItems: 'stretch',
      }))

    const addButton = screen.getByTestId('travel-wizard.step-route.add-point')
    const resolvedAddStyle = typeof addButton.props.style === 'function'
      ? addButton.props.style({ pressed: false })
      : addButton.props.style

    expect(StyleSheet.flatten(resolvedAddStyle)).toEqual(expect.objectContaining({
      flex: 1,
      justifyContent: 'center',
    }))
  })

  // Главная регрессия #1722: подсказка и действия были ПОДВАЛОМ под полотном в
  // 380 пт, поэтому на 375×812 в видимую полосу шага не попадал ни один способ
  // добавить точку — тестировщик видел только карту. Порядок узлов и есть фикс.
  it('renders the controls before the map canvas so both fit one screen', () => {
    const screen = renderMap()

    const rendered = JSON.stringify(screen.toJSON())
    const controlsIndex = rendered.indexOf('travel-wizard.step-route.native-map-controls')
    const canvasIndex = rendered.indexOf('travel-wizard.step-route.native-map-canvas')

    expect(controlsIndex).toBeGreaterThanOrEqual(0)
    expect(canvasIndex).toBeGreaterThanOrEqual(0)
    expect(controlsIndex).toBeLessThan(canvasIndex)
  })

  it('adds a point at the map centre through the existing POINT_ADD bridge', () => {
    const screen = renderMap()

    fireEvent.press(screen.getByTestId('travel-wizard.step-route.add-point'))

    expect(mockInjectJavaScript).toHaveBeenCalledWith('window.__mtRouteAddCenterPoint();true;')
  })

  // Тот же путь отдан наружу: у списка точек под картой своя кнопка, и она
  // обязана вести не в копию логики, а ровно сюда.
  it('exposes addPointAtCenter to the point list below the map', () => {
    const ref = React.createRef<NativeRoutePickerMapHandle>()
    renderMap(ref)

    ref.current?.addPointAtCenter()

    expect(mockInjectJavaScript).toHaveBeenCalledWith('window.__mtRouteAddCenterPoint();true;')
  })

  // Высоту окна в jsdom задаёт среда, а не мы, поэтому сверяем не с числом, а с
  // тем, что даёт формула на фактическом окне: проверяется именно связь полотна
  // с окном. Сами числа формулы закреплены отдельным блоком ниже.
  it('sizes the canvas from the window instead of a fixed 380pt', () => {
    let observedWindowHeight = 0
    function WindowProbe() {
      observedWindowHeight = useWindowDimensions().height
      return null
    }
    render(<WindowProbe />)

    const screen = renderMap()
    const canvas = screen.getByTestId('travel-wizard.step-route.native-map-canvas')

    expect(observedWindowHeight).toBeGreaterThan(0)
    expect(StyleSheet.flatten(canvas.props.style)).toEqual(
      expect.objectContaining({ height: resolveRoutePickerMapHeight(observedWindowHeight) }),
    )
  })
})

describe('resolveRoutePickerMapHeight', () => {
  // iPhone 12/13 mini — экран из отчёта тестировщика: видимая полоса шага ~420 пт,
  // и прежние 380 не оставляли места ни подсказке, ни кнопкам.
  it('leaves room for the controls on a 812pt screen', () => {
    const height = resolveRoutePickerMapHeight(812)

    expect(height).toBe(276)
    expect(height + 140).toBeLessThanOrEqual(420)
  })

  it('keeps the previous canvas on tall screens', () => {
    expect(resolveRoutePickerMapHeight(1366)).toBe(ROUTE_PICKER_MAP_HEIGHT_MAX)
  })

  it('never collapses the canvas on short screens', () => {
    expect(resolveRoutePickerMapHeight(560)).toBe(ROUTE_PICKER_MAP_HEIGHT_MIN)
  })

  it('falls back to the maximum when the window size is unknown', () => {
    expect(resolveRoutePickerMapHeight(0)).toBe(ROUTE_PICKER_MAP_HEIGHT_MAX)
    expect(resolveRoutePickerMapHeight(Number.NaN)).toBe(ROUTE_PICKER_MAP_HEIGHT_MAX)
  })
})
