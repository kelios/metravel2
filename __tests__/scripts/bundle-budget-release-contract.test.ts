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
    expect(budget?.eager).toMatchObject({
      chunks: ['entry', '__expo-metro-runtime'],
      htmlRoutes: true,
      maxBrotliKB: 800,
      // #1372: потолок на ЧИСЛО eager JS-запросов маршрута. Без пина его легко
      // поднять, чтобы «позеленить» сборку, — а именно это Task Contract
      // задачи и запрещает.
      maxRequests: 59,
      maxRequestsByRoute: {
        'index.html': 36,
        'search.html': 32,
        'map.html': 40,
        'quests.html': 34,
        '(tabs)/travels/[param].html': 59,
      },
      tolerancePct: 0,
    })
    expect(budget?.forbiddenChunks).toEqual(['__common'])
  })

  it('fails closed when a route exceeds its own eager JS request budget', () => {
    const tmpDir = makeTempDir('metravel-bundle-budget-requests-')
    try {
      const jsDir = path.join(tmpDir, 'js')
      const htmlDir = path.join(tmpDir, 'html')
      const testBudgetPath = path.join(tmpDir, 'budget.json')
      fs.mkdirSync(jsDir, { recursive: true })
      fs.mkdirSync(path.join(htmlDir, 'search'), { recursive: true })

      const scriptTags = []
      for (let index = 0; index < 3; index += 1) {
        fs.writeFileSync(path.join(jsDir, `chunk${index}-abcdef.js`), 'globalThis.x = 1;')
        scriptTags.push(`<script src="/_expo/static/js/web/chunk${index}-abcdef.js" defer></script>`)
      }
      // Та же страница под двумя именами: ключ маршрута должен схлопнуться в один.
      fs.writeFileSync(path.join(htmlDir, 'search.html'), `<html><body>${scriptTags.join('')}</body></html>`)
      fs.writeFileSync(
        path.join(htmlDir, 'search', 'index.html'),
        `<html><body>${scriptTags.join('')}</body></html>`,
      )
      fs.writeFileSync(
        testBudgetPath,
        JSON.stringify({
          eager: {
            chunks: [],
            htmlRoutes: true,
            maxRequests: 99,
            maxRequestsByRoute: { 'search.html': 2 },
            tolerancePct: 0,
          },
        }),
      )

      const result = runNodeCli([guardScriptPath, '--fail', '--json'], {
        BUNDLE_BUDGET_JS_DIR: jsDir,
        BUNDLE_BUDGET_HTML_DIR: htmlDir,
        BUNDLE_BUDGET_CONFIG: testBudgetPath,
      })

      expect(result.status).toBe(1)
      const parsed = JSON.parse(result.stdout)
      expect(parsed.eagerRequests).toBe(3)
      expect(parsed.breaches).toContainEqual(
        expect.objectContaining({ label: 'EAGER (requests, search.html)', actual: 3, max: 2 }),
      )
      // Глобальный потолок 99 не тронут — сработал именно помаршрутный.
      expect(parsed.breaches.filter((b: { label: string }) => /EAGER \(requests/.test(b.label))).toHaveLength(1)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails closed when a budgeted route disappears from the build', () => {
    const tmpDir = makeTempDir('metravel-bundle-budget-route-missing-')
    try {
      const jsDir = path.join(tmpDir, 'js')
      const htmlDir = path.join(tmpDir, 'html')
      const testBudgetPath = path.join(tmpDir, 'budget.json')
      fs.mkdirSync(jsDir, { recursive: true })
      fs.mkdirSync(htmlDir, { recursive: true })
      fs.writeFileSync(path.join(jsDir, 'chunk0-abcdef.js'), 'globalThis.x = 1;')
      fs.writeFileSync(
        path.join(htmlDir, 'index.html'),
        '<html><body><script src="/_expo/static/js/web/chunk0-abcdef.js" defer></script></body></html>',
      )
      fs.writeFileSync(
        testBudgetPath,
        JSON.stringify({
          eager: {
            chunks: [],
            htmlRoutes: true,
            maxRequestsByRoute: { 'search.html': 32 },
            tolerancePct: 0,
          },
        }),
      )

      const result = runNodeCli([guardScriptPath, '--fail', '--json'], {
        BUNDLE_BUDGET_JS_DIR: jsDir,
        BUNDLE_BUDGET_HTML_DIR: htmlDir,
        BUNDLE_BUDGET_CONFIG: testBudgetPath,
      })

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout).breaches).toContainEqual({
        label: 'EAGER budgeted route missing from build: search.html',
        missing: true,
      })
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails closed when the configured eager chunks exceed the hard Brotli budget', () => {
    const tmpDir = makeTempDir('metravel-bundle-budget-eager-')
    try {
      const jsDir = path.join(tmpDir, 'js')
      const testBudgetPath = path.join(tmpDir, 'budget.json')
      fs.mkdirSync(jsDir, { recursive: true })
      let state = 0x12345678
      const payload = Buffer.alloc(8192)
      for (let index = 0; index < payload.length; index += 1) {
        state ^= state << 13
        state ^= state >>> 17
        state ^= state << 5
        payload[index] = state & 0xff
      }
      fs.writeFileSync(path.join(jsDir, 'entry-abcdef.js'), payload)
      fs.writeFileSync(path.join(jsDir, '__expo-metro-runtime-abcdef.js'), payload)
      fs.writeFileSync(
        testBudgetPath,
        JSON.stringify({
          tolerancePct: 5,
          eager: {
            chunks: ['entry', '__expo-metro-runtime'],
            maxBrotliKB: 0.1,
            tolerancePct: 0,
          },
        }),
      )

      const result = runNodeCli([guardScriptPath, '--fail', '--json'], {
        BUNDLE_BUDGET_JS_DIR: jsDir,
        BUNDLE_BUDGET_CONFIG: testBudgetPath,
      })

      expect(result.status).toBe(1)
      const parsed = JSON.parse(result.stdout)
      expect(parsed.eagerChunks).toEqual(['entry', '__expo-metro-runtime'])
      expect(parsed.breaches).toContainEqual(
        expect.objectContaining({ label: 'EAGER (brotli)', maxKB: 0.1 }),
      )
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails closed when a configured eager chunk is missing', () => {
    const tmpDir = makeTempDir('metravel-bundle-budget-eager-missing-')
    try {
      const jsDir = path.join(tmpDir, 'js')
      const testBudgetPath = path.join(tmpDir, 'budget.json')
      fs.mkdirSync(jsDir, { recursive: true })
      fs.writeFileSync(path.join(jsDir, 'entry-abcdef.js'), 'globalThis.__entry = true;')
      fs.writeFileSync(
        testBudgetPath,
        JSON.stringify({
          eager: {
            chunks: ['entry', '__expo-metro-runtime'],
            maxBrotliKB: 800,
            tolerancePct: 0,
          },
        }),
      )

      const result = runNodeCli([guardScriptPath, '--fail', '--json'], {
        BUNDLE_BUDGET_JS_DIR: jsDir,
        BUNDLE_BUDGET_CONFIG: testBudgetPath,
      })

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout).breaches).toContainEqual({
        label: 'EAGER chunk missing: __expo-metro-runtime',
        missing: true,
      })
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('measures the complete script set of the worst generated HTML route', () => {
    const tmpDir = makeTempDir('metravel-bundle-budget-html-eager-')
    try {
      const jsDir = path.join(tmpDir, 'js')
      const htmlDir = path.join(tmpDir, 'html')
      const testBudgetPath = path.join(tmpDir, 'budget.json')
      fs.mkdirSync(jsDir, { recursive: true })
      fs.mkdirSync(htmlDir, { recursive: true })
      fs.writeFileSync(path.join(jsDir, 'entry-abcdef.js'), 'globalThis.__entry = true;')
      fs.writeFileSync(path.join(jsDir, '__expo-metro-runtime-abcdef.js'), 'globalThis.__runtime = true;')
      fs.writeFileSync(path.join(jsDir, '__shared-0-abcdef.js'), `const payload = "${'x'.repeat(4096)}";`)
      fs.writeFileSync(
        path.join(htmlDir, 'index.html'),
        '<script src="/_expo/static/js/web/entry-abcdef.js"></script>',
      )
      fs.writeFileSync(
        path.join(htmlDir, 'search.html'),
        '<script src="/_expo/static/js/web/entry-abcdef.js"></script>' +
          '<script src="/_expo/static/js/web/__shared-0-abcdef.js"></script>',
      )
      fs.writeFileSync(
        testBudgetPath,
        JSON.stringify({
          eager: {
            chunks: ['entry', '__expo-metro-runtime'],
            htmlRoutes: true,
            maxRawKB: 1,
            maxBrotliKB: 800,
            tolerancePct: 0,
          },
        }),
      )

      const result = runNodeCli([guardScriptPath, '--fail', '--json'], {
        BUNDLE_BUDGET_JS_DIR: jsDir,
        BUNDLE_BUDGET_HTML_DIR: htmlDir,
        BUNDLE_BUDGET_CONFIG: testBudgetPath,
      })

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        eagerPage: 'search.html',
        breaches: expect.arrayContaining([expect.objectContaining({ label: 'EAGER (raw)' })]),
      })
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails closed when a non-worst HTML route references a missing asset', () => {
    const tmpDir = makeTempDir('metravel-bundle-budget-html-missing-')
    try {
      const jsDir = path.join(tmpDir, 'js')
      const htmlDir = path.join(tmpDir, 'html')
      const testBudgetPath = path.join(tmpDir, 'budget.json')
      fs.mkdirSync(jsDir, { recursive: true })
      fs.mkdirSync(htmlDir, { recursive: true })
      fs.writeFileSync(path.join(jsDir, 'entry-abcdef.js'), `const payload = "${'x'.repeat(4096)}";`)
      fs.writeFileSync(
        path.join(htmlDir, 'index.html'),
        '<script src="/_expo/static/js/web/entry-abcdef.js"></script>',
      )
      fs.writeFileSync(
        path.join(htmlDir, 'search.html'),
        '<script src="/_expo/static/js/web/missing-abcdef.js"></script>',
      )
      fs.writeFileSync(
        testBudgetPath,
        JSON.stringify({
          eager: {
            chunks: ['entry'],
            htmlRoutes: true,
            maxBrotliKB: 800,
            tolerancePct: 0,
          },
        }),
      )

      const result = runNodeCli([guardScriptPath, '--fail', '--json'], {
        BUNDLE_BUDGET_JS_DIR: jsDir,
        BUNDLE_BUDGET_HTML_DIR: htmlDir,
        BUNDLE_BUDGET_CONFIG: testBudgetPath,
      })

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout).breaches).toContainEqual({
        label: 'EAGER HTML asset missing: missing-abcdef.js (search.html)',
        missing: true,
      })
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('fails closed when the removed global __common chunk reappears', () => {
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
          forbiddenChunks: ['__common'],
        }),
      )

      const result = runNodeCli([guardScriptPath, '--fail', '--json'], {
        BUNDLE_BUDGET_JS_DIR: jsDir,
        BUNDLE_BUDGET_CONFIG: testBudgetPath,
      })

      expect(result.status).toBe(1)
      expect(result.stderr).toBe('')
      const parsed = JSON.parse(result.stdout)
      expect(parsed.forbiddenChunks).toEqual(['__common'])
      expect(parsed.breaches).toContainEqual({
        label: 'Forbidden chunk present: __common',
        forbidden: true,
      })
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
