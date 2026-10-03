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
// без него отдал бы `.native.tsx`, а нам нужен именно web-вариант — подложка
// iframe проверяется на нём. Тот же приём: export-web-mobile-guard.
import BelkrajWidgetWeb from '@/components/belkraj/BelkrajWidget.tsx'

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: jest.fn(),
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
  it('native не показывает страницу партнёра — карточка-ссылка приложения на тематической поверхности', () => {
    // #2135: на native вместо WebView с belkraj.by карточка-ссылка во внешний
    // браузер. Это UI приложения, а не страница партнёра, поэтому она следует
    // теме, а светлая подложка BELKRAJ_WIDGET_SURFACE нужна только web-iframe.
    const { getByTestId, queryByTestId } = render(
      <BelkrajWidgetNative countryCode="BY" points={MINSK} cardsCount={6} />,
    )

    expect(queryByTestId('belkraj-native-webview')).toBeNull()
    const card = getByTestId('belkraj-native-link-card')
    const style = flattenStyle(
      typeof card.props.style === 'function' ? card.props.style({ pressed: false }) : card.props.style,
    )

    expect(style.backgroundColor).toBe(MODERN_MATTE_PALETTE_DARK.surface)
  })

  it('web-iframe лежит на светлой подложке партнёра, а не на тёмном colors.surface', () => {
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
