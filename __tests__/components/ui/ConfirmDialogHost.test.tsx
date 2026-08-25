import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'

// Диалог подменён стабом: тест проверяет проводку хоста со стором, а не вёрстку
// `ConfirmDialog` (у него своё покрытие).
jest.mock('@/components/ui/ConfirmDialog', () => {
  const React = require('react')
  const { Pressable, Text, View } = require('react-native')
  return {
    __esModule: true,
    default: ({ visible, title, message, confirmText, cancelText, onConfirm, onClose }: any) =>
      visible ? (
        <View testID="confirm-dialog-stub">
          <Text>{title}</Text>
          <Text>{message}</Text>
          <Pressable testID="stub-accept" onPress={onConfirm}>
            <Text>{confirmText}</Text>
          </Pressable>
          <Pressable testID="stub-cancel" onPress={onClose}>
            <Text>{cancelText}</Text>
          </Pressable>
        </View>
      ) : null,
  }
})

import ConfirmDialogHost from '@/components/ui/ConfirmDialogHost'
import { requestConfirmDialog, resolveConfirmDialog } from '@/components/ui/confirmDialogStore'

describe('ConfirmDialogHost', () => {
  afterEach(() => {
    resolveConfirmDialog(false)
  })

  it('без запроса не рендерит ничего: пустой хост висит на каждой web-странице', () => {
    render(<ConfirmDialogHost />)

    expect(screen.queryByTestId('confirm-dialog-stub')).toBeNull()
  })

  it('показывает запрос из стора и резолвит промис подтверждением', async () => {
    render(<ConfirmDialogHost />)

    const pending = requestConfirmDialog({
      title: 'Удалить точку',
      message: 'Точку «Ратуша» удалить из маршрута?',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
    })

    expect(await screen.findByText('Точку «Ратуша» удалить из маршрута?')).toBeTruthy()
    expect(screen.getByText('Удалить')).toBeTruthy()

    fireEvent.press(screen.getByTestId('stub-accept'))

    await expect(pending).resolves.toBe(true)
    expect(screen.queryByTestId('confirm-dialog-stub')).toBeNull()
  })

  it('отмена резолвит false и закрывает диалог', async () => {
    render(<ConfirmDialogHost />)

    const pending = requestConfirmDialog({ title: 'Очистить?', message: 'Список будет очищен.' })
    expect(await screen.findByTestId('confirm-dialog-stub')).toBeTruthy()

    fireEvent.press(screen.getByTestId('stub-cancel'))

    await expect(pending).resolves.toBe(false)
    expect(screen.queryByTestId('confirm-dialog-stub')).toBeNull()
  })

  it('размонтирование хоста с открытым диалогом резолвит false, а не вешает await', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const view = render(<ConfirmDialogHost />)

    const pending = requestConfirmDialog({ title: 'Удалить?', message: 'Действие необратимо.' })
    view.unmount()

    await expect(pending).resolves.toBe(false)
    warn.mockRestore()
  })
})
