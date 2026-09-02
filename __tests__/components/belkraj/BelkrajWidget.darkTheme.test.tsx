/**
 * Регресс #1697: в тёмной теме блок партнёрских предложений на экране квеста был
 * нечитаем — светлая страница `belkraj.by/partner/widget` (прозрачный body,
 * фиксированные цвета текста) лежала на тёмном `colors.surface`.
 *
 * Здесь глобальный мок темы из `__tests__/setup.ts` подменяется на ТЁМНУЮ
 * палитру: без этого проверка бессмысленна — в светлой теме `colors.surface`
 * и так белый, и старый код проходил бы тест.
 */
import { fireEvent, render } from '@testing-library/react-native'

import {
  MODERN_MATTE_PALETTE,
  MODERN_MATTE_PALETTE_DARK,
} from '@/constants/modernMattePalette'
import { BELKRAJ_WIDGET_SURFACE } from '@/components/belkraj/belkrajWidgetSurface'
import BelkrajWidgetNative from '@/components/belkraj/BelkrajWidget.native'
// Явное расширение: jest-expo резолвит с `defaultPlatform: 'ios'`, поэтому путь
// без него отдал бы `.native.tsx`, а нам нужен именно web-вариант — паритет
// подложки между платформами и проверяется. Тот же приём: export-web-mobile-guard.
import BelkrajWidgetWeb from '@/components/belkraj/BelkrajWidget.tsx'

const mockOpenExternalUrlInNewTab = jest.fn()
let mockIsDark = true

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrlInNewTab: (...args: unknown[]) => mockOpenExternalUrlInNewTab(...args),
}))

jest.mock('@/hooks/useTheme', () => {
  const {
    MODERN_MATTE_PALETTE_DARK: dark,
    MODERN_MATTE_SHADOWS_DARK,
    MODERN_MATTE_BOX_SHADOWS_DARK,
    MODERN_MATTE_GRADIENTS_DARK,
  } = require('@/constants/modernMattePalette')

  const darkColors = {
    ...dark,
    shadows: MODERN_MATTE_SHADOWS_DARK,
    boxShadows: MODERN_MATTE_BOX_SHADOWS_DARK,
    gradients: MODERN_MATTE_GRADIENTS_DARK,
  }

  return {
    useTheme: () => ({
      theme: mockIsDark ? 'dark' : 'light',
      isDark: mockIsDark,
      setTheme: jest.fn(),
      toggleTheme: jest.fn(),
    }),
    useThemedColors: () => mockIsDark
      ? darkColors
      : {
          ...require('@/constants/modernMattePalette').MODERN_MATTE_PALETTE,
          shadows: require('@/constants/modernMattePalette').MODERN_MATTE_SHADOWS,
          boxShadows: require('@/constants/modernMattePalette').MODERN_MATTE_BOX_SHADOWS,
          gradients: require('@/constants/modernMattePalette').MODERN_MATTE_GRADIENTS,
        },
    getThemedColors: () => darkColors,
  }
})

const MINSK = [{ id: 1, address: 'Минск', coord: '53.9,27.56' }]

// `canRenderBelkrajWidget` держит виджет закрытым вне production (isBelkrajEnabled),
// иначе он не отрисуется и проверять будет нечего.
const originalNodeEnv = process.env.NODE_ENV

beforeEach(() => {
  process.env.NODE_ENV = 'production'
  mockIsDark = true
  mockOpenExternalUrlInNewTab.mockClear()
})

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv
})

const flattenStyle = (style: unknown): Record<string, unknown> =>
  Array.isArray(style)
    ? style.reduce<Record<string, unknown>>((acc, item) => ({ ...acc, ...flattenStyle(item) }), {})
    : ((style ?? {}) as Record<string, unknown>)

describe('BelkrajWidget — web dark theme не показывает светлое полотно', () => {
  it('контейнер на native красится светлой подложкой, а не тёмным colors.surface', () => {
    const { getByTestId } = render(
      <BelkrajWidgetNative countryCode="BY" points={MINSK} cardsCount={6} />,
    )

    const style = flattenStyle(getByTestId('belkraj-native-container').props.style)

    expect(style.backgroundColor).toBe(BELKRAJ_WIDGET_SURFACE)
    expect(style.backgroundColor).not.toBe(MODERN_MATTE_PALETTE_DARK.surface)
  })

  it('сам WebView непрозрачен и светлый — иначе сквозь него видно тёмный фон', () => {
    const { getByTestId } = render(
      <BelkrajWidgetNative countryCode="BY" points={MINSK} cardsCount={6} />,
    )

    const style = flattenStyle(getByTestId('belkraj-native-webview').props.style)

    expect(style.backgroundColor).toBe(BELKRAJ_WIDGET_SURFACE)
    expect(style.backgroundColor).not.toBe('transparent')
  })

  it('OS-инверсия Android выключена — иначе тёмный текст партнёра станет светлым на светлой подложке', () => {
    const { getByTestId } = render(
      <BelkrajWidgetNative countryCode="BY" points={MINSK} cardsCount={6} />,
    )

    expect(getByTestId('belkraj-native-webview').props.forceDarkOn).toBe(false)
  })

  it('web-вариант заменяет светлый iframe компактной тематической CTA', () => {
    const { getByTestId, UNSAFE_queryAllByType } = render(
      <BelkrajWidgetWeb countryCode="BY" points={MINSK} cardsCount={6} />,
    )

    expect(getByTestId('belkraj-dark-theme-cta')).toBeTruthy()
    expect(getByTestId('belkraj-open-partner-catalog')).toBeTruthy()
    expect(UNSAFE_queryAllByType('iframe')).toHaveLength(0)
  })

  it('CTA открывает тот же city-level каталог через внешний chokepoint', () => {
    const { getByTestId } = render(
      <BelkrajWidgetWeb countryCode="BY" points={MINSK} cardsCount={6} />,
    )

    fireEvent.press(getByTestId('belkraj-open-partner-catalog'))

    expect(mockOpenExternalUrlInNewTab).toHaveBeenCalledTimes(1)
    const [rawUrl, options] = mockOpenExternalUrlInNewTab.mock.calls[0]
    const partnerUrl = new URL(rawUrl)

    expect(`${partnerUrl.origin}${partnerUrl.pathname}`).toBe('https://belkraj.by/partner/widget')
    expect(Object.fromEntries(partnerUrl.searchParams)).toMatchObject({
      lat: '53.9',
      lng: '27.56',
      term: 'place',
      country: 'BY',
      size: '6',
    })
    expect(options).toEqual(expect.objectContaining({ allowedProtocols: ['https:'] }))
  })

  it('светлая web-тема сохраняет исходную светлую подложку iframe', () => {
    mockIsDark = false

    const tree = render(
      <BelkrajWidgetWeb countryCode="BY" points={MINSK} cardsCount={6} />,
    ).toJSON() as { props: { style?: Record<string, unknown> } } | null

    expect(tree?.props?.style?.background).toBe(BELKRAJ_WIDGET_SURFACE)
    expect(tree?.props?.style?.colorScheme).toBe('light')
  })

  it('константа подложки не зависит от темы и равна светлой поверхности палитры', () => {
    expect(BELKRAJ_WIDGET_SURFACE).toBe(MODERN_MATTE_PALETTE.surface)
  })
})
