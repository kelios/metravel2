import { ensureLeafletCss, isLeafletCoreCssApplied, whenLeafletCssReady } from '@/utils/ensureLeafletCss'

describe('ensureLeafletCss', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('injects map overrides when the Leaflet link was preloaded already', () => {
    const leafletLink = document.createElement('link')
    leafletLink.id = 'metravel-leaflet-css'
    leafletLink.rel = 'stylesheet'
    leafletLink.href = '/vendor/leaflet.css'
    document.head.appendChild(leafletLink)

    const markerClusterLink = document.createElement('link')
    markerClusterLink.id = 'metravel-markercluster-css'
    markerClusterLink.rel = 'stylesheet'
    markerClusterLink.href = '/vendor/MarkerCluster.css'
    document.head.appendChild(markerClusterLink)

    expect(ensureLeafletCss()).toBe(true)

    expect(document.getElementById('metravel-markercluster-css')).toBeTruthy()
    expect(
      document.getElementById('metravel-markercluster-overrides')?.textContent,
    ).toContain('@keyframes metravelClusterPulse')
    const overrides = document.getElementById('metravel-leaflet-overrides')?.textContent
    expect(overrides).toBeTruthy()
    expect(overrides).toContain('leaflet-popup-close-button')
    expect(overrides).toContain('pointer-events:auto!important')
    expect(overrides).toContain('z-index:30!important')
    expect(document.getElementById('metravel-tile-preconnect')).toBeTruthy()
  })

  it('injects self-hosted leaflet + markercluster stylesheets', () => {
    ensureLeafletCss()

    expect(document.getElementById('metravel-leaflet-css')?.getAttribute('href')).toBe(
      '/vendor/leaflet.css',
    )
    expect(document.getElementById('metravel-markercluster-css')?.getAttribute('href')).toBe(
      '/vendor/MarkerCluster.css',
    )
  })

  it('lets an instance theme survive every important container background, preserving other-map fallbacks', () => {
    ensureLeafletCss()
    const sheet = (document.getElementById('metravel-leaflet-overrides') as HTMLStyleElement).sheet!
    const backgrounds = (rules: CSSRuleList): Array<{ value: string; priority: string }> =>
      Array.from(rules).flatMap((rule) => {
        if ('cssRules' in rule) return backgrounds((rule as CSSGroupingRule).cssRules)
        const styleRule = rule as CSSStyleRule
        if (!styleRule.selectorText?.endsWith('.leaflet-container')) return []
        const value = styleRule.style.getPropertyValue('background-color')
        return value ? [{ value, priority: styleRule.style.getPropertyPriority('background-color') }] : []
      })
    const assertInstanceBackgroundWins = () => {
      const declarations = backgrounds(sheet.cssRules)
      expect(declarations.length).toBeGreaterThan(0)
      for (const declaration of declarations) {
        expect(declaration.priority).toBe('important')
        expect(declaration.value).toMatch(/^var\(--metravel-map-background,/)
      }
    }
    assertInstanceBackgroundWins()
    expect(backgrounds(sheet.cssRules).map(({ value }) => value)).toEqual([
      'var(--metravel-map-background,var(--color-backgroundTertiary))',
      'var(--metravel-map-background,#e8ebe4)',
      'var(--metravel-map-background,#e8ebe4)',
    ])
    // A later important rule with a fixed fill recreates the real production
    // failure even though the component's ordinary inline background is correct.
    const index = sheet.cssRules.length
    sheet.insertRule('@media (max-width:767.98px){html[data-theme="dark"] .leaflet-container{background-color:#e8ebe4!important}}', index)
    expect(assertInstanceBackgroundWins).toThrow()
    sheet.deleteRule(index)
    assertInstanceBackgroundWins()
  })

  it('falls back to the CDN when the self-hosted leaflet css fails to load (prod 404)', () => {
    ensureLeafletCss()

    const leaflet = document.getElementById('metravel-leaflet-css') as HTMLLinkElement
    const cluster = document.getElementById('metravel-markercluster-css') as HTMLLinkElement

    // Simulate the 404 -> SPA-html response the browser refuses to apply.
    leaflet.dispatchEvent(new Event('error'))
    cluster.dispatchEvent(new Event('error'))

    expect(leaflet.getAttribute('href')).toBe('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css')
    expect(cluster.getAttribute('href')).toBe(
      'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
    )
  })

  it('does not loop the fallback if the CDN copy also errors', () => {
    ensureLeafletCss()
    const leaflet = document.getElementById('metravel-leaflet-css') as HTMLLinkElement

    leaflet.dispatchEvent(new Event('error'))
    const afterFirst = leaflet.getAttribute('href')
    leaflet.dispatchEvent(new Event('error'))

    expect(leaflet.getAttribute('href')).toBe(afterFirst)
    expect(leaflet.getAttribute('data-css-fallback')).toBe('cdn')
  })
})

