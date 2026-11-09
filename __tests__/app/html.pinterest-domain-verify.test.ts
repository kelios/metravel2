import fs from 'fs'
import path from 'path'

// #3222: Pinterest verifies metravel.by by reading this tag from the served <head>.
// Removing or duplicating it silently drops the claim for pinterest.com/metravelby.
describe('+html Pinterest domain claim', () => {
  it('declares the p:domain_verify meta tag exactly once', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'app/+html.tsx'), 'utf8')

    const tags = source.match(/<meta name="p:domain_verify" content="[^"]*" \/>/g) ?? []

    expect(tags).toEqual([
      '<meta name="p:domain_verify" content="1b52e6d9250214d8ee579dd7d89e9d99" />',
    ])
  })
})
