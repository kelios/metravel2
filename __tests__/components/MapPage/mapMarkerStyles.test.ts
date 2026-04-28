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
    expect(html).toContain('/assets/icons/logo_yellow_60x60.png')
    expect(html).toContain('object-fit: contain;')
  })
})
