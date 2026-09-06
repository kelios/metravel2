import fs from 'node:fs'
import path from 'node:path'

const WORST_SLEEP_SPECS = [
  'slider-comprehensive.spec.ts',
  'travel-wizard.spec.ts',
  'slider-swipe.spec.ts',
] as const

describe('e2e waitForTimeout guard', () => {
  it('keeps the three worst sleep specs free of hard waits', () => {
    const hits = WORST_SLEEP_SPECS.flatMap((file) => {
      const source = fs.readFileSync(path.resolve(__dirname, '../../e2e', file), 'utf8')
      return source.includes('waitForTimeout') ? [file] : []
    })
    expect(hits).toEqual([])
  })
})
