import fs from 'fs'
import path from 'path'

describe('mobile map provider attribution CSS', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'app/global.css'), 'utf8')

  it('pins provider text and logo to the map bottom, above any floating bottom bar', () => {
    expect(css).toContain('body:has([data-testid="map-screen-root"]) .leaflet-bottom')
    // Экран карты заканчивается НАД доком, поэтому его высота вычитается из
    // резерва плавающей плашки (--mt-consent-h меряется от низа вьюпорта) —
    // иначе подпись поднималась бы на высоту дока дважды. Слой приглашений
    // использует тот же отступ для резерва «Искать в этой области».
    expect(css).toContain(
      '--mt-map-leaflet-corner-bottom: calc(max(0px, var(--mt-consent-h, 0px) - 56px) + 8px);',
    )
    expect(css).toContain('bottom: var(--mt-map-leaflet-corner-bottom);')
    expect(css).toContain('white-space: normal;')
    expect(css).toContain('overflow: visible;')
  })

  it('shares the desktop consent lift between Leaflet and the campaign corner reserve', () => {
    expect(css).toContain([
      `body[data-consent-banner-open='true']:has([data-testid="map-screen-root"]) {`,
      '    --mt-map-leaflet-corner-bottom: var(--mt-consent-h, 0px);',
    ].join('\n'))
  })
})
