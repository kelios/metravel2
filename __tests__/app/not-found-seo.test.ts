import fs from 'fs'
import path from 'path'

describe('not-found SEO guard', () => {
  it('marks the catch-all missing route as noindex and canonicalizes it away from the missing URL', () => {
    const filePath = path.resolve(process.cwd(), 'app/[...missing].tsx')
    const source = fs.readFileSync(filePath, 'utf8')

    expect(source).toContain('headKey="not-found"')
    expect(source).toContain('robots="noindex, nofollow"')
    expect(source).toContain("canonical={buildCanonicalUrl('/')}")
  })
})
