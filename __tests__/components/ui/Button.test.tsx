import { createRef } from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { Text, View } from 'react-native'

import Button from '@/components/ui/Button'

// Covers the canonical Button contract, including the design-system unification
// additions: variants `soft` / `danger-outline`, `iconOnly`, and `accessibilityHint`.
describe('ui/Button', () => {
  it('renders the label and fires onPress', () => {
    const onPress = jest.fn()
    const { getByText, getByRole } = render(<Button label="Сохранить" onPress={onPress} />)

    expect(getByText('Сохранить')).toBeTruthy()
    fireEvent.press(getByRole('button'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it.each(['primary', 'secondary', 'ghost', 'danger', 'outline', 'soft', 'danger-outline'] as const)(
    'renders variant "%s" with its label',
    (variant) => {
      const { getByText } = render(<Button label={`v-${variant}`} variant={variant} />)
      expect(getByText(`v-${variant}`)).toBeTruthy()
    },
  )

  it('marks the button disabled in accessibilityState when disabled', () => {
    const { getByRole } = render(<Button label="Готово" disabled />)
    const btn = getByRole('button')
    expect(btn.props.accessibilityState?.disabled).toBe(true)
    expect(btn.props.disabled).toBe(true)
  })

  it('marks the button busy and disabled while loading', () => {
    const { getByRole } = render(<Button label="Отправка" loading />)
    const btn = getByRole('button')
    expect(btn.props.accessibilityState?.busy).toBe(true)
    expect(btn.props.disabled).toBe(true)
  })

  it('iconOnly: hides the visible label but keeps it as the accessible name', () => {
    const { queryByText, getByLabelText } = render(
      <Button
        label="Открыть карту"
        iconOnly
        icon={<Text>◎</Text>}
      />,
    )

    // Visible text label is not rendered...
    expect(queryByText('Открыть карту')).toBeNull()
    // ...but the icon is, and the label survives as accessibilityLabel.
    expect(getByLabelText('Открыть карту')).toBeTruthy()
  })

  it('forwards ref to the underlying pressable (focus-trap contract)', () => {
    const ref = createRef<View>()
    render(<Button label="Отмена" ref={ref} />)
    // ConfirmDialog relies on this ref to drive focus-trap initialFocus.
    expect(ref.current).not.toBeNull()
  })

  it('forwards accessibilityHint', () => {
    const { getByRole } = render(
      <Button label="Открыть чат" accessibilityHint="Откроется внешнее приложение" />,
    )
    expect(getByRole('button').props.accessibilityHint).toBe('Откроется внешнее приложение')
  })
})
