import React from 'react'
import { act, fireEvent, render } from '@testing-library/react-native'
import { AccessibilityInfo, BackHandler, Text, View } from 'react-native'
import { PaperProvider } from 'react-native-paper'
import MenuOverlay from '@/components/ui/MenuOverlay.native'
import WebMenuOverlay from '@/components/ui/MenuOverlay.web'
import { NativeMenuAccessibilityProvider, NativeMenuBackground } from '@/components/ui/NativeMenuAccessibilityScope'

jest.mock('react-native-paper', () => jest.requireActual('react-native-paper'))

const mockModalProps = jest.fn()
// The setup has already cached react-native. Replace its public export so
// imported consumers use this call-through boundary during each test.
const mockReactNative = require('react-native')
const mockNativeModal = mockReactNative.Modal
const CapturedModal = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
  mockModalProps(props)
  return React.createElement(mockNativeModal, { ...props, ref })
})

describe('native menu overlay lifetime', () => {
  const first = { current: { id: 'first' } as unknown as View }
  const trigger = { current: { id: 'trigger' } as unknown as View }
  let back: () => boolean
  let remove: jest.Mock
  let announce: jest.SpyInstance
  let focus: jest.SpyInstance

  beforeEach(() => {
    mockModalProps.mockClear()
    jest.spyOn(mockReactNative, 'Modal').mockImplementation((props: Record<string, unknown>) =>
      React.createElement(CapturedModal, props))
    remove = jest.fn()
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, callback) => {
      back = callback as () => boolean
      return { remove }
    })
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {})
    focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {})
  })
  afterEach(() => jest.restoreAllMocks())

  const scene = (visible: boolean, close: () => void, restoreFocusRef = { current: true }, second = false, onClosed?: () => void) => (
    <NativeMenuAccessibilityProvider>
      <PaperProvider>
        <NativeMenuBackground><Text>Underlying route</Text></NativeMenuBackground>
        <MenuOverlay visible={visible} onRequestClose={close} onClosed={onClosed} accessibilityLabel="Account menu"
          initialFocusRef={first} returnFocusRef={trigger} restoreFocusRef={restoreFocusRef}>
          <Text>Login action</Text>
        </MenuOverlay>
        <MenuOverlay visible={second} onRequestClose={close} accessibilityLabel="Second menu"
          initialFocusRef={first} returnFocusRef={trigger} restoreFocusRef={restoreFocusRef}>
          <Text>Second action</Text>
        </MenuOverlay>
      </PaperProvider>
    </NativeMenuAccessibilityProvider>
  )

  it('renders a real Paper portal without Dialog and isolates only the underlying route', async () => {
    const utils = await render(scene(true, jest.fn()))
    expect(mockModalProps).not.toHaveBeenCalled()
    expect(utils.getByText('Login action')).toBeTruthy()
    expect(utils.queryByText('Underlying route')).toBeNull()
    const background = utils.getByTestId('native-menu-background', { includeHiddenElements: true })
    expect(background.props.importantForAccessibility).toBe('no-hide-descendants')
    expect(background.props.accessibilityElementsHidden).toBe(true)
    expect(background.props.pointerEvents).toBe('none')
    expect(announce).toHaveBeenCalledWith('Account menu')
    await fireEvent(utils.getByTestId('native-menu-overlay'), 'layout', { nativeEvent: { layout: {} } })
    await fireEvent(utils.getByTestId('native-menu-overlay'), 'layout', { nativeEvent: { layout: {} } })
    expect(focus).toHaveBeenCalledTimes(1)
    expect(focus).toHaveBeenCalledWith(first.current, 'focus')
  })

  it('consumes Back with the latest close callback, removes the listener and restores focus on dismissal', async () => {
    const initial = jest.fn()
    const latest = jest.fn()
    const utils = await render(scene(true, initial))
    await utils.rerender(scene(true, latest))
    await act(() => expect(back()).toBe(true))
    expect(latest).toHaveBeenCalledTimes(1)
    expect(initial).not.toHaveBeenCalled()
    await utils.rerender(scene(false, latest))
    expect(remove).toHaveBeenCalledTimes(1)
    expect(focus).toHaveBeenCalledWith(trigger.current, 'focus')
    expect(utils.queryByTestId('native-menu-overlay')).toBeNull()
    expect(utils.getByText('Underlying route')).toBeTruthy()
  })

  it('does not focus the previous screen trigger during route navigation', async () => {
    const restore = { current: true }
    const utils = await render(scene(true, jest.fn(), restore))
    restore.current = false
    await utils.rerender(scene(false, jest.fn(), restore))
    expect(focus).not.toHaveBeenCalled()
    expect(utils.getByText('Underlying route')).toBeTruthy()
  })

  it('restores focus only after the background accessibility flags are removed', async () => {
    const utils = await render(scene(true, jest.fn()))
    focus.mockImplementation((target: View) => {
      if (target !== trigger.current) return
      const background = utils.getByTestId('native-menu-background', { includeHiddenElements: true })
      expect(background.props.accessibilityElementsHidden).toBe(false)
      expect(background.props.importantForAccessibility).toBe('auto')
    })
    await utils.rerender(scene(false, jest.fn()))
    expect(focus).toHaveBeenCalledWith(trigger.current, 'focus')
  })

  it('does not report dismissal or return focus during StrictMode effect replay', async () => {
    const onClosed = jest.fn()
    const utils = await render(<React.StrictMode>{scene(true, jest.fn(), { current: true }, false, onClosed)}</React.StrictMode>)
    expect(onClosed).not.toHaveBeenCalled()
    expect(focus).not.toHaveBeenCalledWith(trigger.current, 'focus')
    await fireEvent(utils.getByTestId('native-menu-overlay'), 'layout', { nativeEvent: { layout: {} } })
    expect(focus).toHaveBeenCalledWith(first.current, 'focus')
    await utils.rerender(<React.StrictMode>{scene(false, jest.fn(), { current: true }, false, onClosed)}</React.StrictMode>)
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(focus).toHaveBeenCalledWith(trigger.current, 'focus')
  })

  it('reports completion only after actual host removal and uses the latest callback without closing on ref updates', async () => {
    const initial = jest.fn()
    const latest = jest.fn(() => expect(utils.queryByTestId('native-menu-overlay')).toBeNull())
    const utils = await render(scene(true, jest.fn(), { current: false }, false, initial))
    await utils.rerender(scene(true, jest.fn(), { current: false }, false, latest))
    expect(initial).not.toHaveBeenCalled()
    expect(latest).not.toHaveBeenCalled()
    await utils.rerender(scene(false, jest.fn(), { current: false }, false, latest))
    expect(latest).toHaveBeenCalledTimes(1)
    expect(initial).not.toHaveBeenCalled()
    expect(utils.getByText('Underlying route')).toBeTruthy()
  })

  it('keeps the route hidden until the last active menu is removed', async () => {
    const close = jest.fn()
    const utils = await render(scene(true, close, { current: false }, true))
    await utils.rerender(scene(false, close, { current: false }, true))
    expect(utils.queryByText('Underlying route')).toBeNull()
    expect(utils.getByText('Second action')).toBeTruthy()
    await utils.rerender(scene(false, close, { current: false }, false))
    expect(utils.getByText('Underlying route')).toBeTruthy()
  })

  it('leaves the web adapter on the existing RNW Modal contract', async () => {
    const close = jest.fn()
    await render(<WebMenuOverlay visible onRequestClose={close} accessibilityLabel="Menu"
      initialFocusRef={first} returnFocusRef={trigger} restoreFocusRef={{ current: true }}>
      <Text>Web menu</Text>
    </WebMenuOverlay>)
    expect(mockModalProps.mock.calls.at(-1)?.[0]).toMatchObject({ visible: true, transparent: true, animationType: 'fade', onRequestClose: close })
  })
})
