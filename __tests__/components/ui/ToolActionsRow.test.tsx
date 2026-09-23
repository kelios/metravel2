import { fireEvent, render } from '@testing-library/react-native'
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'

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

const exportActions = (): ToolAction[] => [
  { key: 'gpx', label: 'Скачать GPX', compactLabel: 'GPX', icon: <Text>download</Text> },
  { key: 'kml', label: 'Скачать KML', compactLabel: 'KML', icon: <Text>download</Text> },
  {
    key: 'original',
    label: 'Скачать оригинал',
    compactLabel: 'Оригинал',
    icon: <Text>download</Text>,
  },
]

// Корень ряда — View с `flexWrap`: ряд переносит кнопки или держит одну строку.
const rowStyle = (tree: ReturnType<ReturnType<typeof render>['toJSON']>) =>
  StyleSheet.flatten((tree as { props: { style?: StyleProp<ViewStyle> } }).props.style)

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

  // #1414 (TestFlight 1.0.5 (8)): «иконки непонятные что они значат» — три
  // кнопки экспорта несут одну и ту же иконку `download`, поэтому в compact-ряду
  // им нужна короткая видимая подпись, а полное имя остаётся у screen reader.
  it('keeps a short visible caption for actions that share one icon on mobile', () => {
    mockResponsive = { isHydrated: true, isMobile: true }
    const { getByText, queryByText, getByLabelText } = render(
      <ToolActionsRow
        actions={[
          {
            key: 'gpx',
            label: 'Поделиться GPX',
            compactLabel: 'GPX',
            icon: <Text>download</Text>,
          },
          {
            key: 'kml',
            label: 'Поделиться KML',
            compactLabel: 'KML',
            icon: <Text>download</Text>,
          },
          { key: 'import', label: 'Импорт текста', icon: <Text>upload</Text> },
        ]}
      />,
    )

    expect(getByText('GPX')).toBeTruthy()
    expect(getByText('KML')).toBeTruthy()
    expect(queryByText('Поделиться GPX')).toBeNull()
    expect(getByLabelText('Поделиться GPX')).toBeTruthy()
    expect(getByLabelText('Поделиться KML')).toBeTruthy()

    // Действие без `compactLabel` остаётся icon-only — шаблон не меняется.
    expect(queryByText('Импорт текста')).toBeNull()
    expect(
      StyleSheet.flatten(getByLabelText('Импорт текста').props.style),
    ).toMatchObject({ minWidth: 44, minHeight: 44 })

    // Тач-таргет подписанной кнопки держит высота: ширину задаёт слово.
    expect(
      StyleSheet.flatten(getByLabelText('Поделиться GPX').props.style),
    ).toMatchObject({ minHeight: 44 })
  })

  it('shows the full label instead of the compact one on desktop', () => {
    const { getByText, queryByText } = render(
      <ToolActionsRow
        actions={[
          {
            key: 'gpx',
            label: 'Скачать GPX',
            compactLabel: 'GPX',
            icon: <Text>download</Text>,
          },
        ]}
      />,
    )

    expect(getByText('Скачать GPX')).toBeTruthy()
    expect(queryByText('GPX')).toBeNull()
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

  // #2053: compact-ряд держался одной строкой за счёт `flexShrink: 1` у
  // подписанных кнопок, и на 320dp «GPX»/«KML» сжимались до 0 px. Правило слоя:
  // подписанная кнопка не уже своей подписи, не хватает ширины — ряд
  // переносится, а длинная подпись встаёт в две строки.
  describe('labelled buttons are never squeezed (#2053)', () => {
    it('keeps compact-labelled buttons at their label width and lets the row wrap', () => {
      mockResponsive = { isHydrated: true, isMobile: true }
      const { getByLabelText, getByText, toJSON } = render(
        <ToolActionsRow actions={exportActions()} />,
      )

      for (const label of ['Скачать GPX', 'Скачать KML', 'Скачать оригинал']) {
        const style = StyleSheet.flatten(getByLabelText(label).props.style)
        expect(style.flexShrink).toBe(0)
        expect(style.maxWidth).toBe('100%')
      }
      expect(getByText('Оригинал').props.numberOfLines).toBe(2)
      expect(rowStyle(toJSON()).flexWrap).toBe('wrap')
    })

    it('wraps a row where only some compact actions carry a caption', () => {
      mockResponsive = { isHydrated: true, isMobile: true }
      const { getByLabelText, toJSON } = render(
        <ToolActionsRow
          actions={[
            { key: 'import', label: 'Импорт текста', icon: <Text>upload</Text> },
            ...exportActions(),
          ]}
        />,
      )

      expect(rowStyle(toJSON()).flexWrap).toBe('wrap')
      expect(StyleSheet.flatten(getByLabelText('Импорт текста').props.style)).toMatchObject({
        flexShrink: 0,
        minWidth: 44,
      })
    })

    it('keeps an icon-only row on one line', () => {
      mockResponsive = { isHydrated: true, isMobile: true }
      const { getByLabelText, toJSON } = render(<ToolActionsRow actions={buildActions()} />)

      expect(rowStyle(toJSON()).flexWrap).toBe('nowrap')
      expect(StyleSheet.flatten(getByLabelText('Надиктовать').props.style).flexShrink).toBe(0)
    })

    it('wraps a labelled desktop row without shrinking its buttons', () => {
      const { getByLabelText, getByText, toJSON } = render(
        <ToolActionsRow actions={buildActions()} />,
      )

      expect(rowStyle(toJSON()).flexWrap).toBe('wrap')
      expect(StyleSheet.flatten(getByLabelText('Надиктовать').props.style)).toMatchObject({
        flexShrink: 0,
        maxWidth: '100%',
      })
      expect(getByText('Надиктовать').props.numberOfLines).toBe(2)
    })

    it('stretches fill buttons across the row with their full labels on a phone', () => {
      mockResponsive = { isHydrated: true, isMobile: true }
      const { getByLabelText, getByText, queryByText, toJSON } = render(
        <ToolActionsRow actions={exportActions().slice(0, 2)} compact={false} fill />,
      )

      expect(getByText('Скачать GPX')).toBeTruthy()
      expect(queryByText('GPX')).toBeNull()
      const gpx = StyleSheet.flatten(getByLabelText('Скачать GPX').props.style)
      expect(gpx).toMatchObject({ flexGrow: 1, flexShrink: 0, maxWidth: '100%' })
      // Равные по смыслу кнопки — один стиль: одинаковое растяжение и вариант.
      expect(StyleSheet.flatten(getByLabelText('Скачать KML').props.style)).toEqual(gpx)
      expect(rowStyle(toJSON()).flexWrap).toBe('wrap')
    })
  })
})
