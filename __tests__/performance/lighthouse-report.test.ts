import fs from 'fs'
import path from 'path'

describe('Lighthouse performance report', () => {
  const reportPath = path.resolve(process.cwd(), 'lighthouse-report.json')
  const hasReport = fs.existsSync(reportPath)

  ;(hasReport ? it : it.skip)('meets green performance threshold', () => {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
    const score = report?.categories?.performance?.score
    expect(typeof score).toBe('number')
    expect(score).toBeGreaterThanOrEqual(0.9)
  })
})
