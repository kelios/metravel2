import { render } from '@testing-library/react-native'
import { Platform, StyleSheet } from 'react-native'

import { APP_DOWNLOAD_LAYOUT } from '@/components/appDownload/appDownloadLayout'
import { HEADING_LAYOUTS, headingTypography } from '@/components/ui/headingLayout'
import { METRICS } from '@/constants/layout'
import { assertBreakpointBlock, buildBreakpointLayoutCss } from '@/utils/breakpointLayout'
import { buildCriticalCSS } from '@/utils/criticalCSSBuilder'

// #2258 (механизм #2112): кегль Heading — одна таблица для React и critical CSS.
let mockWidth = 0
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => {
    const bp = require('@/constants/layout').METRICS.breakpoints
    const w = mockWidth
    return {
      width: w,
      isPhone: w >= bp.phone && w < bp.largePhone,
      isLargePhone: w >= bp.largePhone && w < bp.tablet,
      isTablet: w >= bp.tablet && w < bp.largeTablet,
      isDesktop: w >= bp.desktop,
    }
  },
}))

const { Heading } = require('@/components/ui/Typography')

/** Что даст cascade critical CSS на ширине w: последняя ступень с minWidth ≤ w, иначе статический HTML. */
const cssTypography = (level: 1 | 2 | 3 | 4, w: number) => {
  const key = `h${level}` as const
  const hit = [...HEADING_LAYOUTS].reverse().find((layout) => w >= layout.minWidth)
  return hit ? hit.blocks[key].wide : HEADING_LAYOUTS[0].blocks[key].narrow
}

const renderHeading = (level: 1 | 2 | 3 | 4, width: number, props: Record<string, unknown> = {}) => {
  mockWidth = width
  const { getByText } = render(
    <Heading level={level} {...props}>
      Заголовок
    </Heading>,
  )
  const node = getByText('Заголовок')
  const flat = StyleSheet.flatten(node.props.style)
  return { node, typography: { fontSize: flat.fontSize, lineHeight: flat.lineHeight, letterSpacing: flat.letterSpacing } }
}

