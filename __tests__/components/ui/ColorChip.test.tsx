import React from 'react'
import { render } from '@testing-library/react-native'
import type { ReactTestInstance } from 'react-test-renderer'

import ColorChip from '@/components/ui/ColorChip'

// Проп `touchTargetSize` (#1739) переносит нажатие с видимого круга на рамку
// вокруг него, а видимый чип уезжает во вложенный View. Оба контракта были без
// единого теста: у ColorChip не существовало файла тестов вовсе.
const flatten = (node: ReactTestInstance) => {
  const style = node.props.style
  return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style
}

const chipOf = (frame: ReactTestInstance) => frame.children[0] as ReactTestInstance

describe('ColorChip', () => {
  it('без touchTargetSize: нажимаемая рамка равна чипу и не смещается полями', () => {
    const { getByRole } = render(<ColorChip color="red" chipSize={32} />)

    const frame = getByRole('button')
    const frameStyle = flatten(frame)
    expect(frameStyle.width).toBe(32)
    expect(frameStyle.height).toBe(32)
    expect(frameStyle.margin).toBeUndefined()

    const chipStyle = flatten(chipOf(frame))
    expect(chipStyle.width).toBe(32)
    expect(chipStyle.height).toBe(32)
  })

  it('touchTargetSize: рамка 44dp с отрицательным полем, видимый чип прежнего размера', () => {
    const { getByRole } = render(<ColorChip color="red" chipSize={28} touchTargetSize={44} />)

    const frame = getByRole('button')
    const frameStyle = flatten(frame)
    expect(frameStyle.width).toBe(44)
    expect(frameStyle.height).toBe(44)
    // Ряд чипов не растёт: внешний бокс остаётся 28 = 44 + 2 * (-8).
    expect(frameStyle.margin).toBe(-8)

    const chipStyle = flatten(chipOf(frame))
    expect(chipStyle.width).toBe(28)
    expect(chipStyle.height).toBe(28)
  })

  it('touchTargetSize меньше чипа игнорируется', () => {
    const { getByRole } = render(<ColorChip color="red" chipSize={32} touchTargetSize={24} />)

    const frameStyle = flatten(getByRole('button'))
    expect(frameStyle.width).toBe(32)
    expect(frameStyle.margin).toBeUndefined()
  })

  it('style и selectedStyle стилизуют видимый чип, а не рамку тач-таргета', () => {
    const { getByRole } = render(
      <ColorChip
        color="red"
        chipSize={28}
        touchTargetSize={44}
        selected
        style={{ borderWidth: 2 }}
        selectedStyle={{ borderColor: 'rgb(9, 9, 9)' }}
      />,
    )

    const frame = getByRole('button')
    expect(flatten(frame).borderWidth).toBeUndefined()

    const chipStyle = flatten(chipOf(frame))
    expect(chipStyle.borderWidth).toBe(2)
    expect(chipStyle.borderColor).toBe('rgb(9, 9, 9)')
  })
})
