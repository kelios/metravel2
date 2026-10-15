import React from 'react'
import { Keyboard, Platform, View, type KeyboardEvent } from 'react-native'
import { act, cleanup, fireEvent, render, within } from '@testing-library/react-native/pure'

// Exercise the installed library's registry, imperative handle, useToast and
// timers. Only native animation and external inset measurements are replaced.
jest.unmock('react-native-toast-message')
jest.mock('react-native-toast-message/lib/src/components/AnimatedContainer', () => ({
  AnimatedContainer: ({ isVisible, children }: { isVisible: boolean; children: React.ReactNode }) => {
    const React = require('react')
    const { View } = require('react-native')
    return isVisible ? React.createElement(View, { testID: 'visible-toast' }, children) : null
  },
}))

let mockSetRootInset: React.Dispatch<React.SetStateAction<number>>
jest.mock('@/components/layout/useNativeBottomOverlayInset', () => ({
  useNativeBottomOverlayInset: (overDock: boolean) => {
    const React = require('react')
    const [reserve, setReserve] = React.useState(0)
    if (overDock) mockSetRootInset = setReserve
    return { layerRef: React.useRef(null), measureLayer: jest.fn(), reserve, safeBottom: 0 }
  },
}))

import Toast, { type ToastProps, type ToastShowParams } from 'react-native-toast-message'
import ToastHost from '@/components/ui/ToastHost'

const originalOS = Platform.OS
const keyboardCallbacks: Array<{ event: string; callback: (event: KeyboardEvent) => void }> = []
const keyboardEvent: KeyboardEvent = {
  duration: 250, easing: 'keyboard',
  endCoordinates: { height: 300, width: 390, screenX: 0, screenY: 544 },
}

function show(text1: string, params: ToastShowParams = {}) {
  act(() => Toast.show({ text1, autoHide: false, ...params }))
}

function expectOnlyHost(result: ReturnType<typeof render>, host: string, text: string) {
  expect(result.getAllByTestId('visible-toast')).toHaveLength(1)
  expect(within(result.getByTestId(host)).getByText(text)).toBeTruthy()
}

function Layers({ parent = true, child = false }: { parent?: boolean; child?: boolean }) {
  return <>
    <View testID="root"><ToastHost /></View>
    {parent && <View testID="parent"><ToastHost overDock={false} /></View>}
    {child && <View testID="child"><ToastHost overDock={false} /></View>}
  </>
}

beforeEach(() => {
  jest.useFakeTimers()
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true })
  keyboardCallbacks.length = 0
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, callback) => {
    keyboardCallbacks.push({ event, callback })
    return { remove: jest.fn() }
  })
})

afterEach(() => {
  cleanup() // Real unmount must remove each library ref before the next test.
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
  Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
})

describe('native feedback host lifetime priority (real library)', () => {
  it.each(['keyboard', 'inset'])('keeps the retained modal selected after a root-only %s update', (source) => {
    const result = render(<Layers />)
    act(() => {
      if (source === 'keyboard') {
        // A lower host can commit its keyboard update after the modal's commit.
        keyboardCallbacks.find(({ event }) => event === 'keyboardDidShow')!.callback(keyboardEvent)
      } else {
        mockSetRootInset(72)
      }
    })
    show('Permission denied', { type: 'info' })
    expectOnlyHost(result, 'parent', 'Permission denied')
    expect(within(result.getByTestId('root')).queryByText('Permission denied')).toBeNull()
  })

  it('does not promote the root when its earlier notification expires internally', () => {
    const expired = jest.fn()
    const result = render(<Layers parent={false} />)
    show('Earlier root message', { autoHide: true, visibilityTime: 100, onHide: expired })
    result.rerender(<Layers />)
    act(() => jest.advanceTimersByTime(100))
    expect(expired).toHaveBeenCalledTimes(1)
    expect(result.queryByText('Earlier root message')).toBeNull()

    show('Modal after expiry')
    expectOnlyHost(result, 'parent', 'Modal after expiry')
  })

  it('falls back from retained child to parent to root without replay after real unmount', () => {
    const result = render(<Layers child />)
    act(() => mockSetRootInset(72))
    // Also commit a parent-only update beneath the child.
    act(() => keyboardCallbacks.filter(({ event }) => event === 'keyboardDidShow')[1].callback(keyboardEvent))
    show('Child message')
    expectOnlyHost(result, 'child', 'Child message')

    result.rerender(<Layers />)
    expect(result.queryByText('Child message')).toBeNull()
    show('Parent message')
    expectOnlyHost(result, 'parent', 'Parent message')

    result.rerender(<Layers parent={false} />)
    expect(result.queryByText('Parent message')).toBeNull()
    show('Root message')
    expectOnlyHost(result, 'root', 'Root message')
    result.unmount()
    expect(() => { Toast.show({ text1: 'No mounted host' }); Toast.hide() }).not.toThrow()
  })

  it('delegates to the latest defaults and hide callback while replacing and expiring messages', () => {
    const oldShow = jest.fn()
    const oldHide = jest.fn()
    const currentShow = jest.fn()
    const currentHide = jest.fn()
    const renderHost = (props: ToastProps) => <View testID="root"><Toast {...props} /></View>
    const result = render(renderHost({ onShow: oldShow, onHide: oldHide, autoHide: false }))
    show('Initial')
    expect(oldShow).toHaveBeenCalledTimes(1)
    result.rerender(renderHost({ onShow: currentShow, onHide: currentHide, visibilityTime: 120 }))

    act(() => Toast.show({ text1: 'Current defaults' }))
    expect(currentShow).toHaveBeenCalledTimes(1)
    expect(result.queryByText('Initial')).toBeNull()
    expectOnlyHost(result, 'root', 'Current defaults')
    act(() => jest.advanceTimersByTime(119))
    expect(result.getByText('Current defaults')).toBeTruthy()
    act(() => jest.advanceTimersByTime(1))
    expect(result.queryByText('Current defaults')).toBeNull()
    expect(currentHide).toHaveBeenCalledTimes(1)
    expect(oldHide).not.toHaveBeenCalled()

    const messageHide = jest.fn()
    show('Public hide', { onHide: messageHide })
    act(() => Toast.hide())
    expect(result.queryByTestId('visible-toast')).toBeNull()
    expect(messageHide).toHaveBeenCalledTimes(1)
    expect(currentHide).toHaveBeenCalledTimes(1)
  })

  it('uses the real app action renderer to hide once and run its action once', () => {
    const action = jest.fn()
    const hidden = jest.fn()
    const result = render(<Layers />)
    show('Undo available', {
      type: 'info', onHide: hidden, props: { action: { label: 'Undo', onPress: action } },
    })
    expectOnlyHost(result, 'parent', 'Undo available')
    fireEvent.press(result.getByTestId('toast-action'))
    expect(result.queryByTestId('visible-toast')).toBeNull()
    expect(hidden).toHaveBeenCalledTimes(1)
    expect(action).toHaveBeenCalledTimes(1)
    show('After action')
    expectOnlyHost(result, 'parent', 'After action')
  })
})
