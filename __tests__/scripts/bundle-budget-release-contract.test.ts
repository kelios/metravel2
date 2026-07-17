const fs = require('fs')
const path = require('path')
const { ensure } = require('./policy-test-utils')
const { makeTempDir, runNodeCli } = require('./cli-test-utils')

const ROOT = path.resolve(process.cwd())
const packageJsonPath = path.join(ROOT, 'package.json')
const budgetPath = path.join(ROOT, 'config', 'bundle-budget.json')
const guardScriptPath = path.join(ROOT, 'scripts', 'guard-bundle-budget.js')

describe('bundle budget release contract', () => {
  it('keeps release:check wired fail-closed after the production web build', () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const releaseCheck = packageJson?.scripts?.['release:check']

    ensure(typeof releaseCheck === 'string' && releaseCheck.length > 0, 'Missing scripts.release:check.')

    const buildIndex = releaseCheck.indexOf('build:web:prod')
    const eagerGuardIndex = releaseCheck.indexOf('guard:eager-web:fail')
    const budgetGuardIndex = releaseCheck.indexOf('guard:bundle-budget:fail')

    ensure(buildIndex >= 0, 'scripts.release:check must run build:web:prod.')
    ensure(eagerGuardIndex >= 0, 'scripts.release:check must run guard:eager-web:fail.')
    ensure(budgetGuardIndex >= 0, 'scripts.release:check must run guard:bundle-budget:fail.')
    ensure(
      buildIndex < eagerGuardIndex && eagerGuardIndex < budgetGuardIndex,
      'scripts.release:check must run eager and bundle budget guards after build:web:prod.',
    )
  })

  it('keeps the committed bundle budget spare at or below five percent', () => {
    const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'))

    ensure(
      Number(budget.tolerancePct) <= 5,
      'config/bundle-budget.json tolerancePct must stay at or below 5%.',
    )
    ensure(
      budget?.chunks?.__common?.maxRawKB > 0 && budget?.chunks?.__common?.maxGzipKB > 0,
      'config/bundle-budget.json must keep an explicit __common budget.',
    )
  })

  it('fails in --fail mode when __common exceeds the configured budget', () => {
    const tmpDir = makeTempDir('metravel-bundle-budget-')
    try {
      const jsDir = path.join(tmpDir, 'js')
      const testBudgetPath = path.join(tmpDir, 'budget.json')
      fs.mkdirSync(jsDir, { recursive: true })
      fs.writeFileSync(path.join(jsDir, '__common-abcdef.js'), `const payload = "${'x'.repeat(4096)}";\n`)
      fs.writeFileSync(
        testBudgetPath,
        JSON.stringify({
          tolerancePct: 0,
          chunks: {
            __common: {
              maxRawKB: 0.1,
              maxGzipKB: 0.1,
            },
          },
        }),
      )

      const result = runNodeCli([guardScriptPath, '--fail', '--json'], {
        BUNDLE_BUDGET_JS_DIR: jsDir,
        BUNDLE_BUDGET_CONFIG: testBudgetPath,
      })

      expect(result.status).toBe(1)
      expect(result.stderr).toBe('')
      const parsed = JSON.parse(result.stdout)
      const breaches = Array.isArray(parsed.breaches) ? parsed.breaches : []
      expect(breaches.some((breach: { label?: string }) => breach.label === '__common (raw)')).toBe(true)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('budgets deferred locale chunks separately from the release total', () => {
    const tmpDir = makeTempDir('metravel-bundle-budget-deferred-')
    try {
      const jsDir = path.join(tmpDir, 'js')
      const testBudgetPath = path.join(tmpDir, 'budget.json')
      fs.mkdirSync(jsDir, { recursive: true })
      fs.writeFileSync(path.join(jsDir, '__common-abcdef.js'), 'const boot = true;\n')
      fs.writeFileSync(path.join(jsDir, 'locale-be-abcdef.js'), `const locale = "${'x'.repeat(4096)}";\n`)
      fs.writeFileSync(
        testBudgetPath,
        JSON.stringify({
          tolerancePct: 0,
          deferredChunks: ['locale-be'],
          total: { maxRawKB: 0.1, maxGzipKB: 0.1 },
          chunks: {
            'locale-be': { maxRawKB: 5, maxGzipKB: 1 },
          },
        }),
      )

      const result = runNodeCli([guardScriptPath, '--fail', '--json'], {
        BUNDLE_BUDGET_JS_DIR: jsDir,
        BUNDLE_BUDGET_CONFIG: testBudgetPath,
      })

      expect(result.status).toBe(0)
      const parsed = JSON.parse(result.stdout)
      expect(parsed.breaches).toEqual([])
      expect(parsed.totalRawKB).toBeLessThan(parsed.allRawKB)
      expect(parsed.deferredRawKB).toBeGreaterThanOrEqual(4)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