// #2324: движок Leaflet монтируется только после применения leaflet.css,
// иначе первые кадры рисуют тайлы/SVG в обычном потоке и дают layout shift.
describe('whenLeafletCssReady', () => {
  const applyLeafletCoreCss = () => {
    const style = document.createElement('style')
    style.textContent = '.leaflet-pane{z-index:400}'
    document.head.appendChild(style)
  }
  const settledFlag = (promise: Promise<void>) => {
    const state = { settled: false }
    promise.then(() => { state.settled = true })
    return state
  }

  beforeEach(() => {
    document.head.innerHTML = ''
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('resolves only after the injected leaflet.css link has loaded and applied', async () => {
    const state = settledFlag(whenLeafletCssReady({ waitInTestEnv: true }))
    await Promise.resolve()
    expect(state.settled).toBe(false)
    expect(isLeafletCoreCssApplied()).toBe(false)

    applyLeafletCoreCss()
    document.getElementById('metravel-leaflet-css')!.dispatchEvent(new Event('load'))
    await Promise.resolve()
    expect(state.settled).toBe(true)
    expect(document.querySelector('style[data-leaflet-fallback="true"]')).toBeNull()
  })

  it('falls back to the minimal pane/tile layout when leaflet.css never applies', async () => {
    const state = settledFlag(whenLeafletCssReady({ waitInTestEnv: true, timeoutMs: 3000 }))
    jest.advanceTimersByTime(2999)
    await Promise.resolve()
    expect(state.settled).toBe(false)

    jest.advanceTimersByTime(1)
    await Promise.resolve()
    expect(state.settled).toBe(true)
    const fallback = document.querySelector('style[data-leaflet-fallback="true"]')?.textContent
    expect(fallback).toContain('.leaflet-tile')
    expect(fallback).toContain('position:absolute')
    expect(isLeafletCoreCssApplied()).toBe(true)
  })

  it('applies the fallback layout right after the CDN copy also fails, without waiting for the timeout', async () => {
    const state = settledFlag(whenLeafletCssReady({ waitInTestEnv: true }))
    const link = document.getElementById('metravel-leaflet-css') as HTMLLinkElement

    link.dispatchEvent(new Event('error'))
    await Promise.resolve()
    expect(link.getAttribute('data-css-fallback')).toBe('cdn')
    expect(state.settled).toBe(false)

    link.dispatchEvent(new Event('error'))
    await Promise.resolve()
    expect(state.settled).toBe(true)
    expect(document.querySelector('style[data-leaflet-fallback="true"]')).toBeTruthy()
  })

  it('resolves immediately when Leaflet core CSS is already applied', async () => {
    applyLeafletCoreCss()
    const state = settledFlag(whenLeafletCssReady({ waitInTestEnv: true }))
    await Promise.resolve()
    expect(state.settled).toBe(true)
  })

  it('does not hold the engine in the test environment by default', async () => {
    const state = settledFlag(whenLeafletCssReady())
    await Promise.resolve()
    expect(state.settled).toBe(true)
    expect(document.querySelector('style[data-leaflet-fallback="true"]')).toBeTruthy()
  })
})
