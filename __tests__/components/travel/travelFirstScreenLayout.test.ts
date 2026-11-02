import {
  TRAVEL_FIRST_SCREEN,
  TRAVEL_FIRST_SCREEN_STYLES,
  buildTravelFirstScreenMeta,
} from '@/components/travel/details/travelFirstScreenLayout'
import { METRICS } from '@/constants/layout'
import type { Travel } from '@/types/types'

const { buildSkeletonCSS, buildTravelSkeletonHtml } = require('../../../scripts/ssg-skeletons')

// #2904: mobile first screen of /travels/<slug> — h1 + meta above the gallery.
// The SSG shell (CommonJS, build time) cannot import the TS constants, so the
// numbers are duplicated there; this suite keeps both copies equal so the shell
// teardown cannot shift the hero (TRAVEL-DEFERRED-RESERVE-CLS-001).
describe('travel mobile first screen contract (#2904)', () => {
  const F = TRAVEL_FIRST_SCREEN

  it('uses the same breakpoint as useResponsive().isMobile', () => {
    expect(F.mobileMaxWidth).toBe(`${METRICS.breakpoints.tablet - 0.02}px`)
    expect(TRAVEL_FIRST_SCREEN_STYLES).toContain(`@media(max-width:${F.mobileMaxWidth}){`)
  })

  it('keeps the SSG shell geometry equal to the React stylesheet', () => {
    const css = buildSkeletonCSS()
    const mobile = css.match(/@media\(max-width:767\.98px\)\{(\.ssg-travel-wrap\{[^\n]*)\}\n/)?.[1] ?? ''
    expect(mobile).not.toBe('')
    expect(`${F.mobileMaxWidth}`).toBe('767.98px')

    // h1: same font and margins as the React heading. No clamp/overflow on
    // either side — post-deploy SEO check rejects a clipped travel H1.
    expect(css).toContain(
      `.ssg-travel-h1{margin:0 0 14px;font:700 ${F.titleFontSizePx}px/${F.titleLineHeight} `,
    )
    expect(mobile).toContain(
      `.ssg-travel-wrap>.ssg-travel-h1{margin:${F.titleMarginTopPx}px 0 ${F.titleMarginBottomPx}px}`,
    )
    expect(TRAVEL_FIRST_SCREEN_STYLES).toContain(
      `="title"]{order:-1;margin:${F.titleMarginTopPx}px 0 ${F.titleMarginBottomPx}px!important}`,
    )

    // Meta: the shell has no author/date values, so a bar reserves the exact
    // line height and bottom margin of the React meta line.
    expect(mobile).toContain(
      `.ssg-travel-first-meta{display:block;width:62%;height:${F.metaLineHeightPx}px;margin:0 0 ${F.metaMarginBottomPx}px;`,
    )
    expect(TRAVEL_FIRST_SCREEN_STYLES).toContain(
      `display:block;height:${F.metaLineHeightPx}px;margin:0 0 ${F.metaMarginBottomPx}px;font:400 ${F.metaFontSizePx}px/${F.metaLineHeightPx}px `,
    )

    // Same mechanism on both sides: DOM order stays desktop, order:-1 lifts.
    expect(mobile).toContain('.ssg-travel-wrap>.ssg-travel-h1,.ssg-travel-first-meta{order:-1}')
    expect(css).toContain('.ssg-travel-first-meta{display:none}')
  })

  it('passes the post-deploy visible-H1 check for the generated travel shell', () => {
    const { injectSkeletonShell } = require('../../../scripts/ssg-skeletons')
    const { validateTravelHtml } = require('../../../scripts/post-deploy-seo-check')
    const html = injectSkeletonShell(
      '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>',
      '/travels/test',
      { name: 'Маршрут', descriptionHtml: '<p>текст</p>' },
    )
    const codes = validateTravelHtml(html).map((issue: { code: string }) => issue.code)
    expect(codes).not.toContain('travel.h1.hidden')
    const reactTitleRule = TRAVEL_FIRST_SCREEN_STYLES.match(/="title"\]\{([^}]*)\}/)?.[1] ?? ''
    expect(reactTitleRule).toContain('order:-1')
    expect(reactTitleRule).not.toMatch(/overflow|line-clamp/)
  })

  it('places the SSG h1 and meta reserve between the first screen and the article', () => {
    const html = buildTravelSkeletonHtml({ name: 'Маршрут', descriptionHtml: '<p>x</p>' })
    const firstScreen = html.indexOf('class="ssg-travel-first-screen"')
    const h1 = html.indexOf('<h1 class="ssg-travel-h1">Маршрут</h1>')
    const meta = html.indexOf('<div class="ssg-travel-first-meta ssg-pulse" aria-hidden="true"></div>')
    const crawlable = html.indexOf('class="ssg-travel-crawlable"')
    expect(firstScreen).toBeGreaterThan(-1)
    expect(firstScreen).toBeLessThan(h1)
    expect(h1).toBeLessThan(meta)
    expect(meta).toBeLessThan(crawlable)
  })

  it('keeps desktop SSG order: the h1 stays aligned with the article column at ≥1280 px', () => {
    const css = buildSkeletonCSS()
    expect(css).toContain(
      '@media(min-width:1280px){.ssg-travel-wrap>.ssg-travel-h1{width:calc(100% - 323px);margin-left:323px}}',
    )
    // No ≥768 rule reorders the travel shell.
    const travelDesktopRules = css
      .split('\n')
      .filter((line: string) => /^@media\(min-width:[0-9]+px\)\{/.test(line) && line.includes('.ssg-travel-'))
    expect(travelDesktopRules.length).toBeGreaterThan(0)
    travelDesktopRules.forEach((line: string) => expect(line).not.toContain('order:'))
  })

  describe('buildTravelFirstScreenMeta', () => {
    const travel = (overrides: Partial<Travel> = {}) =>
      ({
        id: 1,
        name: 'Гродно',
        userName: 'Юля',
        monthName: 'Октябрь',
        year: '2019',
        number_days: 1,
        countryName: 'Беларусь',
        ...overrides,
      }) as Travel

    it('joins author, month year, days and country', () => {
      expect(buildTravelFirstScreenMeta(travel())).toBe('Юля · Октябрь 2019 · 1 день · Беларусь')
      expect(buildTravelFirstScreenMeta(travel({ number_days: 5 }))).toBe('Юля · Октябрь 2019 · 5 дней · Беларусь')
    })

    it('skips missing parts without leaving separators', () => {
      expect(
        buildTravelFirstScreenMeta(travel({ monthName: '', year: '', number_days: 0 as any })),
      ).toBe('Юля · Беларусь')
      expect(
        buildTravelFirstScreenMeta(travel({ userName: '', countryName: '', monthName: '', year: '' } as any)),
      ).toBe('1 день')
    })
  })
})
