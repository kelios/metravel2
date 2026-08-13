import fs from 'fs'
import path from 'path'

describe('mobile map provider attribution CSS', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'app/global.css'), 'utf8')

  it('keeps provider text and logo visible above the mobile dock and consent banner', () => {
    expect(css).toContain('body:has([data-testid="map-screen-root"]) .leaflet-bottom')
    expect(css).toContain(
      'bottom: calc(max(var(--mt-dock-h, 0px), var(--mt-consent-h, 0px)) + 8px);',
    )
    expect(css).toContain('white-space: normal;')
    expect(css).toContain('overflow: visible;')
  })
})
