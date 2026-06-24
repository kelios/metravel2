import { StyleSheet } from 'react-native'
import { render, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'

import TravelDescription from '@/components/travel/TravelDescription'

jest.mock('@/components/travel/StableContent', () => {
  const { Text } = require('react-native')
  return function MockStableContent() {
    return <Text testID="stable-content">stable-content</Text>
  }
})

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    textMuted: '#666',
    borderLight: '#ddd',
    surface: '#fff',
  }),
}))

describe('TravelDescription', () => {
  const originalOS = Platform.OS

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
    jest.restoreAllMocks()
    delete (window as any).requestAnimationFrame
    delete (window as any).cancelAnimationFrame
    delete (window as any).requestIdleCallback
    delete (window as any).cancelIdleCallback
  })

  it('uses the full section width on desktop when noBox is enabled', () => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    })

    const { getByTestId } = render(
      <TravelDescription htmlContent="<p>Описание</p>" noBox />
    )

    const container = getByTestId('travel-description')
    const style = StyleSheet.flatten(container.props.style)

    expect(style.maxWidth).toBeUndefined()
    expect(style.paddingHorizontal).toBe(0)
  })

  it('keeps the default constrained layout without noBox', () => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    })

    const { getByTestId } = render(
      <TravelDescription htmlContent="<p>Описание</p>" />
    )

    const container = getByTestId('travel-description')
    const style = StyleSheet.flatten(container.props.style)

    expect(style.maxWidth).toBe(760)
  })

  it('renders short web descriptions without rAF or idle delay', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    const requestAnimationFrame = jest.fn()
    const requestIdleCallback = jest.fn()
    ;(window as any).requestAnimationFrame = requestAnimationFrame
    ;(window as any).cancelAnimationFrame = jest.fn()
    ;(window as any).requestIdleCallback = requestIdleCallback
    ;(window as any).cancelIdleCallback = jest.fn()

    const { getByTestId } = render(
      <TravelDescription htmlContent="<p>Короткое описание маршрута.</p>" noBox />
    )

    await waitFor(() => {
      expect(getByTestId('stable-content')).toBeTruthy()
    })
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    expect(requestIdleCallback).not.toHaveBeenCalled()
  })

  it('reserves height and keeps idle gate for heavy web descriptions', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 760,
      height: 900,
      scale: 1,
      fontScale: 1,
    })
    const rafCallbacks: Array<() => void> = []
    const requestAnimationFrame = jest.fn((cb: () => void) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    ;(window as any).requestAnimationFrame = requestAnimationFrame
    ;(window as any).cancelAnimationFrame = jest.fn()
    ;(window as any).requestIdleCallback = jest.fn()
    ;(window as any).cancelIdleCallback = jest.fn()

    const heavyText = 'длинное описание '.repeat(600)
    const { getByTestId, queryByTestId } = render(
      <TravelDescription htmlContent={`<p>${heavyText}</p>`} noBox />
    )

    expect(queryByTestId('stable-content')).toBeNull()

    const style = StyleSheet.flatten(getByTestId('travel-description-fallback').props.style)
    expect(style.minHeight).toBeGreaterThan(320)

    expect(requestAnimationFrame).toHaveBeenCalled()
    while (rafCallbacks.length > 0) {
      const cb = rafCallbacks.shift()
      cb?.()
    }
    expect((window as any).requestIdleCallback).toHaveBeenCalled()
  })
})
