import { DESIGN_TOKENS } from '@/constants/designSystem'
import { buildClusterIconHtml } from '@/components/MapPage/Map/mapMarkerStyles'

describe('buildClusterIconHtml', () => {
  it('uses the primary-on-dark text token by default for cluster labels', () => {
    const { html, label } = buildClusterIconHtml({ count: 13 })

    expect(label).toBe('13')
    expect(html).toContain(`color: ${String(DESIGN_TOKENS.colors.textOnPrimary)};`)
    expect(html).not.toContain(`color: ${String(DESIGN_TOKENS.colors.primaryDark)};`)
  })
})
