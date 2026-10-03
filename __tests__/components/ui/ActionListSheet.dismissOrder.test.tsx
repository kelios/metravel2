import React from 'react'
import { Modal, Platform } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'

import ActionListSheet from '@/components/ui/ActionListSheet'

// #2115: пункт «⋯» часто открывает следующий Modal (ConfirmDialog). На iOS UIKit не
// покажет его, пока лист ещё закрывается, поэтому действие ждёт onDismiss листа.
describe('ActionListSheet: действие после закрытия листа', () => {
  const prevOS = Platform.OS
  afterEach(() => {
    ;(Platform.OS as any) = prevOS
    jest.useRealTimers()
  })

  const setup = () => {
    const onClose = jest.fn()
    const onPress = jest.fn()
    const utils = render(
      <ActionListSheet
        visible
        onClose={onClose}
        title="Диалог"
        actions={[{ key: 'delete', label: 'Удалить диалог', icon: 'trash-2', destructive: true, onPress, testID: 'item-delete' }]}
      />,
    )
    return { ...utils, onClose, onPress }
  }

  it('iOS: закрывает лист сразу, а действие — на onDismiss, ровно один раз', () => {
    ;(Platform.OS as any) = 'ios'
    jest.useFakeTimers()
    const { getByTestId, UNSAFE_getByType, onClose, onPress } = setup()
    fireEvent.press(getByTestId('item-delete'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPress).not.toHaveBeenCalled()
    act(() => {
      UNSAFE_getByType(Modal).props.onDismiss()
    })
    expect(onPress).toHaveBeenCalledTimes(1)
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('iOS: без onDismiss действие выполняет страховочный таймер', () => {
    ;(Platform.OS as any) = 'ios'
    jest.useFakeTimers()
    const { getByTestId, onPress } = setup()
    fireEvent.press(getByTestId('item-delete'))
    expect(onPress).not.toHaveBeenCalled()
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it.each(['web', 'android'] as const)('%s: действие сразу после закрытия', (os) => {
    ;(Platform.OS as any) = os
    const { getByTestId, onClose, onPress } = setup()
    fireEvent.press(getByTestId('item-delete'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
