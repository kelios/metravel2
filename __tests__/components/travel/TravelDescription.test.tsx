import { StyleSheet } from 'react-native'
import { act, render, waitFor } from '@testing-library/react-native'
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
    delete (window as any).IntersectionObserver
    jest.useRealTimers()
  })

  it('uses the full section width on desktop when noBox is enabled', async () => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    })

    const { getByTestId } = await render(
      <TravelDescription htmlContent="<p>Описание</p>" noBox />
    )

    const container = getByTestId('travel-description')
    const style = StyleSheet.flatten(container.props.style)

    expect(style.maxWidth).toBeUndefined()
    expect(style.paddingHorizontal).toBe(0)
  })

  it('keeps the default constrained layout without noBox', async () => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    })

    const { getByTestId } = await render(
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

    const { getByTestId } = await render(
      <TravelDescription htmlContent="<p>Короткое описание маршрута.</p>" noBox />
    )

    await waitFor(() => {
      expect(getByTestId('stable-content')).toBeTruthy()
    })
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    expect(requestIdleCallback).not.toHaveBeenCalled()
  })

  it('keeps noBox native content in the parent scroll chain', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })

    const { container: _hostContainer } = await render(
      <TravelDescription htmlContent="<p>Описание</p>" noBox />
    )

    expect(_hostContainer.queryAll(node => node.type === "RCTScrollView", { includeSelf: true })).toHaveLength(0)
  })

  it('keeps heavy web descriptions deferred until the placeholder approaches the viewport', async () => {
    jest.useFakeTimers()
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 760,
      height: 900,
      scale: 1,
      fontScale: 1,
    })
    let intersectionCallback:
      | ((entries: Array<{ isIntersecting?: boolean; intersectionRatio?: number }>) => void)
      | null = null
    const observe = jest.fn()
    const disconnect = jest.fn()
    const IntersectionObserver = jest.fn((callback: NonNullable<typeof intersectionCallback>) => {
      intersectionCallback = callback
      return { observe, disconnect }
    })
    const idleCallbacks: Array<() => void> = []
    const requestIdleCallback = jest.fn((callback: () => void) => {
      idleCallbacks.push(callback)
      return idleCallbacks.length
    })
    const cancelIdleCallback = jest.fn()
    ;(window as any).IntersectionObserver = IntersectionObserver
    ;(window as any).requestIdleCallback = requestIdleCallback
    ;(window as any).cancelIdleCallback = cancelIdleCallback

    const heavyText = 'длинное описание '.repeat(600)
    const { getByTestId, queryByTestId, unmount } = await render(
      <TravelDescription htmlContent={`<p>${heavyText}</p>`} noBox />
    )

    expect(queryByTestId('stable-content')).toBeNull()

    const style = StyleSheet.flatten(getByTestId('travel-description-fallback').props.style)
    expect(style.minHeight).toBeGreaterThan(320)

    expect(IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ rootMargin: '0px 0px 400px 0px', threshold: 0.01 }),
    )
    expect(observe).toHaveBeenCalledWith(expect.anything())

    await act(() => {
      jest.advanceTimersByTime(60_000)
    })
    expect(queryByTestId('stable-content')).toBeNull()
    expect(requestIdleCallback).not.toHaveBeenCalled()

    await act(() => {
      intersectionCallback?.([{ isIntersecting: false, intersectionRatio: 0 }])
    })
    expect(queryByTestId('stable-content')).toBeNull()
    expect(requestIdleCallback).not.toHaveBeenCalled()

    await act(() => {
      intersectionCallback?.([{ isIntersecting: true, intersectionRatio: 0.1 }])
    })
    expect(requestIdleCallback).toHaveBeenCalledTimes(1)
    expect(queryByTestId('stable-content')).toBeNull()

    await act(async () => {
      idleCallbacks.shift()?.()
    })
    expect(getByTestId('stable-content')).toBeTruthy()

    await unmount()
    expect(disconnect).toHaveBeenCalled()
    expect(cancelIdleCallback).toHaveBeenCalled()
  })

  it('fails open through idle when IntersectionObserver is unavailable', async () => {
    jest.useFakeTimers()
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    const idleCallbacks: Array<() => void> = []
    const requestIdleCallback = jest.fn((callback: () => void) => {
      idleCallbacks.push(callback)
      return idleCallbacks.length
    })
    ;(window as any).requestIdleCallback = requestIdleCallback
    ;(window as any).cancelIdleCallback = jest.fn()

    const heavyText = 'длинное описание '.repeat(600)
    const { getByTestId, queryByTestId } = await render(
      <TravelDescription htmlContent={`<p>${heavyText}</p>`} noBox />
    )

    expect(queryByTestId('stable-content')).toBeNull()
    expect(requestIdleCallback).toHaveBeenCalledTimes(1)

    await act(async () => {
      idleCallbacks.shift()?.()
    })
    expect(getByTestId('stable-content')).toBeTruthy()
  })

  it('fails open through idle when IntersectionObserver throws', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    const idleCallbacks: Array<() => void> = []
    const requestIdleCallback = jest.fn((callback: () => void) => {
      idleCallbacks.push(callback)
      return idleCallbacks.length
    })
    ;(window as any).IntersectionObserver = jest.fn(() => {
      throw new Error('observer unavailable')
    })
    ;(window as any).requestIdleCallback = requestIdleCallback
    ;(window as any).cancelIdleCallback = jest.fn()

    const heavyText = 'длинное описание '.repeat(600)
    const { getByTestId, queryByTestId } = await render(
      <TravelDescription htmlContent={`<p>${heavyText}</p>`} noBox />
    )

    expect(queryByTestId('stable-content')).toBeNull()
    expect(requestIdleCallback).toHaveBeenCalledTimes(1)

    await act(async () => {
      idleCallbacks.shift()?.()
    })
    expect(getByTestId('stable-content')).toBeTruthy()
  })

  it('retries a throwing observe 20 times before failing open through idle', async () => {
    jest.useFakeTimers()
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    const observe = jest.fn(() => {
      throw new Error('target unavailable')
    })
    const disconnect = jest.fn()
    ;(window as any).IntersectionObserver = jest.fn(() => ({ observe, disconnect }))
    const idleCallbacks: Array<() => void> = []
    const requestIdleCallback = jest.fn((callback: () => void) => {
      idleCallbacks.push(callback)
      return idleCallbacks.length
    })
    ;(window as any).requestIdleCallback = requestIdleCallback
    ;(window as any).cancelIdleCallback = jest.fn()

    const heavyText = 'длинное описание '.repeat(600)
    const { getByTestId, queryByTestId } = await render(
      <TravelDescription htmlContent={`<p>${heavyText}</p>`} noBox />
    )

    expect(observe).toHaveBeenCalledTimes(1)
    expect(queryByTestId('stable-content')).toBeNull()

    await act(() => {
      jest.advanceTimersByTime(949)
    })
    expect(observe).toHaveBeenCalledTimes(20)
    expect(requestIdleCallback).not.toHaveBeenCalled()

    await act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(observe).toHaveBeenCalledTimes(21)
    expect(disconnect).toHaveBeenCalledTimes(21)
    expect(requestIdleCallback).toHaveBeenCalledTimes(1)
    expect(queryByTestId('stable-content')).toBeNull()

    await act(async () => {
      idleCallbacks.shift()?.()
    })
    expect(getByTestId('stable-content')).toBeTruthy()
  })

  it('cancels a pending observe retry on unmount without scheduling reveal', async () => {
    jest.useFakeTimers()
    const schedule = jest.spyOn(globalThis, 'setTimeout')
    const cancel = jest.spyOn(globalThis, 'clearTimeout')
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    const observe = jest.fn(() => {
      throw new Error('target unavailable')
    })
    const disconnect = jest.fn()
    ;(window as any).IntersectionObserver = jest.fn(() => ({ observe, disconnect }))
    const requestIdleCallback = jest.fn()
    ;(window as any).requestIdleCallback = requestIdleCallback
    ;(window as any).cancelIdleCallback = jest.fn()

    const heavyText = 'длинное описание '.repeat(600)
    const { queryByTestId, unmount } = await render(
      <TravelDescription htmlContent={`<p>${heavyText}</p>`} noBox />
    )

    expect(observe).toHaveBeenCalledTimes(1)
    expect(queryByTestId('stable-content')).toBeNull()
    const retries = schedule.mock.calls.flatMap(([callback], index) =>
      typeof callback === 'function' && callback.name === 'retryAttach' ? [schedule.mock.results[index].value] : [],
    )
    expect(retries).toHaveLength(1)

    await unmount()
    expect(cancel).toHaveBeenCalledWith(retries[0])

    await act(() => {
      jest.advanceTimersByTime(5_000)
    })
    expect(observe).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(requestIdleCallback).not.toHaveBeenCalled()
  })
})
