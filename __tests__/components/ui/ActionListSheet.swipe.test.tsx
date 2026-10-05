import React from 'react'
import { PanResponder, Text, type PanResponderCallbacks, type PanResponderGestureState } from 'react-native'
import { fireEvent, render, within } from '@testing-library/react-native'

import ActionListSheet from '@/components/ui/ActionListSheet'

// #2159: свайп вниз по шапке листа закрывает его на iPhone и Android. Шапка берёт
// касание на старте: иначе ответчиком на старте становится предок листа вне Modal,
// и `onMoveShouldSet*` шапке уже не задаётся — жест не доходил ни на одной платформе
// (замер на эмуляторе 04.10.2026: startShould вызывался, moveShould — ни разу).
const gesture = (dy: number, dx = 0): PanResponderGestureState => ({
  stateID: 1,
  moveX: 0,
  moveY: 0,
  x0: 0,
  y0: 0,
  dx,
  dy,
  vx: 0,
  vy: 0,
  numberActiveTouches: 1,
  _accountsForMovesUpTo: 0,
})

describe('ActionListSheet: свайп вниз по шапке (native)', () => {
  const touch = {} as Parameters<NonNullable<PanResponderCallbacks['onPanResponderRelease']>>[0]

  const setup = () => {
    const createSpy = jest.spyOn(PanResponder, 'create')
    const onClose = jest.fn()
    const utils = render(<ActionListSheet visible onClose={onClose} title="Мои поездки" />)
    const config = createSpy.mock.calls.at(-1)?.[0] as PanResponderCallbacks
    createSpy.mockRestore()
    return { ...utils, config, onClose }
  }

  it('шапка берёт касание на старте и не отдаёт жест на полпути', () => {
    const { config } = setup()
    expect(config.onStartShouldSetPanResponder?.(touch, gesture(0))).toBe(true)
    // Захват — во всплытии, не в capture: capture-фаза идёт от предков к потомкам,
    // и шапка отняла бы касание у ✕ на устройстве, а `fireEvent.press` ниже это не ловит.
    expect(config.onStartShouldSetPanResponderCapture).toBeUndefined()
    expect(config.onPanResponderTerminationRequest?.(touch, gesture(30))).toBe(false)
  })

  it('свайп вниз дальше порога закрывает лист, короткий и вверх — нет', () => {
    const { config, onClose } = setup()
    config.onPanResponderRelease?.(touch, gesture(30))
    config.onPanResponderRelease?.(touch, gesture(-120))
    expect(onClose).not.toHaveBeenCalled()
    config.onPanResponderRelease?.(touch, gesture(120))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('жест висит на шапке: в ней ✕ и заголовок, тело листа — снаружи', () => {
    const { UNSAFE_root } = render(
      <ActionListSheet visible onClose={jest.fn()} title="Мои поездки">
        <Text testID="sheet-body">Абзац пояснения</Text>
      </ActionListSheet>,
    )
    // onMoveShouldSetResponder даёт только PanResponder (у Pressable его нет) — это шапка.
    const headers = UNSAFE_root.findAll(
      (node) => typeof node.type === 'string' && typeof node.props.onMoveShouldSetResponder === 'function',
    )
    expect(headers).toHaveLength(1)
    const [header] = headers
    expect(header.props.onStartShouldSetResponder(touch)).toBe(true)
    expect(within(header).getByLabelText('Закрыть')).toBeTruthy()
    expect(within(header).getByText('Мои поездки')).toBeTruthy()
    expect(within(header).queryByTestId('sheet-body')).toBeNull()
  })

  it('крестик закрывает лист как раньше', () => {
    const { getByLabelText, onClose } = setup()
    fireEvent.press(getByLabelText('Закрыть'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
