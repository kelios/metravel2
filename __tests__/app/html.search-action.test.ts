import fs from 'fs'
import path from 'path'

describe('+html WebSite SearchAction', () => {
  it('uses the canonical search parameter', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'app/+html.tsx'), 'utf8')

    expect(source).toContain(
      "urlTemplate: 'https://metravel.by/search?search={search_term_string}'",
    )
    expect(source).not.toContain(
      "urlTemplate: 'https://metravel.by/search?q={search_term_string}'",
    )
  })
})
