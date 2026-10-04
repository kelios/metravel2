import { Platform } from 'react-native'

import { ABOUT_LAYOUT, ABOUT_WIDE_MIN_WIDTH } from '@/components/about/aboutLayout'
import { CHIP_LAYOUT } from '@/components/ui/chipLayout'
import {
  assertBreakpointBlock,
  breakpointLayoutProps,
  breakpointStyle,
  buildBreakpointLayoutCss,
  defineBreakpointLayout,
} from '@/utils/breakpointLayout'
import { buildCriticalCSS } from '@/utils/criticalCSSBuilder'

// #2112: раскладка по брейкпоинту — один объект для React и для critical CSS.
describe('breakpointLayout', () => {
  const layout = defineBreakpointLayout({
    scope: 'demo',
    minWidth: 900,
    blocks: {
      row: {
        narrow: { flexDirection: 'column', gap: 16, flexGrow: 0 },
        wide: { flexDirection: 'row', gap: 24, flexGrow: 1.1 },
      },
      cell: { narrow: { width: '50%' }, wide: { width: '25%' } },
    },
  })

  it('React получает narrow/wide по живому брейкпоинту', () => {
    expect(breakpointStyle(layout, 'row', false)).toEqual({ flexDirection: 'column', gap: 16, flexGrow: 0 })
    expect(breakpointStyle(layout, 'row', true)).toEqual({ flexDirection: 'row', gap: 24, flexGrow: 1.1 })
  })

  it('CSS выпускается из wide того же объекта: px для чисел, без единиц у flex-grow, !important', () => {
    const css = buildBreakpointLayoutCss(layout)
    expect(css).toContain('@media (min-width:900px){')
    expect(css).toContain(
      '[data-bp-layout="demo-row"]{flex-direction:row !important;gap:24px !important;flex-grow:1.1 !important}',
    )
    expect(css).toContain('[data-bp-layout="demo-cell"]{width:25% !important}')
  })

  it('разные ключи narrow и wide — ошибка (иначе первый кадр разойдётся с React)', () => {
    expect(() =>
      assertBreakpointBlock('bad', { narrow: { width: '50%' }, wide: { width: '25%', minWidth: 180 } }),
    ).toThrow(/одинаковые ключи/)
  })

  it('метка сливается с уже заданным dataSet узла', () => {
    const prev = Platform.OS
    ;(Platform.OS as any) = 'web'
    try {
      expect(breakpointLayoutProps(layout, 'row', { dataSet: { screenContent: 'first' } })).toEqual({
        dataSet: { screenContent: 'first', bpLayout: 'demo-row' },
      })
    } finally {
      ;(Platform.OS as any) = prev
    }
  })

  it('реестр /about валиден и попадает в critical CSS', () => {
    for (const [key, block] of Object.entries(ABOUT_LAYOUT.blocks)) assertBreakpointBlock(key, block)
    const css = buildCriticalCSS()
    expect(css).toContain(`@media (min-width:${ABOUT_WIDE_MIN_WIDTH}px){`)
    expect(css).toContain(
      '[data-bp-layout="about-heroWrap"]{padding:32px !important;flex-direction:row !important;align-items:center !important;gap:32px !important}',
    )
    expect(css).toContain('[data-bp-layout="about-statsCell"]{width:25% !important}')
    expect(css).toContain(
      '[data-bp-layout="about-categoriesCard"]{width:calc(25% - 12px) !important;min-width:180px !important}',
    )
  })

  it('иконка чипа «от планшета» (#2157): display из реестра попадает в critical CSS от 768 px', () => {
    for (const [key, block] of Object.entries(CHIP_LAYOUT.blocks)) assertBreakpointBlock(key, block)
    expect(breakpointStyle(CHIP_LAYOUT, 'tabletIcon', false)).toEqual({ display: 'none' })
    const css = buildCriticalCSS()
    expect(css).toContain('[data-bp-layout="chip-tabletIcon"]{display:flex !important}')
    expect(buildBreakpointLayoutCss(CHIP_LAYOUT)).toContain('@media (min-width:768px){')
  })
})
