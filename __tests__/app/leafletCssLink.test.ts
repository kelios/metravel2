import * as fs from 'fs'
import * as path from 'path'

describe('app/+html Leaflet CSS', () => {
  it('does not include Leaflet CSS as a global stylesheet (only route-conditional preload allowed)', () => {
    // Read the file as plain text to avoid Babel parse errors with String.raw templates
    const htmlSource = fs.readFileSync(
      path.resolve(__dirname, '../../app/+html.tsx'),
      'utf-8',
    )
    // Leaflet CSS URL may appear in a conditional preload script (e.g. for /map route).
    // It must NOT appear as a static <link rel="stylesheet"> that would load on every page.
    const globalLinkPattern = /<link[^>]*rel=["']stylesheet["'][^>]*leaflet/i
    expect(htmlSource).not.toMatch(globalLinkPattern)
  })
})
