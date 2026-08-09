import { act, renderHook } from '@testing-library/react-native'
import { Platform } from 'react-native'

import {
  TOUCH_HOLD_MS,
  useRoutePointDrag,
} from '@/components/trips/planning/useRoutePointDrag'

const ROW_HEIGHT = 80
const ROW_PITCH = 88
const COUNT = 25

const layoutEvent = (index: number) =>
  ({
    nativeEvent: { layout: { x: 0, y: index * ROW_PITCH, width: 320, height: ROW_HEIGHT } },
  }) as never

const pointerEvent = (type: string, clientY: number) => {
  // jsdom не реализует конструктор PointerEvent, а слушателям нужен только тип
  // и clientY — MouseEvent даёт и то, и другое.
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientY })
  return event
}

type DragHook = ReturnType<typeof useRoutePointDrag>

const measureRows = (hook: { current: DragHook }) => {
  act(() => {
    for (let index = 0; index < COUNT; index += 1) {
      hook.current.registerRowLayout(index, layoutEvent(index))
    }
  })
}

const pressHandle = (
  hook: { current: DragHook },
  index: number,
  pointerType: 'mouse' | 'touch',
  clientY: number,
) => {
  const handlers = hook.current.handleProps[index] as {
    onPointerDown: (event: unknown) => void
  }
  act(() => {
    handlers.onPointerDown({ pointerType, button: 0, clientY })
  })
}

describe('useRoutePointDrag on web', () => {
  const originalOS = Platform.OS
  let onReorder: jest.Mock

  beforeAll(() => {
    // @ts-expect-error — Platform.OS типизирован как readonly
    Platform.OS = 'web'
  })

  afterAll(() => {
    // @ts-expect-error — Platform.OS типизирован как readonly
    Platform.OS = originalOS
  })

  beforeEach(() => {
    jest.useFakeTimers()
    onReorder = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const setup = () =>
    renderHook(() => useRoutePointDrag({ enabled: true, count: COUNT, onReorder }))

  it('drags with the mouse immediately and drops point #20 onto position #2', () => {
    const { result } = setup()
    measureRows(result)

    const startY = 1000
    pressHandle(result, 19, 'mouse', startY)
    expect(result.current.drag).toEqual({ index: 19, dropIndex: 19, offsetY: 0 })

    // Центр строки #20 переносим в центр строки #2.
    const deltaY = 1 * ROW_PITCH - 19 * ROW_PITCH
    act(() => {
      window.dispatchEvent(pointerEvent('pointermove', startY + deltaY))
    })
    expect(result.current.drag).toEqual({ index: 19, dropIndex: 1, offsetY: deltaY })

    act(() => {
      window.dispatchEvent(pointerEvent('pointerup', startY + deltaY))
    })
    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onReorder).toHaveBeenCalledWith(19, 1)
    expect(result.current.drag).toBeNull()
  })

  it('starts a touch drag only after the hold delay', () => {
    const { result } = setup()
    measureRows(result)

    pressHandle(result, 3, 'touch', 500)
    expect(result.current.drag).toBeNull()

    act(() => {
      jest.advanceTimersByTime(TOUCH_HOLD_MS)
    })
    expect(result.current.drag).toEqual({ index: 3, dropIndex: 3, offsetY: 0 })

    act(() => {
      window.dispatchEvent(pointerEvent('pointermove', 500 - 2 * ROW_PITCH))
    })
    act(() => {
      window.dispatchEvent(pointerEvent('pointerup', 500 - 2 * ROW_PITCH))
    })
    expect(onReorder).toHaveBeenCalledWith(3, 1)
  })

  it('lets a quick touch swipe scroll instead of reordering', () => {
    const { result } = setup()
    measureRows(result)

    pressHandle(result, 3, 'touch', 500)
    act(() => {
      window.dispatchEvent(pointerEvent('pointermove', 460))
    })
    act(() => {
      jest.advanceTimersByTime(TOUCH_HOLD_MS * 2)
    })
    expect(result.current.drag).toBeNull()

    act(() => {
      window.dispatchEvent(pointerEvent('pointerup', 460))
    })
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('commits nothing when the pointer returns to the original slot', () => {
    const { result } = setup()
    measureRows(result)

    pressHandle(result, 5, 'mouse', 700)
    act(() => {
      window.dispatchEvent(pointerEvent('pointermove', 700 + ROW_HEIGHT / 4))
    })
    act(() => {
      window.dispatchEvent(pointerEvent('pointerup', 700 + ROW_HEIGHT / 4))
    })
    expect(onReorder).not.toHaveBeenCalled()
  })

  it('drops the gesture on pointercancel', () => {
    const { result } = setup()
    measureRows(result)

    pressHandle(result, 8, 'mouse', 900)
    act(() => {
      window.dispatchEvent(pointerEvent('pointermove', 900 - 4 * ROW_PITCH))
    })
    act(() => {
      window.dispatchEvent(pointerEvent('pointercancel', 900 - 4 * ROW_PITCH))
    })
    expect(onReorder).not.toHaveBeenCalled()
    expect(result.current.drag).toBeNull()
  })

  it('ignores a secondary mouse button and a disabled list', () => {
    const { result } = setup()
    measureRows(result)

    const handlers = result.current.handleProps[2] as { onPointerDown: (e: unknown) => void }
    act(() => {
      handlers.onPointerDown({ pointerType: 'mouse', button: 2, clientY: 400 })
    })
    expect(result.current.drag).toBeNull()

    const disabled = renderHook(() =>
      useRoutePointDrag({ enabled: false, count: COUNT, onReorder }),
    )
    const disabledHandlers = disabled.result.current.handleProps[2] as {
      onPointerDown: (e: unknown) => void
    }
    act(() => {
      disabledHandlers.onPointerDown({ pointerType: 'mouse', button: 0, clientY: 400 })
    })
    expect(disabled.result.current.drag).toBeNull()
  })
})
