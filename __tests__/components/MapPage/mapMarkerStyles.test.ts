import { DESIGN_TOKENS } from '@/constants/designSystem'
import {
  buildBirdMarkerHtml,
  buildClusterIconHtml,
} from '@/components/MapPage/Map/mapMarkerStyles'

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
    expect(html).toContain('metravelClusterPulse')
    expect(html).toContain('letter-spacing: 0;')
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
