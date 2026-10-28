import React from 'react'
import { Platform } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'

import ActionListSheet from '@/components/ui/ActionListSheet'

const mockModalProps = jest.fn()
// The setup has already cached react-native. Replace its public export so
// imported consumers use this call-through boundary during each test.
const mockReactNative = require('react-native')
const mockNativeModal = mockReactNative.Modal
const CapturedModal = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
  mockModalProps(props)
  return React.createElement(mockNativeModal, { ...props, ref })
})

// #2115: пункт «⋯» часто открывает следующий Modal (ConfirmDialog). На iOS UIKit не
// покажет его, пока лист ещё закрывается, поэтому действие ждёт onDismiss листа.
describe('ActionListSheet: действие после закрытия листа', () => {
  const prevOS = Platform.OS
  beforeEach(() => {
    mockModalProps.mockClear()
    jest.spyOn(mockReactNative, 'Modal').mockImplementation((props: Record<string, unknown>) =>
      React.createElement(CapturedModal, props))
  })
  afterEach(() => {
    jest.restoreAllMocks()
    ;(Platform.OS as any) = prevOS
    jest.useRealTimers()
  })

  const setup = async () => {
    const onClose = jest.fn()
    const onPress = jest.fn()
    const utils = await render(
      <ActionListSheet
        visible
        onClose={onClose}
        title="Диалог"
        actions={[{ key: 'delete', label: 'Удалить диалог', icon: 'trash-2', destructive: true, onPress, testID: 'item-delete' }]}
      />,
    )
    return { ...utils, onClose, onPress }
  }

  it('iOS: закрывает лист сразу, а действие — на onDismiss, ровно один раз', async () => {
    ;(Platform.OS as any) = 'ios'
    jest.useFakeTimers()
    const { getByTestId, onClose, onPress } = await setup()
    await fireEvent.press(getByTestId('item-delete'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPress).not.toHaveBeenCalled()
    await act(() => {
      mockModalProps.mock.calls.at(-1)![0].onDismiss()
    })
    expect(onPress).toHaveBeenCalledTimes(1)
    await act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('iOS: без onDismiss действие выполняет страховочный таймер', async () => {
    ;(Platform.OS as any) = 'ios'
    jest.useFakeTimers()
    const { getByTestId, onPress } = await setup()
    await fireEvent.press(getByTestId('item-delete'))
    expect(onPress).not.toHaveBeenCalled()
    await act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it.each(['web', 'android'] as const)('%s: действие сразу после закрытия', async (os) => {
    ;(Platform.OS as any) = os
    const { getByTestId, onClose, onPress } = await setup()
    await fireEvent.press(getByTestId('item-delete'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
