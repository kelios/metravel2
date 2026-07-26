import { fireEvent, render } from '@testing-library/react-native'
import { StyleSheet, Text } from 'react-native'

import ToolActionsRow, { type ToolAction } from '@/components/ui/ToolActionsRow'

let mockResponsive: { isHydrated: boolean; isMobile: boolean } = {
  isHydrated: true,
  isMobile: false,
}

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive,
}))

const buildActions = (onPress = jest.fn()): ToolAction[] => [
  { key: 'dictate', label: 'Надиктовать', icon: <Text>mic</Text>, onPress },
  { key: 'import', label: 'Импорт текста', icon: <Text>upload</Text> },
  { key: 'paste', label: 'Вставить', icon: <Text>clipboard</Text> },
]

// Шаблон вспомогательных действий: desktop — иконка + подпись, mobile web и
// Android — icon-only одной строкой, подпись остаётся accessibilityLabel.
describe('ui/ToolActionsRow', () => {
  beforeEach(() => {
    mockResponsive = { isHydrated: true, isMobile: false }
  })

  it('renders icon + visible label on desktop', () => {
    const { getByText, getByLabelText } = render(<ToolActionsRow actions={buildActions()} />)

    expect(getByText('Надиктовать')).toBeTruthy()
    expect(getByText('Импорт текста')).toBeTruthy()
    expect(getByLabelText('Вставить')).toBeTruthy()
  })

  it('renders icon-only buttons with accessible labels on mobile', () => {
    mockResponsive = { isHydrated: true, isMobile: true }
    const { queryByText, getByLabelText, getByText } = render(
      <ToolActionsRow actions={buildActions()} />,
    )

    expect(queryByText('Надиктовать')).toBeNull()
    expect(queryByText('Импорт текста')).toBeNull()
    expect(getByLabelText('Надиктовать')).toBeTruthy()
    expect(getByLabelText('Вставить')).toBeTruthy()
    // Иконка остаётся единственным видимым содержимым кнопки.
    expect(getByText('mic')).toBeTruthy()

    const compactStyle = StyleSheet.flatten(getByLabelText('Надиктовать').props.style)
    expect(compactStyle).toMatchObject({ minWidth: 44, minHeight: 44 })
  })

  it('keeps labels until the web viewport is hydrated', () => {
    mockResponsive = { isHydrated: false, isMobile: true }
    const { getByText } = render(<ToolActionsRow actions={buildActions()} />)

    expect(getByText('Надиктовать')).toBeTruthy()
  })

  it('honours the explicit compact override', () => {
    const { queryByText, getByLabelText } = render(
      <ToolActionsRow actions={buildActions()} compact />,
    )

    expect(queryByText('Надиктовать')).toBeNull()
    expect(getByLabelText('Надиктовать')).toBeTruthy()
  })

  it('fires onPress and renders nothing without actions', () => {
    const onPress = jest.fn()
    const { getByLabelText } = render(<ToolActionsRow actions={buildActions(onPress)} />)

    fireEvent.press(getByLabelText('Надиктовать'))
    expect(onPress).toHaveBeenCalledTimes(1)

    const { toJSON } = render(<ToolActionsRow actions={[]} />)
    expect(toJSON()).toBeNull()
  })

  it('passes loading and disabled state through to the button', () => {
    const { getByLabelText } = render(
      <ToolActionsRow
        actions={[
          { key: 'import', label: 'Импорт', icon: <Text>upload</Text>, loading: true },
        ]}
      />,
    )

    const button = getByLabelText('Импорт')
    expect(button.props.accessibilityState?.busy).toBe(true)
    expect(button.props.accessibilityState?.disabled).toBe(true)
  })
})
