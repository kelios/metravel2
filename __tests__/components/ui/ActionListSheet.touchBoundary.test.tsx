import React from 'react'
import { Pressable, ScrollView, Text } from 'react-native'
import { render, within } from '@testing-library/react-native'
import type { ReactTestInstance } from 'react-test-renderer'

import ActionListSheet from '@/components/ui/ActionListSheet'

// #2231: касание, начатое внутри листа, не уходит экрану под ним. Переговоры за
// касание в RN идут по дереву React, а не по окнам: Modal — портал, и нажимаемый
// предок листа вне Modal (карточка каталога) участвует во всплытии. Пустая
// поверхность листа (отступы панели, разделитель, текст тела) своего ответчика не
// имеет — касание доставалось карточке, и срабатывал её `onPress`.
//
// `fireEvent.press` всплытие не моделирует (он ищет ближайший `onPress` вверх по
// дереву и вызывает его), поэтому тест сам проходит фазу всплытия
// `onStartShouldSetResponder` от цели к корню — так, как это делает RN.
//
// `Pressable` в jest-окружении проекта заменён упрощённым View с `onPress`
// (`__tests__/setup.ts`), а настоящий Pressable берёт касание на старте всегда,
// пока не `disabled`. Поэтому хост-узел с `onPress` считается отвечающим «да».
const claimsStart = (node: ReactTestInstance): boolean => {
  const ask = node.props.onStartShouldSetResponder
  if (typeof ask === 'function') return ask({ nativeEvent: {} }) === true
  return typeof node.props.onPress === 'function' && node.props.disabled !== true
}

const startResponder = (target: ReactTestInstance): ReactTestInstance | null => {
  for (let node: ReactTestInstance | null = target; node; node = node.parent) {
    if (typeof node.type === 'string' && claimsStart(node)) return node
  }
  return null
}

describe('ActionListSheet: касания внутри листа не доходят до предка вне Modal (native)', () => {
  const setup = () =>
    render(
      <Pressable testID="card-under-sheet" onPress={jest.fn()}>
        <ActionListSheet
          visible
          onClose={jest.fn()}
          title="Действия"
          actions={[
            { key: 'edit', label: 'Изменить', icon: 'edit-2', onPress: jest.fn(), testID: 'row-edit' },
            { key: 'delete', label: 'Удалить', icon: 'trash-2', onPress: jest.fn(), destructive: true },
          ]}
        >
          <ScrollView testID="sheet-scroll">
            <Text testID="sheet-body-text">Абзац пояснения</Text>
          </ScrollView>
        </ActionListSheet>
      </Pressable>,
    )

  it('без границы касание пустого места досталось бы карточке: она отвечает на старте', () => {
    const { getByTestId } = setup()
    const card = getByTestId('card-under-sheet')
    expect(startResponder(card)).toBe(card)
  })

  it.each([
    ['отступ панели', 'bottom-sheet-panel'],
    ['разделитель над разрушительным пунктом', 'action-sheet-separator'],
    ['текст тела внутри ScrollView', 'sheet-body-text'],
  ])('касание пустой поверхности (%s) берёт граница листа, а не карточка', (_name, testID) => {
    const { getByTestId } = setup()
    const responder = startResponder(getByTestId(testID))
    expect(responder?.props.testID).toBe('bottom-sheet-touch-boundary')
  })

  it('граница не отдаёт касание предку на движении', () => {
    const { getByTestId } = setup()
    const boundary = getByTestId('bottom-sheet-touch-boundary')
    expect(boundary.props.onResponderTerminationRequest({ nativeEvent: {} })).toBe(false)
  })

  it('граница лежит ВНЕ Modal: нативно она не предок содержимого листа и не перехватывает прокрутку тела', () => {
    const { getByTestId, UNSAFE_root } = setup()
    const boundary = getByTestId('bottom-sheet-touch-boundary')
    // Оба узла существуют — иначе проверка ниже пуста.
    expect(getByTestId('bottom-sheet-root')).toBeTruthy()
    expect(getByTestId('bottom-sheet-panel')).toBeTruthy()
    // Android: вью-ответчик перехватывает нативные касания своих потомков
    // (JSResponderHandler.onInterceptTouchEvent). Панель или корень внутри Modal
    // в роли ответчика отняли бы жест у ScrollView тела листа.
    const insideModal = UNSAFE_root.findAll(
      (node) =>
        typeof node.type === 'string' &&
        typeof node.props.onStartShouldSetResponder === 'function' &&
        (node.props.testID === 'bottom-sheet-panel' || node.props.testID === 'bottom-sheet-root'),
    )
    expect(insideModal).toHaveLength(0)
    expect(within(boundary).getByTestId('sheet-scroll')).toBeTruthy()
    expect(boundary.props.style).toEqual(expect.objectContaining({ position: 'absolute', width: 0, height: 0 }))
  })

  it('пункт, ✕ и шапка выигрывают своё касание сами — граница им не мешает', () => {
    const { getByTestId, getByText, getByLabelText } = setup()
    const boundary = getByTestId('bottom-sheet-touch-boundary')
    const card = getByTestId('card-under-sheet')

    const row = startResponder(getByText('Изменить'))
    expect(row).not.toBe(boundary)
    expect(row).not.toBe(card)
    expect(row?.props.testID).toBe('row-edit')

    const close = startResponder(getByLabelText('Закрыть'))
    expect(close).not.toBe(boundary)
    expect(close).not.toBe(card)

    // Заголовок — часть шапки: её PanResponder берёт касание на старте (#2159).
    const header = startResponder(getByText('Действия'))
    expect(header).not.toBe(boundary)
    expect(typeof header?.props.onMoveShouldSetResponder).toBe('function')
  })
})
