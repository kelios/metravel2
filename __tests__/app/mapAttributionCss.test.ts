import fs from 'fs'
import path from 'path'

describe('mobile map provider attribution CSS', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'app/global.css'), 'utf8')

  it('pins provider text and logo to the map bottom, above any floating bottom bar', () => {
    expect(css).toContain('body:has([data-testid="map-screen-root"]) .leaflet-bottom')
    // Экран карты заканчивается НАД доком, поэтому его высота вычитается из
    // резерва плавающей плашки (--mt-consent-h меряется от низа вьюпорта) —
    // иначе подпись поднималась бы на высоту дока дважды. Та же формула у
    // «Искать в этой области» (MapMobileLayout.styles.ts).
    expect(css).toContain(
      'bottom: calc(max(0px, var(--mt-consent-h, 0px) - 56px) + 8px);',
    )
    expect(css).toContain('white-space: normal;')
    expect(css).toContain('overflow: visible;')
  })
})
