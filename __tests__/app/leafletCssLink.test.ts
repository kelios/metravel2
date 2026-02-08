import * as fs from 'fs'
import * as path from 'path'

const LEAFLET_CSS_HREF = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'

describe('app/+html Leaflet CSS', () => {
  it('does not include Leaflet CSS globally (loaded lazily when map is used)', () => {
    // Read the file as plain text to avoid Babel parse errors with String.raw templates
    const htmlSource = fs.readFileSync(
      path.resolve(__dirname, '../../app/+html.tsx'),
      'utf-8',
    )
    expect(htmlSource).not.toContain(LEAFLET_CSS_HREF)
  })
})
