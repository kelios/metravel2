import fs from 'fs'
import path from 'path'
import { LEAFLET_CSS } from '@/utils/leafletCssAsset'
import { LEAFLET_CSS as nativeLeafletCss } from '@/utils/leafletInlineAsset'
import { buildMapHeadBootstrapScript } from '@/utils/mapHeadBootstrap'
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

  it('caps visual readiness at 1000 ms even if a caller requests 3000 ms', async () => {
    const state = settledFlag(whenLeafletCssReady({ waitInTestEnv: true, timeoutMs: 3000 }))
    jest.advanceTimersByTime(999)
    await Promise.resolve()
    expect(state.settled).toBe(false)

    jest.advanceTimersByTime(1)
    await Promise.resolve()
    expect(state.settled).toBe(true)
    const fallback = document.querySelector('style[data-leaflet-fallback="true"]')?.textContent
    expect(fallback).toContain('.leaflet-tile')
    expect(fallback).toMatch(/position:\s*absolute/)
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

  it('uses the complete installed vendor geometry, keeping the native CSS asset byte-identical', async () => {
    const vendor = fs.readFileSync(path.resolve(process.cwd(), 'node_modules/leaflet/dist/leaflet.css'), 'utf8')
    expect(LEAFLET_CSS).toBe(vendor)
    expect(nativeLeafletCss).toBe(vendor)
    await whenLeafletCssReady()
    const fallback = document.querySelector<HTMLStyleElement>('style[data-leaflet-fallback="true"]')!
    expect(fallback.textContent).toBe(vendor.replace(/url\(images\//g, 'url(/vendor/images/'))
    // Full vendor equality holds font, box, border, zoom/layer dimensions and
    // specificity (including attribution's margin:0), not only pane z-index.
    expect(fallback.sheet!.cssRules.length).toBeGreaterThan(80)
    const source = fs.readFileSync(path.resolve(process.cwd(), 'utils/ensureLeafletCss.ts'), 'utf8')
    expect(source).not.toContain('leafletInlineAsset')
  })

  it('remembers failures that occurred before a readiness consumer subscribed', async () => {
    ensureLeafletCss()
    const link = document.getElementById('metravel-leaflet-css') as HTMLLinkElement
    link.dispatchEvent(new Event('error'))
    link.dispatchEvent(new Event('error'))
    const state = settledFlag(whenLeafletCssReady({ waitInTestEnv: true }))
    await Promise.resolve()
    expect(state.settled).toBe(true)
    expect(jest.getTimerCount()).toBe(0)
    expect(isLeafletCoreCssApplied()).toBe(true)
  })

  it('remembers both failed HTML-preload requests before the map module attaches', async () => {
    window.history.replaceState({}, '', '/map')
    try {
      new Function(buildMapHeadBootstrapScript())()
      const link = document.getElementById('metravel-leaflet-css') as HTMLLinkElement
      link.dispatchEvent(new Event('error'))
      link.dispatchEvent(new Event('error'))
      const state = settledFlag(whenLeafletCssReady({ waitInTestEnv: true }))
      await Promise.resolve()
      expect(state.settled).toBe(true)
      expect(jest.getTimerCount()).toBe(0)
      expect(document.querySelectorAll('link#metravel-leaflet-css')).toHaveLength(1)
      expect(document.querySelectorAll('style[data-leaflet-fallback="true"]')).toHaveLength(1)
    } finally {
      window.history.replaceState({}, '', '/')
    }
  })

  it('uses one readiness subscription and cleans listeners and timer after both consumers settle', async () => {
    ensureLeafletCss()
    const link = document.getElementById('metravel-leaflet-css') as HTMLLinkElement
    const add = jest.spyOn(link, 'addEventListener')
    const remove = jest.spyOn(link, 'removeEventListener')
    const first = whenLeafletCssReady({ waitInTestEnv: true })
    const second = whenLeafletCssReady({ waitInTestEnv: true })
    expect(first).toBe(second)
    expect(add.mock.calls.map(([type]) => type)).toEqual(['load', 'error'])
    expect(jest.getTimerCount()).toBe(1)
    link.dispatchEvent(new Event('error'))
    link.dispatchEvent(new Event('error'))
    await Promise.all([first, second])
    expect(remove.mock.calls.map(([type]) => type)).toEqual(['load', 'error'])
    expect(jest.getTimerCount()).toBe(0)
    add.mockRestore()
    remove.mockRestore()
  })

  it('finishes a successful link event with missing core rules using the full fallback immediately', async () => {
    const state = settledFlag(whenLeafletCssReady({ waitInTestEnv: true }))
    document.getElementById('metravel-leaflet-css')!.dispatchEvent(new Event('load'))
    await Promise.resolve()
    expect(state.settled).toBe(true)
    expect(isLeafletCoreCssApplied()).toBe(true)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('reserves the whole default credit without truncation inside the map control corner', () => {
    ensureLeafletCss()
    const rules = Array.from((document.getElementById('metravel-leaflet-overrides') as HTMLStyleElement).sheet!.cssRules)
      .filter((rule): rule is CSSStyleRule => 'selectorText' in rule)
    const corner = rules.find((rule) => rule.selectorText === '.leaflet-container .leaflet-bottom')!
    const credit = rules.find((rule) => rule.selectorText === '.leaflet-container .leaflet-control-attribution')!
    expect(corner.style.getPropertyValue('max-width')).toBe('100%')
    expect(credit.style.getPropertyValue('max-width')).toBe('100%')
    expect(credit.style.getPropertyValue('min-height')).toBe('calc(2.7em + 4px)')
    expect(credit.style.getPropertyValue('white-space')).toBe('normal')
    expect(credit.style.getPropertyValue('overflow')).toBe('visible')
    expect(credit.style.getPropertyValue('text-overflow')).toBe('clip')
    // CSS declarations are a regression control; JSDOM is not pixel/CLS evidence.
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
