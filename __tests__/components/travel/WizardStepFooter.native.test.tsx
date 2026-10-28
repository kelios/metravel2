import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Animated, Keyboard, Platform, StyleSheet, View, useWindowDimensions, type KeyboardEvent, type ViewProps } from 'react-native'
import Toast from 'react-native-toast-message'

import { BottomChromeInsetProvider } from '@/components/layout/bottomChromeInset'
import ToastHost from '@/components/ui/ToastHost'
import { WizardStepFooter } from '@/components/travel/upsert/WizardStepFooter'
import { TOAST_DOCK_GAP } from '@/utils/toast.native'

let mockFocused = true
let mockMobile = true
let mockInsets = { top: 0, bottom: 24, left: 0, right: 0 }
let mockRealToast = false
const mockToastProps: Array<Record<string, unknown>> = []
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useEffect } = require('react')
    const focused = mockFocused
    useEffect(() => focused ? callback() : undefined, [callback, focused])
  },
}))
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isHydrated: true, isMobile: mockMobile, isTablet: false }),
}))
jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({ useSafeAreaInsetsSafe: () => mockInsets }))
jest.mock('@/components/ui/Button', () => {
  const { Pressable, Text } = require('react-native')
  return { __esModule: true, default: ({ label, ...props }: { label: string }) => <Pressable {...props}><Text>{label}</Text></Pressable> }
})
jest.mock('react-native-toast-message', () => {
  const React = require('react')
  const actual = jest.requireActual('react-native-toast-message')
  const ToastMock = (props: Record<string, unknown>) => {
    mockToastProps.push(props)
    return mockRealToast ? React.createElement(actual.default, props) : null
  }
  ToastMock.hide = actual.default.hide
  ToastMock.show = actual.default.show
  return { ...actual, __esModule: true, default: ToastMock }
})

type Measurement = Parameters<View['measureInWindow']>[0]
const primary = jest.fn()
const positioningBottom = () => StyleSheet.flatten(screen.getByTestId('toast-positioning').props.style).bottom as number
const lastOffset = () => positioningBottom() + 10
const visibleToastBottom = () => {
  const animatedStyle = StyleSheet.flatten(screen.getByTestId('toastAnimatedContainer').props.style)
  const positioning = screen.queryByTestId('toast-positioning')
  const bottom = positioning ? StyleSheet.flatten(positioning.props.style).bottom : 0
  const translateY = animatedStyle.transform[0].translateY
  return bottom - (typeof translateY === 'number' ? translateY : translateY.__getValue())
}
function Scene({ footer = true, actions = true, modal = false }: { footer?: boolean; actions?: boolean; modal?: boolean }) {
  return (
    <BottomChromeInsetProvider measuredHeight={0}>
      {footer ? <WizardStepFooter onPrimary={actions ? () => primary() : undefined} primaryLabel="Next" /> : null}
      <ToastHost overDock={!modal} />
    </BottomChromeInsetProvider>
  )
}

