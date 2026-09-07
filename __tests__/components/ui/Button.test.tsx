import { createRef } from 'react'
import { fireEvent, render } from '@testing-library/react-native'
import { StyleSheet, Text, View } from 'react-native'

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

  it.each(['primary', 'secondary', 'ghost', 'danger', 'outline', 'soft', 'danger-outline', 'tonal'] as const)(
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

  it('renders a trailingIcon after the label, alongside a leading icon', () => {
    const { getByTestId, getByText, toJSON } = render(
      <Button
        label="Награды"
        // Distinct a11y name so the visible label text is unambiguous in the tree.
        accessibilityLabel="Открыть награды"
        icon={<Text testID="lead-icon">L</Text>}
        trailingIcon={<Text testID="trail-icon">T</Text>}
      />,
    )

    // Both icons and the label coexist (leading + trailing simultaneously).
    expect(getByTestId('lead-icon')).toBeTruthy()
    expect(getByTestId('trail-icon')).toBeTruthy()
    expect(getByText('Награды')).toBeTruthy()

    // Render order: leading icon -> label -> trailing icon.
    const json = JSON.stringify(toJSON())
    const iLead = json.indexOf('lead-icon')
    const iLabel = json.indexOf('Награды')
    const iTrail = json.indexOf('trail-icon')
    expect(iLead).toBeLessThan(iLabel)
    expect(iLabel).toBeLessThan(iTrail)
  })

  it('renders a trailingIcon even without a leading icon', () => {
    const { getByTestId, getByText } = render(
      <Button label="Дальше" trailingIcon={<Text testID="trail-icon">T</Text>} />,
    )
    expect(getByText('Дальше')).toBeTruthy()
    expect(getByTestId('trail-icon')).toBeTruthy()
  })

  it('trailingIcon does not alter the accessible name', () => {
    const { getByRole } = render(
      <Button label="Награды" trailingIcon={<Text testID="trail-icon">T</Text>} />,
    )
    expect(getByRole('button').props.accessibilityLabel).toBe('Награды')
  })

  it('iconOnly ignores trailingIcon (renders only the leading icon)', () => {
    const { getByTestId, queryByTestId } = render(
      <Button
        label="Открыть карту"
        iconOnly
        icon={<Text testID="lead-icon">L</Text>}
        trailingIcon={<Text testID="trail-icon">T</Text>}
      />,
    )
    expect(getByTestId('lead-icon')).toBeTruthy()
    expect(queryByTestId('trail-icon')).toBeNull()
  })

  it('does not render a trailing slot when trailingIcon is omitted', () => {
    const { queryByTestId, getByText } = render(
      <Button label="Сохранить" icon={<Text testID="lead-icon">L</Text>} />,
    )
    expect(getByText('Сохранить')).toBeTruthy()
    expect(queryByTestId('trail-icon')).toBeNull()
  })

  it('forwards ref to the underlying pressable (focus-trap contract)', () => {
    const ref = createRef<View>()
    render(<Button label="Отмена" ref={ref} />)
    // ConfirmDialog relies on this ref to drive focus-trap initialFocus.
    expect(ref.current).not.toBeNull()
  })

  it('ужимает свою начинку: подпись сокращается внутри рамки, а не выходит за неё (#1853)', () => {
    // Ряд «иконка + подпись» идёт с дефолтом View flexShrink: 0, поэтому
    // кнопка, ограниченная по ширине снаружи (maxWidth/width/stretch),
    // держала подпись шириной по содержимому и выносила её за рамку вместо
    // многоточия, которое даёт numberOfLines={1}.
    const { getByText } = render(<Button label="Вернуться: 1. Печать высокого берега" />)

    const label = getByText('Вернуться: 1. Печать высокого берега')
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({ flexShrink: 1 })
    // parent — обёртка composite Text, ряд-контейнер живёт на шаг выше.
    const contentRow = label.parent?.parent
    expect(StyleSheet.flatten(contentRow?.props.style)).toMatchObject({ flexShrink: 1, minWidth: 0 })
  })

  it('forwards accessibilityHint', () => {
    const { getByRole } = render(
      <Button label="Открыть чат" accessibilityHint="Откроется внешнее приложение" />,
    )
    expect(getByRole('button').props.accessibilityHint).toBe('Откроется внешнее приложение')
  })
})