describe('Heading: типографика по ступеням ширины (#2258)', () => {
  const prevOS = Platform.OS
  beforeEach(() => {
    ;(Platform.OS as any) = 'web'
  })
  afterAll(() => {
    ;(Platform.OS as any) = prevOS
  })

  it('прежние значения fluidSize сохранены (вид страниц не меняется)', () => {
    expect(headingTypography(1, 'narrow')).toEqual({ fontSize: 22, lineHeight: 26, letterSpacing: -0.5 })
    expect(headingTypography(1, 'tablet')).toEqual({ fontSize: 29, lineHeight: 35, letterSpacing: -0.8 })
    expect(headingTypography(1, 'largeTablet')).toEqual({ fontSize: 26, lineHeight: 31, letterSpacing: -0.8 })
    expect(headingTypography(1, 'desktop')).toEqual({ fontSize: 32, lineHeight: 38, letterSpacing: -0.8 })
    expect(headingTypography(4, 'desktop')).toEqual({ fontSize: 16, lineHeight: 22, letterSpacing: -0.1 })
  })

  it.each([1, 2, 3, 4] as const)('h%d: гидратированный React = первый кадр из CSS на каждой ширине', (level) => {
    const b = METRICS.breakpoints
    for (const w of [320, 390, b.tablet - 1, b.tablet, b.largeTablet - 1, b.largeTablet, b.desktop - 1, b.desktop, 1920]) {
      expect({ w, ...renderHeading(level, w).typography }).toEqual({ w, ...cssTypography(level, w) })
    }
  })

  it('статический HTML (width = 0) несёт узкую ступень — как телефон', () => {
    expect(renderHeading(1, 0).typography).toEqual(headingTypography(1, 'narrow'))
    expect(renderHeading(1, 390).typography).toEqual(headingTypography(1, 'narrow'))
  })

  it('метка ступени на узле, чужой dataSet сохраняется', () => {
    const { node } = renderHeading(2, 0, { dataSet: { mapPageHeading: 'panel-head' } })
    expect(node.props.dataSet).toEqual({ mapPageHeading: 'panel-head', bpLayout: 'heading-h2' })
  })

  it('свой кегль у вызывающего — CSS-ступени к узлу не цепляются', () => {
    const { node } = renderHeading(1, 1280, { style: { fontSize: 40, lineHeight: 48 }, dataSet: { x: 'y' } })
    expect(node.props.dataSet).toEqual({ x: 'y' })
    expect(StyleSheet.flatten(node.props.style).fontSize).toBe(40)
  })

  it('ступени попадают в critical CSS по возрастанию ширины', () => {
    for (const layout of HEADING_LAYOUTS) {
      for (const [key, block] of Object.entries(layout.blocks)) assertBreakpointBlock(key, block)
    }
    const widths = HEADING_LAYOUTS.map((layout) => layout.minWidth)
    expect(widths).toEqual([...widths].sort((a, b) => a - b))
    const css = buildCriticalCSS()
    const at = HEADING_LAYOUTS.map((layout) => css.indexOf(buildBreakpointLayoutCss(layout)))
    expect(at.every((i) => i >= 0)).toBe(true)
    expect(at).toEqual([...at].sort((a, b) => a - b))
    expect(css).toContain('[data-bp-layout="heading-h1"]{font-size:32px !important;line-height:38px !important;letter-spacing:-0.8px !important}')
  })

  it('/app: карточки возможностей в две колонки от 900 px с первого кадра', () => {
    for (const [key, block] of Object.entries(APP_DOWNLOAD_LAYOUT.blocks)) assertBreakpointBlock(key, block)
    const css = buildCriticalCSS()
    expect(css).toContain('@media (min-width:900px){')
    expect(css).toContain('[data-bp-layout="app-download-featureCard"]{width:46% !important}')
  })
})

describe.each(['android', 'ios'] as const)('Heading native width tiers on %s (#2332)', (platform) => {
  const originalOS = Platform.OS
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: platform, configurable: true })
  })
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true })
  })

  it.each([1, 2, 3, 4] as const)('h%d follows the existing registered tiers at every boundary', (level) => {
    for (const width of [0, 320, 390, 767, 768, 1023, 1024, 1279, 1280]) {
      expect({ width, ...renderHeading(level, width).typography }).toEqual({ width, ...cssTypography(level, width) })
    }
  })

  it('updates the mounted heading on live portrait/landscape/tablet width changes', () => {
    mockWidth = 390
    const { getByText, rerender } = render(<Heading level={1}>Native resize</Heading>)
    for (const [width, fontSize] of [[390, 22], [844, 29], [1024, 26], [1280, 32], [390, 22]]) {
      mockWidth = width
      rerender(<Heading level={1}>Native resize</Heading>)
      expect(StyleSheet.flatten(getByText('Native resize').props.style).fontSize).toBe(fontSize)
    }
  })

  it.each(['fontSize', 'lineHeight', 'letterSpacing'] as const)('keeps composed caller-owned %s and heading semantics', (property) => {
    const override = { [property]: 41 }
    const registered = StyleSheet.create({ override }).override
    const { node } = renderHeading(3, 1280, {
      style: [{ textAlign: 'right' }, registered],
      color: 'custom-color',
      dataSet: { caller: 'native' },
    })
    const style = StyleSheet.flatten(node.props.style)
    expect(style[property]).toBe(41)
    expect(style.color).toBe('custom-color')
    expect(style.textAlign).toBe('right')
    expect(node.props.accessibilityRole).toBe('header')
    expect(node.props['aria-level']).toBe(3)
    expect(node.props.dataSet).toEqual({ caller: 'native' })
  })
})
