import fs from 'fs'
import path from 'path'

describe('Lighthouse performance report', () => {
  it('meets green performance threshold', () => {
    const reportPath = path.resolve(process.cwd(), 'lighthouse-report.json')
    expect(fs.existsSync(reportPath)).toBe(true)

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
    const score = report?.categories?.performance?.score
    expect(typeof score).toBe('number')
    expect(score).toBeGreaterThanOrEqual(0.9)
  })
})