describe('native wizard footer / toast measured-window contract', () => {
  const originalOS = Platform.OS
  let footerTop: number
  let hostBottom: number
  let deferFooter: boolean
  let deferHost: boolean
  let pendingFooter: Measurement[]
  let pendingHost: Measurement[]
  let dimensions: { width: number; height: number; scale: number; fontScale: number }
  let keyboardListeners: Map<string, Array<(event: KeyboardEvent) => void>>

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true })
    mockFocused = true
    mockRealToast = false
    mockMobile = true
    mockToastProps.length = 0
    mockInsets = { top: 0, bottom: 24, left: 0, right: 0 }
    footerTop = 1883
    hostBottom = 2220
    deferFooter = false
    deferHost = false
    pendingFooter = []
    pendingHost = []
    dimensions = { width: 1080, height: 2220, scale: 1, fontScale: 1 }
    keyboardListeners = new Map()
    jest.spyOn(Animated, 'spring').mockImplementation((value, config) => ({
      start: () => (value as Animated.Value).setValue(config.toValue as number),
      stop: jest.fn(),
      reset: jest.fn(),
    }))
    jest.spyOn(Keyboard, 'addListener').mockImplementation((name, callback) => {
      const callbacks = keyboardListeners.get(name) ?? []
      callbacks.push(callback)
      keyboardListeners.set(name, callbacks)
      return { remove: () => keyboardListeners.set(name, (keyboardListeners.get(name) ?? []).filter((listener) => listener !== callback)) }
    })
    jest.mocked(useWindowDimensions).mockImplementation(() => dimensions)
    jest.spyOn(require('expo-router'), 'useFocusEffect').mockImplementation((...args: unknown[]) => {
      const callback = args[0] as () => void | (() => void)
      const focused = mockFocused
      React.useEffect(() => focused ? callback() : undefined, [callback, focused])
    })
    jest.spyOn(View.prototype, 'measureInWindow').mockImplementation(function (this: React.Component<ViewProps>, callback: Measurement) {
      if (this.props.testID === 'toast-layer') {
        if (deferHost) pendingHost.push(callback)
        else callback(0, 0, 1080, hostBottom)
      } else if (this.props.testID === 'travel-wizard.step-footer') {
        if (deferFooter) pendingFooter.push(callback)
        else callback(0, footerTop, 1080, 271)
      }
    })
  })
  afterEach(() => {
    jest.restoreAllMocks()
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
  })

  it('reserves all 337px to the footer top, including the extra 66px below its 271px height', async () => {
    const view = await render(<Scene />)
    expect(lastOffset()).toBe(337 + TOAST_DOCK_GAP)
    expect(mockToastProps.at(-1)?.bottomOffset).toBe(0)
    expect(view.getByTestId('travel-wizard.step-footer').props.collapsable).toBe(false)
    expect(view.getByTestId('toast-layer').props.collapsable).toBe(false)
  })

  it('uses both measured coordinates rather than the window height, then remeasures on resize and layout', async () => {
    hostBottom = 2180
    const view = await render(<Scene />)
    expect(lastOffset()).toBe(297 + TOAST_DOCK_GAP)
    dimensions = { ...dimensions, width: 2220, height: 1080 }
    hostBottom = 1040
    footerTop = 800
    await view.rerender(<Scene />)
    expect(lastOffset()).toBe(240 + TOAST_DOCK_GAP)
    footerTop = 760
    await fireEvent(view.getByTestId('travel-wizard.step-footer'), 'layout')
    expect(lastOffset()).toBe(280 + TOAST_DOCK_GAP)
    hostBottom = 1020
    await fireEvent(view.getByTestId('toast-layer'), 'layout')
    expect(lastOffset()).toBe(260 + TOAST_DOCK_GAP)
  })

  it.each(['blur', 'desktop', 'no actions', 'unmount'] as const)('releases the footer on %s and rejects its late measurement', async (mode) => {
    const view = await render(<Scene />)
    expect(lastOffset()).toBe(337 + TOAST_DOCK_GAP)
    deferFooter = true
    await fireEvent(view.getByTestId('travel-wizard.step-footer'), 'layout')
    expect(pendingFooter).toHaveLength(1)
    if (mode === 'blur') mockFocused = false
    if (mode === 'desktop') mockMobile = false
    await view.rerender(<Scene footer={mode !== 'unmount'} actions={mode !== 'no actions'} />)
    expect(lastOffset()).toBe(24 + TOAST_DOCK_GAP)
    await act(() => pendingFooter[0](0, 1500, 1080, 271))
    expect(lastOffset()).toBe(24 + TOAST_DOCK_GAP)
  })

  it('ignores an old host measurement after resize and rejects callbacks after unmount', async () => {
    deferHost = true
    const view = await render(<Scene />)
    dimensions = { ...dimensions, height: 2100 }
    hostBottom = 2100
    deferHost = false
    await view.rerender(<Scene />)
    expect(lastOffset()).toBe(217 + TOAST_DOCK_GAP)
    await act(() => pendingHost[0](0, 0, 1080, 2220))
    expect(lastOffset()).toBe(217 + TOAST_DOCK_GAP)
    deferHost = true
    await fireEvent(view.getByTestId('toast-layer'), 'layout')
    await view.unmount()
    const count = mockToastProps.length
    await act(() => pendingHost.at(-1)?.(0, 0, 1080, 2220))
    expect(mockToastProps).toHaveLength(count)
  })

  it('keeps a fullscreen Modal over only its safe area despite an underlying registered footer', async () => {
    await render(<Scene modal />)
    expect(lastOffset()).toBe(24 + TOAST_DOCK_GAP)
  })

  it('repositions an already visible real-library toast after layout and resize without showing it again', async () => {
    mockRealToast = true
    const animatedContainer = jest.requireActual('react-native-toast-message/lib/src/components/AnimatedContainer')
    const containerSpy = jest.spyOn(animatedContainer, 'AnimatedContainer')
    const view = await render(<Scene />)
    await act(() => Toast.show({ type: 'info', text1: 'Visible feedback', autoHide: false }))
    expect(view.getByText('Visible feedback')).toBeTruthy()
    expect(visibleToastBottom()).toBe(349)
    footerTop = 1760
    await fireEvent(view.getByTestId('travel-wizard.step-footer'), 'layout')
    expect(visibleToastBottom()).toBe(472)
    dimensions = { ...dimensions, width: 2220, height: 1080 }
    hostBottom = 1040
    footerTop = 800
    await view.rerender(<Scene />)
    expect(visibleToastBottom()).toBe(252)
    expect(view.getByText('Visible feedback')).toBeTruthy()
    expect(containerSpy.mock.calls.at(-1)?.[0]).toMatchObject({ isVisible: true, bottomOffset: 0 })
  })

  it('preserves the real-library iOS maximum of chrome reserve and keyboard lift', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
    mockRealToast = true
    const view = await render(<Scene />)
    await act(() => Toast.show({ type: 'info', text1: 'Keyboard feedback', autoHide: false }))
    const showKeyboard = async (height: number) => await act(() => {
      keyboardListeners.get('keyboardDidShow')?.forEach((listener) => listener({ endCoordinates: { height } } as KeyboardEvent))
    })
    await showKeyboard(200)
    expect(visibleToastBottom()).toBe(349)
    await showKeyboard(400)
    expect(visibleToastBottom()).toBe(410)
    await act(() => keyboardListeners.get('keyboardDidHide')?.forEach((listener) => listener({} as KeyboardEvent)))
    expect(visibleToastBottom()).toBe(349)
    expect(view.getByText('Keyboard feedback')).toBeTruthy()
    await view.unmount()
    expect([...keyboardListeners.values()].every((listeners) => listeners.length === 0)).toBe(true)
  })

  it('does not register the footer or render the native ToastHost on mobile web', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true })
    const view = await render(<Scene />)
    expect(view.getByTestId('travel-wizard.step-footer')).toBeTruthy()
    expect(view.queryByTestId('toast-layer')).toBeNull()
    expect(View.prototype.measureInWindow).not.toHaveBeenCalled()
  })
})
