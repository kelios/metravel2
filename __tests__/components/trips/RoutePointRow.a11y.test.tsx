import React from 'react'
import { Platform } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

import RoutePointRow from '@/components/trips/planning/RoutePointRow'
import { createStyles } from '@/components/trips/planning/RouteBuilder.styles'
import type { ThemedColors } from '@/hooks/useTheme'

const colors = new Proxy({}, { get: (_target, key) => String(key) }) as ThemedColors
const styles = createStyles(colors)
const originalOS = Platform.OS

const setPlatformOS = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os })
}

describe('RoutePointRow drag handle accessibility', () => {
  beforeEach(() => setPlatformOS('web'))
  afterAll(() => setPlatformOS(originalOS))

  it('supports keyboard and screen-reader reorder actions without replacing drag handlers', () => {
    const onMove = jest.fn()
    const onPointerDown = jest.fn()
    const preventDefault = jest.fn()
    const { getByTestId } = render(
      <RoutePointRow
        point={{
          id: 'b',
          type: 'place',
          name: 'Вторая точка',
          description: null,
          coordinates: [27.56, 53.9],
          placeId: null,
        }}
        index={1}
        total={3}
        isOwner
        styles={styles}
        colors={colors}
        dragHandlers={{ onPointerDown }}
        isDragging={false}
        isDropTarget={false}
        dragOffsetY={0}
        formatCoordinate={String}
        onLayout={jest.fn()}
        onEdit={jest.fn()}
        onMove={onMove}
        onDelete={jest.fn()}
      />,
    )

    const handle = getByTestId('route-builder-drag-1')
    expect(handle.props.accessibilityRole).toBe('adjustable')
    expect(handle.props.tabIndex).toBe(0)

    fireEvent(handle, 'pointerDown', { clientY: 100, pointerType: 'mouse', button: 0 })
    expect(onPointerDown).toHaveBeenCalledTimes(1)

    fireEvent(handle, 'keyDown', { key: 'ArrowUp', preventDefault })
    fireEvent(handle, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(onMove.mock.calls).toEqual([
      [1, -1],
      [1, 1],
    ])
  })
})
