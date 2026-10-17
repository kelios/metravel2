import { DESIGN_TOKENS } from '@/constants/designSystem'
import {
  buildBirdMarkerHtml,
  buildClusterIconHtml,
  buildMapPinHtml,
  buildPlaceMarkerIconHtml,
} from '@/components/MapPage/Map/mapMarkerStyles'

// Decode only the percent-encoded SVG inside `url(...)`; the rest of the markup
// legitimately contains `%` (gradient stops).
const decodeDataUris = (html: string) =>
  html.replace(/url\(([^)]*)\)/g, (_match, uri: string) => `url(${decodeURIComponent(uri)})`)

// Element nodes the markup puts inside `.leaflet-marker-icon` (#2451 contract).
const countElements = (html: string) => {
  const host = document.createElement('div')
  host.innerHTML = html
  return host.querySelectorAll('*').length
}

// Largest blur radius among `box-shadow` declarations (spread rings have 0 blur).
const maxShadowBlur = (html: string) => {
  const blurs: number[] = []
  for (const [, value] of html.matchAll(/box-shadow:([^;"]+)/g)) {
    for (const layer of value.split(/,(?![^(]*\))/)) {
      if (/inset/.test(layer)) continue
      const lengths = layer.trim().match(/-?\d+(?:\.\d+)?px|\b0\b/g) ?? []
      blurs.push(lengths[2] ? parseFloat(lengths[2]) : 0)
    }
  }
  return Math.max(0, ...blurs)
}

describe('buildClusterIconHtml', () => {
  it('uses the primary-on-dark text token by default for cluster labels', () => {
    const { html, label } = buildClusterIconHtml({ count: 13 })

    expect(label).toBe('13')
    expect(html).toContain(`color: ${String(DESIGN_TOKENS.colors.textOnPrimary)};`)
    expect(html).not.toContain(`color: ${String(DESIGN_TOKENS.colors.primaryDark)};`)
  })

  it('renders a layered cluster shell with a capped label', () => {
    const { html, label } = buildClusterIconHtml({ count: 1250 })

    expect(label).toBe('999+')
    expect(html).toContain('radial-gradient(circle at 32% 24%')
    expect(html).toContain('letter-spacing: 0;')
  })

  // #2451 — one node, no infinite pulse, short shadow, no GPU layer hints.
  it.each([2, 13, 64, 250, 1250])('keeps the cluster for count %i to one light DOM node', (count) => {
    const { html, metrics } = buildClusterIconHtml({ count, isDark: count % 2 === 0 })

    expect(countElements(html)).toBe(1)
    expect(html).not.toContain('animation')
    expect(html).not.toContain('will-change')
    expect(html).not.toContain('translateZ')
    expect(maxShadowBlur(html)).toBeLessThanOrEqual(8)
    // The single node is exactly the icon box, so it is centred on the anchor.
    expect(html).toContain(`width: ${metrics.size}px;`)
    expect(html).toContain(`height: ${metrics.size}px;`)
  })
})

describe('buildBirdMarkerHtml', () => {
  it('renders the polished branded marker shell', () => {
    const html = buildBirdMarkerHtml()

    expect(html).toContain('width: 48px;')
    expect(html).toContain('height: 58px;')
    expect(html).toContain('transform: rotate(-45deg);')
    expect(html).toContain(String(DESIGN_TOKENS.colors.brand))
    expect(html).toContain(String(DESIGN_TOKENS.colors.brandLight))
    // FE-ICN-B: маркер несёт векторную бренд-птицу инлайн-SVG
    // (заменил растровый logo_yellow_60x60.png — мягкий на retina).
    expect(html).toContain('<svg')
    expect(html).toContain('viewBox="0 0 100 100"')
  })

  it('drops GPU layer hints from the route start/end pins too', () => {
    const html = buildMapPinHtml('#00aa00')

    expect(html).not.toContain('will-change')
    expect(html).not.toContain('translateZ')
    expect(maxShadowBlur(html)).toBeLessThanOrEqual(8)
  })

  // #843 — the same helper output is serialized into the native WebView divIcon
  // template (Map.ios / TravelMap.native) via JSON.stringify. It must contain no
  // single quotes so it can also drop into single-quoted contexts without escaping,
  // and no external/raster asset references (inline SVG only).
  it('is native-WebView-safe: no single quotes, no raster/external asset refs', () => {
    const html = buildBirdMarkerHtml()

    expect(html).not.toContain("'")
    expect(html).not.toContain('data:image')
    // No raster/external asset <img> refs — inline SVG only (xmlns namespace is fine).
    expect(html).not.toContain('<img')
    expect(html).not.toContain('url(http')
    // Round-trips through JSON without throwing (used as the injected divIcon html).
    expect(() => JSON.parse(JSON.stringify(html))).not.toThrow()
  })
})

// #2451 — the web place marker: same picture, ≤2 DOM nodes, no own GPU layer.
describe('buildPlaceMarkerIconHtml', () => {
  it('draws the same branded pin: teardrop + disc with the bird SVG', () => {
    const html = buildPlaceMarkerIconHtml()

    // Teardrop 40×46 rotated into a pin + 30px disc, inside the 48×58 icon box.
    expect(html).toContain('width: 40px;')
    expect(html).toContain('height: 46px;')
    expect(html).toContain('transform: rotate(-45deg);')
    expect(html).toContain(String(DESIGN_TOKENS.colors.brand))
    expect(html).toContain(String(DESIGN_TOKENS.colors.brandLight))
    const decoded = decodeDataUris(html)
    expect(decoded).toContain('<svg')
    expect(decoded).toContain('viewBox="0 0 100 100"')
    // Bird colours are the same as in the native pin.
    expect(decoded).toContain('#f5842c')
  })

  it('keeps the place marker to two light DOM nodes', () => {
    const html = buildPlaceMarkerIconHtml()

    expect(countElements(html)).toBeLessThanOrEqual(2)
    expect(html).not.toContain('will-change')
    expect(html).not.toContain('translateZ')
    expect(html).not.toContain('animation')
    expect(maxShadowBlur(html)).toBeLessThanOrEqual(8)
  })

  // Ready for the native WebView template too (#843 rules): vector only, no
  // single quotes, nothing that breaks out of an unquoted CSS url().
  it('is WebView-safe: vector data URI only, no quotes inside url()', () => {
    const html = buildPlaceMarkerIconHtml()

    expect(html).not.toContain("'")
    expect(html).not.toMatch(/data:image\/(?!svg\+xml)/)
    expect(html).not.toContain(';base64')
    expect(html).not.toContain('<img')
    for (const [, uri] of html.matchAll(/url\(([^)]*)\)/g)) {
      expect(uri).not.toMatch(/[\s"'()<>]/)
    }
    expect(() => JSON.parse(JSON.stringify(html))).not.toThrow()
  })
})
