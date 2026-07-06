const fs = require('fs')
const path = require('path')
const { ensure } = require('./policy-test-utils')
const { runNodeCli } = require('./cli-test-utils')

const ROOT = path.resolve(process.cwd())
const packageJsonPath = path.join(ROOT, 'package.json')
const guardScriptPath = path.join(ROOT, 'scripts', 'guard-lighthouse-mobile-budget.js')
const budgetPath = path.join(ROOT, 'config', 'lighthouse-budget-mobile.json')
const badFixture = path.join(ROOT, '__tests__', 'fixtures', 'lighthouse', 'sorapis-bad.mobile.json')
const goodFixture = path.join(ROOT, '__tests__', 'fixtures', 'lighthouse', 'sorapis-good.mobile.json')

describe('lighthouse mobile budget guard (#816)', () => {
  it('ships the guard script, budget config, and fixtures', () => {
    ensure(fs.existsSync(guardScriptPath), 'Missing scripts/guard-lighthouse-mobile-budget.js.')
    ensure(fs.existsSync(budgetPath), 'Missing config/lighthouse-budget-mobile.json.')
    ensure(fs.existsSync(badFixture) && fs.existsSync(goodFixture), 'Missing Lighthouse fixtures.')

    const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8')).budget || {}
    ensure(budget.minPerformanceScore > 0, 'budget must set minPerformanceScore.')
    ensure(budget.maxLcpMs > 0 && budget.maxClsValue > 0, 'budget must set maxLcpMs and maxClsValue.')
  })

  it('exposes npm wiring for the guard', () => {
    const scripts = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).scripts || {}
    ensure(typeof scripts['guard:lighthouse:mobile'] === 'string', 'Missing guard:lighthouse:mobile script.')
    ensure(typeof scripts['guard:lighthouse:mobile:fail'] === 'string', 'Missing guard:lighthouse:mobile:fail script.')
  })

  it('fails (exit 1) on the bad Sorapis baseline and reports the breaching metrics', () => {
    const result = runNodeCli([guardScriptPath, '--report', badFixture, '--fail', '--json'])

    expect(result.status).toBe(1)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.pass).toBe(false)
    const labels = (parsed.breaches || []).map((b: { label?: string }) => b.label)
    expect(labels).toEqual(expect.arrayContaining(['performance score', 'LCP (ms)', 'CLS']))
  })

  it('passes (exit 0) on a good baseline within budget', () => {
    const result = runNodeCli([guardScriptPath, '--report', goodFixture, '--fail', '--json'])

    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.pass).toBe(true)
    expect(parsed.breaches).toEqual([])
  })

  it('reports (exit 0) without --fail even on a breaching report', () => {
    const result = runNodeCli([guardScriptPath, '--report', badFixture, '--json'])
    expect(result.status).toBe(0)
    const parsed = JSON.parse(result.stdout)
    expect(parsed.pass).toBe(false)
  })
})
