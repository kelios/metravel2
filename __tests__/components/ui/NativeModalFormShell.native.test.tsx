import React, { useEffect, useState } from 'react'
import { Keyboard, Platform, ScrollView, Text, TextInput, type KeyboardEvent } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'
import NativeModalFormShell, { modalChromeNeedsFlow, residualModalKeyboardInset } from '@/components/ui/NativeModalFormShell.native'

const originalPlatform = Platform.OS
const layout = (width: number, height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width, height } } })
const keyboardFrame: KeyboardEvent = {
  duration: 0, easing: 'keyboard',
  startCoordinates: { screenX: 0, screenY: 720, width: 390, height: 0 },
  endCoordinates: { screenX: 0, screenY: 420, width: 390, height: 300 },
}

describe('NativeModalFormShell', () => {
  let visible = false
  let listeners: Record<string, (event: KeyboardEvent) => void>
  beforeEach(() => {
    visible = false
    listeners = {}
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })
    jest.spyOn(Keyboard, 'isVisible').mockImplementation(() => visible)
    jest.spyOn(Keyboard, 'metrics').mockImplementation(() => visible ? keyboardFrame.endCoordinates : undefined)
    jest.spyOn(Keyboard, 'addListener').mockImplementation((name, listener) => {
      listeners[name] = listener
      return { remove: jest.fn() }
    })
  })
  afterEach(() => {
    jest.restoreAllMocks()
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform })
  })

  const setup = (editing = false) => render(
    <NativeModalFormShell active editing={editing} header={<Text>Header</Text>} footer={<Text>Footer</Text>} backgroundColor="#fff">
      <TextInput testID="input" />
    </NativeModalFormShell>,
  )

  it('retains the same scroll, form host and edited value across sticky, keyboard and oversized chrome modes', () => {
    const mounted = jest.fn()
    const unmounted = jest.fn()
    function Form() {
      const [value, setValue] = useState('initial')
      useEffect(() => { mounted(); return () => unmounted() }, [])
      return <TextInput testID="input" value={value} onChangeText={setValue} />
    }
    const view = render(
      <NativeModalFormShell active editing={false} header={<Text>Header</Text>} footer={<Text>Footer</Text>} backgroundColor="#fff">
        <Form />
      </NativeModalFormShell>,
    )
    fireEvent(view.getByTestId('native-modal-form'), 'layout', layout(375, 720))
    fireEvent(view.getByTestId('native-modal-form-header'), 'layout', layout(375, 130))
    fireEvent(view.getByTestId('native-modal-form-footer'), 'layout', layout(375, 170))
    const input = view.getByTestId('input')
    const scroll = view.getByTestId('native-modal-form-scroll')
    expect(scroll.props.contentContainerStyle).toEqual({ paddingTop: 130, paddingBottom: 170 })
    fireEvent.changeText(input, 'edited')
    act(() => { visible = true; listeners.keyboardWillShow(keyboardFrame) })
    expect(view.getByTestId('native-modal-form-scroll')).toBe(scroll)
    expect(view.getByTestId('input')).toBe(input)
    expect(input.props.value).toBe('edited')
    expect(scroll.props.contentContainerStyle).toEqual({ paddingTop: 0, paddingBottom: 0 })
    expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(true)
    act(() => { visible = false; listeners.keyboardDidHide(keyboardFrame) })
    expect(scroll.props.contentContainerStyle.paddingTop).toBe(130)
    fireEvent(view.getByTestId('native-modal-form-header'), 'layout', layout(375, 590))
    expect(scroll.props.contentContainerStyle.paddingTop).toBe(0)
    expect(input.props.value).toBe('edited')
    expect(mounted).toHaveBeenCalledTimes(1)
    expect(unmounted).not.toHaveBeenCalled()
  })

  it.each([[720, 300], [570, 150], [420, 0], [390, 0]])('Android viewport %s adds only residual IME inset %s', (height, expected) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' })
    const view = setup()
    fireEvent(view.getByTestId('native-modal-form'), 'layout', layout(390, 720))
    act(() => { visible = true; listeners.keyboardDidShow(keyboardFrame) })
    fireEvent(view.getByTestId('native-modal-form'), 'layout', layout(390, height))
    const scroll = view.getByTestId('native-modal-form-scroll')
    expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(false)
    expect(scroll.props.contentContainerStyle.paddingBottom).toBe(expected)
  })

  it('updates the hidden baseline after rotation instead of retaining a portrait maximum', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' })
    const view = setup()
    fireEvent(view.getByTestId('native-modal-form'), 'layout', layout(390, 720))
    fireEvent(view.getByTestId('native-modal-form'), 'layout', layout(720, 390))
    act(() => { visible = true; listeners.keyboardDidShow(keyboardFrame) })
    fireEvent(view.getByTestId('native-modal-form'), 'layout', layout(720, 240))
    expect(view.getByTestId('native-modal-form-scroll').props.contentContainerStyle.paddingBottom).toBe(150)
  })

  it.each([[720, 390, 224], [420, 390, 224], [240, 720, 600]])(
    'reveals Android focus in a %s × %s safe viewport without coordinate drift or rotation overscroll', (height, width, expected) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' })
    const measureLayout = jest.fn((_relative, success) => success(0, 500, 200, 44))
    const input = { measureLayout } as unknown as ReturnType<typeof TextInput.State.currentlyFocusedInput>
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(input)
    const shell = (editing: boolean) => (
      <NativeModalFormShell active editing={editing} header={<Text>Header</Text>} footer={<Text>Footer</Text>} backgroundColor="#fff">
        <TextInput testID="input" />
      </NativeModalFormShell>
    )
    const view = render(shell(false))
    fireEvent(view.getByTestId('native-modal-form'), 'layout', layout(390, 720))
    fireEvent(view.getByTestId('native-modal-form-header'), 'layout', layout(390, 100))
    const scrollTo = jest.spyOn(view.UNSAFE_getByType(ScrollView).instance, 'scrollTo').mockImplementation(() => undefined)
    view.rerender(shell(true))
    // ScreenY includes a 36-point modal safe-area origin. Available height does not.
    act(() => { visible = true; listeners.keyboardDidShow({ ...keyboardFrame,
      endCoordinates: { ...keyboardFrame.endCoordinates, screenY: 456 },
    }) })
    fireEvent(view.getByTestId('native-modal-form'), 'layout', layout(width, height))
    // Compare the boundary's small scalar props, not the circular native Fiber.
    expect(measureLayout.mock.calls.at(-1)?.[0].props.testID).toBe('native-modal-form-body')
    expect(scrollTo.mock.calls.at(-1)?.[0]).toEqual({ y: expected, animated: true })
    scrollTo.mockClear()
    // The next input receives its own reveal while the same keyboard stays open.
    fireEvent(view.getByTestId('native-modal-form-body'), 'focus')
    expect(scrollTo).toHaveBeenCalledTimes(1)
    scrollTo.mockClear()
    let completeMeasure!: (left: number, top: number, width: number, height: number) => void
    measureLayout.mockImplementationOnce((_relative, success) => { completeMeasure = success })
    fireEvent(view.getByTestId('native-modal-form-body'), 'focus')
    jest.mocked(TextInput.State.currentlyFocusedInput).mockReturnValue(null)
    act(() => completeMeasure(0, 500, 200, 44))
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('opens in flow mode when the keyboard was already visible and removes subscriptions on close', () => {
    visible = true
    const view = setup()
    const input = view.getByTestId('input')
    expect(view.getByTestId('native-modal-form-scroll').props.contentContainerStyle.paddingTop).toBe(0)
    view.rerender(<NativeModalFormShell active={false} editing={false} header={null} footer={null} backgroundColor="#fff"><TextInput testID="input" /></NativeModalFormShell>)
    expect(view.getByTestId('input')).toBe(input)
    const results = (Keyboard.addListener as jest.Mock).mock.results
    for (const result of results) expect(result.value.remove).toHaveBeenCalledTimes(1)
  })
})

it('chooses flow geometrically and never produces a negative or nonfinite Android inset', () => {
  expect(modalChromeNeedsFlow(720, 590, 170, 44)).toBe(true)
  expect(modalChromeNeedsFlow(720, 130, 170, 44)).toBe(false)
  expect(modalChromeNeedsFlow(0, 130, 170, 44)).toBe(false)
  expect(residualModalKeyboardInset(300, 720, 400)).toBe(0)
  expect(residualModalKeyboardInset(Number.NaN, 720, 500)).toBe(0)
})
