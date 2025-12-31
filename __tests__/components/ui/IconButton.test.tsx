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

  const renderIconButton = (props: Partial<React.ComponentProps<typeof IconButton>> = {}) => {
    return render(
      <IconButton
        icon={<View testID="icon-view" />}
        label="Test icon button"
        {...props}
      />,
    )
  }

  it('renders icon and has correct accessibility label', () => {
    const { getByTestId, getByLabelText } = renderIconButton()

    expect(getByTestId('icon-view')).toBeTruthy()
    expect(getByLabelText('Test icon button')).toBeTruthy()
  })

  it('calls onPress when pressed', () => {
    const onPress = jest.fn()
    const { getByRole } = renderIconButton({ onPress })

    const button = getByRole('button')
    fireEvent.press(button)

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn()
    const { getByRole } = renderIconButton({ onPress, disabled: true })

    const button = getByRole('button')
    expect(button.props.accessibilityState.disabled).toBe(true)
    expect(button.props.pointerEvents).toBe('none')
    expect(button.props.onPress).toBeUndefined()
    expect(button.props.onClick).toBeUndefined()
  })

  it('marks as active when active prop is true', () => {
    const { getByRole } = renderIconButton({ active: true })

    const button = getByRole('button')
    expect(button.props.accessibilityState.selected).toBe(true)
  })

  it('marks as not active when active prop is false', () => {
    const { getByRole } = renderIconButton({ active: false })

    const button = getByRole('button')
    expect(button.props.accessibilityState.selected).toBe(false)
  })

  it('applies size="sm" and size="md" via style dimensions', () => {
    const { getByRole, rerender } = renderIconButton({ size: 'sm' })
    const buttonSm = getByRole('button')

    // Стиль задаётся функцией, в тестах он уже развёрнут в props.style
    const flattenSm = Array.isArray(buttonSm.props.style) ? Object.assign({}, ...buttonSm.props.style) : buttonSm.props.style
    expect(flattenSm.width).toBe(36)
    expect(flattenSm.height).toBe(36)

    rerender(
      <IconButton
        icon={<View testID="icon-view" />}
        label="Test icon button"
        size="md"
      />,
    )

    const buttonMd = getByRole('button')
    const flattenMd = Array.isArray(buttonMd.props.style) ? Object.assign({}, ...buttonMd.props.style) : buttonMd.props.style
    expect(flattenMd.width).toBe(42)
    expect(flattenMd.height).toBe(42)
  })

  it('forwards testID prop to Pressable', () => {
    const { getByTestId } = renderIconButton({ testID: 'icon-button' })

    expect(getByTestId('icon-button')).toBeTruthy()
  })
})
