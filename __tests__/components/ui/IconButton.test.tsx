// IconButton.test.tsx - Тесты для компонента IconButton
import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { Platform, View } from 'react-native'

import IconButton from '@/components/ui/IconButton'

// Ensure Platform.select returns web styles without overriding shared Pressable mock
const mockPlatformSelect = () => {
  jest.spyOn(Platform, 'select').mockImplementation((obj) => obj.web || obj.default)
}

describe('IconButton', () => {
  beforeAll(() => {
    mockPlatformSelect()
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  const renderIconButton = async (props: Partial<React.ComponentProps<typeof IconButton>> = {}) => {
    return await render(
      <IconButton
        icon={<View testID="icon-view" />}
        label="Test icon button"
        {...props}
      />,
    )
  }

  it('renders icon and has correct accessibility label', async () => {
    const { getByTestId, getByLabelText } = await renderIconButton()

    expect(getByTestId('icon-view')).toBeTruthy()
    expect(getByLabelText('Test icon button')).toBeTruthy()
  })

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn()
    const { getByRole } = await renderIconButton({ onPress })

    const button = getByRole('button')
    await fireEvent.press(button)

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn()
    const { getByRole } = await renderIconButton({ onPress, disabled: true })

    const button = getByRole('button')
    expect(button.props.accessibilityState.disabled).toBe(true)
    expect(button.props.pointerEvents).toBe('none')
    expect(button.props.onPress).toBeUndefined()
    expect(button.props.onClick).toBeUndefined()
  })

  it('marks as active when active prop is true', async () => {
    const { getByRole } = await renderIconButton({ active: true })

    const button = getByRole('button')
    expect(button.props.accessibilityState.selected).toBe(true)
  })

  it('marks as not active when active prop is false', async () => {
    const { getByRole } = await renderIconButton({ active: false })

    const button = getByRole('button')
    expect(button.props.accessibilityState.selected).toBe(false)
  })

  it.each([false, true])('ordinary action omits selection state (showLabel=%s)', async (showLabel) => {
    const { getByRole } = await renderIconButton({ showLabel })
    expect(getByRole('button').props.accessibilityState).not.toHaveProperty('selected')
  })

  it('обе размерности держат минимальный тач-таргет 44dp (#1280)', async () => {
    // Здесь `Pressable` и есть видимая поверхность — внешней рамки нет, поэтому
    // объявленный размер И ЕСТЬ тач-таргет. До #1280 стояло 36/42: минимум был
    // задан, но ниже нормы, и его наследовали все потребители примитива.
    // Проверяем инвариант, а не конкретные числа, — иначе тест снова закрепит
    // случайное значение.
    const flatten = (node: any) =>
      Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style

    const { getByRole, rerender } = await renderIconButton({ size: 'sm' })
    const sm = flatten(getByRole('button'))
    expect(sm.width).toBeGreaterThanOrEqual(44)
    expect(sm.height).toBeGreaterThanOrEqual(44)
    expect(sm.width).toBe(sm.height)

    rerender(
      <IconButton
        icon={<View testID="icon-view" />}
        label="Test icon button"
        size="md"
      />,
    )

    const md = flatten(getByRole('button'))
    expect(md.width).toBeGreaterThanOrEqual(44)
    expect(md.height).toBeGreaterThanOrEqual(44)
    // `md` — дефолт, он же Android-рекомендация 48dp, и он не меньше `sm`.
    expect(md.width).toBeGreaterThanOrEqual(sm.width)
  })

  it('дефолтный размер (без пропа size) тоже не ниже 44dp', async () => {
    const { getByRole } = await renderIconButton({})
    const style = getByRole('button').props.style
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style

    expect(flat.minWidth).toBeGreaterThanOrEqual(44)
    expect(flat.minHeight).toBeGreaterThanOrEqual(44)
  })

  it('visualSize: рамка держит тач-таргет size, видимый круг — заданный размер (#1739)', async () => {
    // Пять потребителей (панель маршрута, лёгкий список точек, календарь даты,
    // цветные чипы) ужимали `style` до 26–36dp и жили вне гейта. Режим
    // `visualSize` даёт им прежний круг внутри полной рамки: рамка не меньше
    // 44, а в layout занимает ровно круг за счёт отрицательного поля.
    const flatten = (node: any) =>
      Array.isArray(node.props.style)
        ? Object.assign({}, ...node.props.style.filter(Boolean))
        : node.props.style

    const { getByRole, getByTestId } = await renderIconButton({
      size: 'sm',
      visualSize: 26,
      testID: 'compact',
      visualStyle: { backgroundColor: 'rgb(1, 2, 3)' },
    })
    const frame = flatten(getByRole('button'))
    expect(frame.width).toBeGreaterThanOrEqual(44)
    expect(frame.height).toBe(frame.width)
    expect(frame.margin).toBe(-(frame.width - 26) / 2)
    expect(frame.backgroundColor).toBe('transparent')

    const visual = flatten(getByTestId('compact-visual'))
    expect(visual.width).toBe(26)
    expect(visual.height).toBe(26)
    expect(visual.backgroundColor).toBe('rgb(1, 2, 3)')
  })

  it('visualSize не меньше рамки игнорируется — обычная кнопка без внутреннего круга', async () => {
    const { getByRole, queryByTestId } = await renderIconButton({ size: 'sm', visualSize: 44, testID: 'plain' })
    const style = getByRole('button').props.style
    const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style
    expect(flat.margin).toBeUndefined()
    expect(queryByTestId('plain-visual')).toBeNull()
  })

  it('forwards testID prop to Pressable', async () => {
    const { getByTestId } = await renderIconButton({ testID: 'icon-button' })

    expect(getByTestId('icon-button')).toBeTruthy()
  })
})
