/**
 * Регресс #1697: в тёмной теме блок партнёрских предложений на экране квеста был
 * нечитаем — светлая страница `belkraj.by/partner/widget` (прозрачный body,
 * фиксированные цвета текста) лежала на тёмном `colors.surface`.
 *
 * Здесь глобальный мок темы из `__tests__/setup.ts` подменяется на ТЁМНУЮ
 * палитру: без этого проверка бессмысленна — в светлой теме `colors.surface`
 * и так белый, и старый код проходил бы тест.
 */
import { render } from '@testing-library/react-native'

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

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrlInNewTab: jest.fn(),
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
    useTheme: () => ({ theme: 'dark', isDark: true, setTheme: jest.fn(), toggleTheme: jest.fn() }),
    useThemedColors: () => darkColors,
    getThemedColors: () => darkColors,
  }
})

const MINSK = [{ id: 1, address: 'Минск', coord: '53.9,27.56' }]

// `canRenderBelkrajWidget` держит виджет закрытым вне production (isBelkrajEnabled),
// иначе он не отрисуется и проверять будет нечего.
const originalNodeEnv = process.env.NODE_ENV

beforeEach(() => {
  process.env.NODE_ENV = 'production'
})

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv
})

const flattenStyle = (style: unknown): Record<string, unknown> =>
  Array.isArray(style)
    ? style.reduce<Record<string, unknown>>((acc, item) => ({ ...acc, ...flattenStyle(item) }), {})
    : ((style ?? {}) as Record<string, unknown>)

describe('BelkrajWidget — подложка стороннего виджета не следует тёмной теме (#1697)', () => {
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

  it('web-вариант берёт ту же подложку, что и native — платформы не расходятся', () => {
    const tree = render(
      <BelkrajWidgetWeb countryCode="BY" points={MINSK} cardsCount={6} />,
    ).toJSON() as { props: { style?: Record<string, unknown> } } | null

    expect(tree?.props?.style?.background).toBe(BELKRAJ_WIDGET_SURFACE)
    expect(tree?.props?.style?.background).not.toBe('var(--color-surface)')
  })

  it('web-слот пинит светлую color-scheme — иначе UA красит подложку кросс-доменного iframe сам', () => {
    const tree = render(
      <BelkrajWidgetWeb countryCode="BY" points={MINSK} cardsCount={6} />,
    ).toJSON() as { props: { style?: Record<string, unknown> } } | null

    expect(tree?.props?.style?.colorScheme).toBe('light')
  })

  it('константа подложки не зависит от темы и равна светлой поверхности палитры', () => {
    expect(BELKRAJ_WIDGET_SURFACE).toBe(MODERN_MATTE_PALETTE.surface)
  })
})
