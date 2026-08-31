const fs = require('fs')
const path = require('path')
const { ensure } = require('./policy-test-utils')
const { makeTempDir, runNodeCli } = require('./cli-test-utils')

const ROOT = path.resolve(process.cwd())
const packageJsonPath = path.join(ROOT, 'package.json')
const budgetPath = path.join(ROOT, 'config', 'bundle-budget.json')
const guardScriptPath = path.join(ROOT, 'scripts', 'guard-bundle-budget.js')
const contractTestPath = path.join(ROOT, '__tests__', 'scripts', 'bundle-budget-release-contract.test.ts')

type JsonRecord = Record<string, unknown>
type EagerRequestBudget = {
  maxRequests: number
  maxRequestsByRoute: Record<string, number>
}

const MAX_BUDGET_TOLERANCE_PCT = 5
const MAX_EAGER_BROTLI_KB = 800
const MAX_GLOBAL_REQUEST_SPARE_PCT = 5
const EAGER_REQUEST_PIN_START = '// bundle-budget-sync:eager-requests:start'
const EAGER_REQUEST_PIN_END = '// bundle-budget-sync:eager-requests:end'

// bundle-budget-sync:eager-requests:start
// {
//   "maxRequests": 27,
//   "maxRequestsByRoute": {
//     "index.html": 16,
//     "search.html": 11,
//     "map.html": 23,
//     "quests.html": 15,
//     "(tabs)/travels/[param].html": 23,
//     "(tabs)/profile.html": 27,
//     "(tabs)/trips/plan/[id].html": 26
//   }
// }
// bundle-budget-sync:eager-requests:end

const requireRecord = (value: unknown, label: string): JsonRecord => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as JsonRecord
}

const requireStringArray = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new Error(`${label} must be an array of non-empty strings.`)
  }
  if (new Set(value).size !== value.length) {
    throw new Error(`${label} must not contain duplicates.`)
  }
  return value
}

const requireBudgetNumber = (
  value: unknown,
  label: string,
  { integer = false, allowZero = false }: { integer?: boolean; allowZero?: boolean } = {},
): number => {
  const minimumOk = allowZero ? Number(value) >= 0 : Number(value) > 0
  if (typeof value !== 'number' || !Number.isFinite(value) || !minimumOk || (integer && !Number.isInteger(value))) {
    throw new Error(`${label} must be a finite ${integer ? 'integer ' : ''}${allowZero ? 'at least zero' : 'above zero'}.`)
  }
  return value
}

const readEagerRequestPin = (sourcePath: string): unknown => {
  const lines = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/)
  const startIndexes = lines.flatMap((line, index) => (line === EAGER_REQUEST_PIN_START ? [index] : []))
  const endIndexes = lines.flatMap((line, index) => (line === EAGER_REQUEST_PIN_END ? [index] : []))
  if (startIndexes.length !== 1 || endIndexes.length !== 1 || endIndexes[0] <= startIndexes[0] + 1) {
    throw new Error('bundle budget eager request pin markers must form exactly one non-empty ordered block.')
  }

  const payload = lines
    .slice(startIndexes[0] + 1, endIndexes[0])
    .map((line) => {
      if (!line.startsWith('// ')) {
        throw new Error('bundle budget eager request pin payload must contain JSON comment lines.')
      }
      return line.slice(3)
    })
    .join('\n')
  try {
    return JSON.parse(payload)
  } catch {
    throw new Error('bundle budget eager request pin payload must be valid JSON.')
  }
}

const validateEagerRequestBudget = (value: unknown, label: string): EagerRequestBudget => {
  const requestBudget = requireRecord(value, label)
  const maxRequests = requireBudgetNumber(requestBudget.maxRequests, `${label}.maxRequests`, {
    integer: true,
  })
  const routeBudgets = requireRecord(requestBudget.maxRequestsByRoute, `${label}.maxRequestsByRoute`)
  const routeEntries = Object.entries(routeBudgets)
  if (routeEntries.length === 0) {
    throw new Error(`${label}.maxRequestsByRoute must not be empty.`)
  }

  const maxRequestsByRoute = Object.fromEntries(
    routeEntries.map(([route, limit]) => {
      if (
        !route.endsWith('.html') ||
        route.startsWith('/') ||
        route.includes('\\') ||
        route.split('/').includes('..')
      ) {
        throw new Error(`${label} route must be a normalized relative .html path: ${route}.`)
      }
      const numericLimit = requireBudgetNumber(limit, `${label}.maxRequestsByRoute.${route}`, {
        integer: true,
      })
      if (numericLimit > maxRequests) {
        throw new Error(`${label} route ${route} must not exceed maxRequests.`)
      }
      return [route, numericLimit]
    }),
  )

  const highestRouteLimit = Math.max(...Object.values(maxRequestsByRoute))
  const fallbackSparePct = ((maxRequests - highestRouteLimit) / highestRouteLimit) * 100
  if (fallbackSparePct > MAX_GLOBAL_REQUEST_SPARE_PCT) {
    throw new Error(`${label}.maxRequests fallback spare must stay at or below 5%.`)
  }

  return { maxRequests, maxRequestsByRoute }
}

const normalizedRequestBudget = (budget: EagerRequestBudget) => ({
  maxRequests: budget.maxRequests,
  maxRequestsByRoute: Object.fromEntries(Object.entries(budget.maxRequestsByRoute).sort(([a], [b]) => a.localeCompare(b))),
})

const validateCommittedBudget = (configPath: string, pinSourcePath = contractTestPath): JsonRecord => {
  const budget = requireRecord(JSON.parse(fs.readFileSync(configPath, 'utf8')), 'bundle budget')
  const tolerancePct = requireBudgetNumber(
    budget.tolerancePct,
    'bundle budget.tolerancePct',
    { allowZero: true },
  )
  if (tolerancePct > MAX_BUDGET_TOLERANCE_PCT) {
    throw new Error(`bundle budget.tolerancePct must stay at or below ${MAX_BUDGET_TOLERANCE_PCT}%.`)
  }

  const forbiddenChunks = requireStringArray(budget.forbiddenChunks, 'bundle budget.forbiddenChunks')
  if (forbiddenChunks.length !== 1 || forbiddenChunks[0] !== '__common') {
    throw new Error('bundle budget.forbiddenChunks must keep __common as its only forbidden chunk.')
  }

  const eager = requireRecord(budget.eager, 'bundle budget.eager')
  const eagerChunks = requireStringArray(eager.chunks, 'bundle budget.eager.chunks')
  if (eagerChunks.length !== 2 || eagerChunks[0] !== 'entry' || eagerChunks[1] !== '__expo-metro-runtime') {
    throw new Error('bundle budget.eager.chunks must keep entry and __expo-metro-runtime.')
  }
  if (eager.htmlRoutes !== true) {
    throw new Error('bundle budget.eager.htmlRoutes must stay enabled.')
  }

  const eagerBrotliKB = requireBudgetNumber(eager.maxBrotliKB, 'bundle budget.eager.maxBrotliKB')
  if (eagerBrotliKB > MAX_EAGER_BROTLI_KB) {
    throw new Error(`bundle budget.eager.maxBrotliKB must stay at or below ${MAX_EAGER_BROTLI_KB} KiB.`)
  }
  const eagerTolerancePct = requireBudgetNumber(
    eager.tolerancePct,
    'bundle budget.eager.tolerancePct',
    { allowZero: true },
  )
  if (eagerTolerancePct !== 0) {
    throw new Error('bundle budget.eager.tolerancePct must stay at zero.')
  }

  const configuredRequests = validateEagerRequestBudget(eager, 'bundle budget.eager')
  const committedRequests = validateEagerRequestBudget(
    readEagerRequestPin(pinSourcePath),
    'committed eager request pin',
  )
  if (
    JSON.stringify(normalizedRequestBudget(configuredRequests)) !==
    JSON.stringify(normalizedRequestBudget(committedRequests))
  ) {
    throw new Error('bundle budget eager request limits must match the committed test pin exactly.')
  }

  return budget
}

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
    const budget = validateCommittedBudget(budgetPath)
    const tmpDir = makeTempDir('metravel-bundle-budget-contract-')
    try {
      const jsDir = path.join(tmpDir, 'js')
      const mutatedBudgetPath = path.join(tmpDir, 'bundle-budget.json')
      const updatedContractPath = path.join(tmpDir, 'bundle-budget-release-contract.test.ts')
      const mutatedBudget = JSON.parse(JSON.stringify(budget)) as JsonRecord
      const mutatedEager = requireRecord(mutatedBudget.eager, 'mutated bundle budget.eager')
      const mutatedRouteBudgets = requireRecord(
        mutatedEager.maxRequestsByRoute,
        'mutated bundle budget.eager.maxRequestsByRoute',
      )

      // Acceptance regression: общий 27 и остальные relations остаются валидны,
      // но одиночное ослабление search 11 → 27 обязано разойтись с точным pin.
      mutatedRouteBudgets['search.html'] = 27
      fs.mkdirSync(jsDir, { recursive: true })
      fs.writeFileSync(path.join(jsDir, 'entry-abcdef.js'), 'x'.repeat(4096))
      fs.writeFileSync(
        mutatedBudgetPath,
        JSON.stringify(mutatedBudget, null, 2).replace(/\n/g, '\r\n') + '\r\n',
      )
      fs.writeFileSync(
        updatedContractPath,
        fs.readFileSync(contractTestPath, 'utf8').replace(/\r?\n/g, '\r\n'),
      )
      if (process.platform !== 'win32') {
        fs.chmodSync(mutatedBudgetPath, 0o640)
        fs.chmodSync(updatedContractPath, 0o600)
      }

      expect(() => validateCommittedBudget(mutatedBudgetPath)).toThrow(
        'bundle budget eager request limits must match the committed test pin exactly.',
      )

      const updateResult = runNodeCli([guardScriptPath, '--update'], {
        BUNDLE_BUDGET_JS_DIR: jsDir,
        BUNDLE_BUDGET_CONFIG: mutatedBudgetPath,
        BUNDLE_BUDGET_CONTRACT_TEST: updatedContractPath,
      })
      expect(updateResult).toMatchObject({ status: 0, stderr: '' })

      const updatedBudget = requireRecord(
        JSON.parse(fs.readFileSync(mutatedBudgetPath, 'utf8')),
        'updated bundle budget',
      )
      const updatedEager = validateEagerRequestBudget(updatedBudget.eager, 'updated bundle budget.eager')
      const updatedPin = validateEagerRequestBudget(
        readEagerRequestPin(updatedContractPath),
        'updated eager request pin',
      )
      expect(normalizedRequestBudget(updatedPin)).toEqual(normalizedRequestBudget(updatedEager))
      expect(updatedPin.maxRequestsByRoute['search.html']).toBe(27)
      expect(requireRecord(updatedBudget.total, 'updated bundle budget.total').maxRawKB).toBe(4)
      expect(() => validateCommittedBudget(mutatedBudgetPath, updatedContractPath)).not.toThrow()

      const synchronizedConfig = fs.readFileSync(mutatedBudgetPath, 'utf8')
      const synchronizedContract = fs.readFileSync(updatedContractPath, 'utf8')
      expect(synchronizedConfig.replace(/\r\n/g, '')).not.toContain('\n')
      expect(synchronizedContract.replace(/\r\n/g, '')).not.toContain('\n')
      if (process.platform !== 'win32') {
        expect(fs.statSync(mutatedBudgetPath).mode & 0o777).toBe(0o640)
        expect(fs.statSync(updatedContractPath).mode & 0o777).toBe(0o600)
      }

      const overSpareBudget = JSON.parse(synchronizedConfig)
      const highestRouteLimit = Math.max(
        ...Object.values(overSpareBudget.eager.maxRequestsByRoute).map(Number),
      )
      overSpareBudget.eager.maxRequests = Math.floor(highestRouteLimit * 1.05) + 1
      const overSpareConfig = JSON.stringify(overSpareBudget, null, 2).replace(/\n/g, '\r\n') + '\r\n'
      fs.writeFileSync(mutatedBudgetPath, overSpareConfig)
      const rejectedOverSpareUpdate = runNodeCli([guardScriptPath, '--update'], {
        BUNDLE_BUDGET_JS_DIR: jsDir,
        BUNDLE_BUDGET_CONFIG: mutatedBudgetPath,
        BUNDLE_BUDGET_CONTRACT_TEST: updatedContractPath,
      })
      expect(rejectedOverSpareUpdate.status).toBe(1)
      expect(rejectedOverSpareUpdate.stderr).toContain('fallback spare must stay at or below 5%')
      expect(fs.readFileSync(mutatedBudgetPath, 'utf8')).toBe(overSpareConfig)
      expect(fs.readFileSync(updatedContractPath, 'utf8')).toBe(synchronizedContract)
      fs.writeFileSync(mutatedBudgetPath, synchronizedConfig)

      const renameFailureHook = path.join(tmpDir, 'fail-third-rename.cjs')
      fs.writeFileSync(
        renameFailureHook,
        [
          "const fs = require('fs')",
          'const originalRenameSync = fs.renameSync',
          'let renameCount = 0',
          'fs.renameSync = (...args) => {',
          '  renameCount += 1',
          "  if (renameCount === 3) throw new Error('injected third rename failure')",
          '  return originalRenameSync(...args)',
          '}',
        ].join('\n'),
      )
      const rejectedPartialUpdate = runNodeCli([guardScriptPath, '--update'], {
        BUNDLE_BUDGET_JS_DIR: jsDir,
        BUNDLE_BUDGET_CONFIG: mutatedBudgetPath,
        BUNDLE_BUDGET_CONTRACT_TEST: updatedContractPath,
        NODE_OPTIONS: `--require=${renameFailureHook}`,
      })
      expect(rejectedPartialUpdate.status).toBe(1)
      expect(rejectedPartialUpdate.stderr).toContain('injected third rename failure')
      expect(fs.readFileSync(mutatedBudgetPath, 'utf8')).toBe(synchronizedConfig)
      expect(fs.readFileSync(updatedContractPath, 'utf8')).toBe(synchronizedContract)
      expect(fs.readdirSync(tmpDir).some((name) => /\.(?:tmp|backup)$/.test(name))).toBe(false)

      const contractLineEnding = synchronizedContract.includes('\r\n') ? '\r\n' : '\n'
      const malformedContracts = [
        synchronizedContract.replace(
          `${EAGER_REQUEST_PIN_START}${contractLineEnding}// {`,
          `// missing eager request start marker${contractLineEnding}// {`,
        ),
        `${synchronizedContract}${synchronizedContract.endsWith(contractLineEnding) ? '' : contractLineEnding}` +
          `${EAGER_REQUEST_PIN_START}${contractLineEnding}`,
        synchronizedContract.replace('//   "maxRequests": 27,', '//   "maxRequests": nope,'),
      ]
      for (const malformedContract of malformedContracts) {
        fs.writeFileSync(updatedContractPath, malformedContract)
        const rejectedUpdate = runNodeCli([guardScriptPath, '--update'], {
          BUNDLE_BUDGET_JS_DIR: jsDir,
          BUNDLE_BUDGET_CONFIG: mutatedBudgetPath,
          BUNDLE_BUDGET_CONTRACT_TEST: updatedContractPath,
        })
        expect(rejectedUpdate.status).toBe(1)
        expect(fs.readFileSync(mutatedBudgetPath, 'utf8')).toBe(synchronizedConfig)
        expect(fs.readFileSync(updatedContractPath, 'utf8')).toBe(malformedContract)
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
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

  // #1393: ни вес, ни число запросов не отвечают на вопрос «ЧТО именно приехало
  // на этот маршрут». Модуль, достижимый из двух и более async-корней, Metro
  // поднимает в shared-чанк без проверки, кому чанк нужен, и оба прежних гейта
  // остаются зелёными. Атрибуция payload'а к маршрутам закрывает этот пробел.
  describe('eager payload route attribution', () => {
    // Хелпер: сборка из одного чанка с маркером и одного без, разложенная по
    // указанным маршрутам.
    const buildFixture = (
      tmpDir: string,
      routesWithPayload: string[],
      routesWithout: string[],
      marker: string,
    ) => {
      const jsDir = path.join(tmpDir, 'js')
      const htmlDir = path.join(tmpDir, 'html')
      fs.mkdirSync(jsDir, { recursive: true })
      fs.mkdirSync(htmlDir, { recursive: true })
      fs.writeFileSync(path.join(jsDir, 'payload-abcdef.js'), `globalThis.d='${marker}';`)
      fs.writeFileSync(path.join(jsDir, 'plain-abcdef.js'), 'globalThis.x = 1;')
      const tag = (name: string) => `<script src="/_expo/static/js/web/${name}-abcdef.js" defer></script>`
      for (const route of routesWithPayload) {
        fs.mkdirSync(path.dirname(path.join(htmlDir, route)), { recursive: true })
        fs.writeFileSync(path.join(htmlDir, route), `<html><body>${tag('plain')}${tag('payload')}</body></html>`)
      }
      for (const route of routesWithout) {
        fs.mkdirSync(path.dirname(path.join(htmlDir, route)), { recursive: true })
        fs.writeFileSync(path.join(htmlDir, route), `<html><body>${tag('plain')}</body></html>`)
      }
      return { jsDir, htmlDir }
    }

    const writeBudget = (tmpDir: string, payloadSpec: Record<string, unknown>) => {
      const testBudgetPath = path.join(tmpDir, 'budget.json')
      fs.writeFileSync(
        testBudgetPath,
        JSON.stringify({
          eager: {
            chunks: [],
            htmlRoutes: true,
            payloadRoutes: { geoCountryOutlines: payloadSpec },
            tolerancePct: 0,
          },
        }),
      )
      return testBudgetPath
    }

    it('pins the committed payload attribution so it cannot be quietly dropped', () => {
      const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf8'))
      const spec = budget?.eager?.payloadRoutes?.geoCountryOutlines

      ensure(!!spec, 'config/bundle-budget.json must keep eager.payloadRoutes.geoCountryOutlines.')
      // Маркер — фрагмент первого кольца контура Грузии. Пин по имени чанка не
      // годится: `__shared-N` перенумеровывается от сборки к сборке.
      expect(spec.marker).toBe('4155,4241,-5,23,-8,10')
      // #1543: таблица контуров ушла из eager HTML полностью. Нулевой пин —
      // самый строгий односторонний ratchet: любое повторное попадание в route падает.
      expect(spec.maxRoutes).toBe(0)
      // Односторонний рэтчет по числу разрешил бы освободить главную и тем же
      // числом нагрузить карту, поэтому отвоёванные маршруты закреплены поимённо.
      expect(spec.mustNotLoad).toEqual(
        expect.arrayContaining([
          'index.html',
          'search.html',
          'map.html',
          'quests.html',
          'profile.html',
          'articles.html',
          'login.html',
          'terms.html',
        ]),
      )
    })

    it('counts only the routes that actually load the payload', () => {
      const tmpDir = makeTempDir('metravel-bundle-budget-payload-count-')
      try {
        const marker = '4155,4241,-5,23,-8,10'
        const { jsDir, htmlDir } = buildFixture(tmpDir, ['quests.html'], ['index.html', 'map.html'], marker)
        const testBudgetPath = writeBudget(tmpDir, { marker, maxRoutes: 1, mustNotLoad: [] })

        const result = runNodeCli([guardScriptPath, '--fail', '--json'], {
          BUNDLE_BUDGET_JS_DIR: jsDir,
          BUNDLE_BUDGET_HTML_DIR: htmlDir,
          BUNDLE_BUDGET_CONFIG: testBudgetPath,
        })

        expect(result.status).toBe(0)
        expect(JSON.parse(result.stdout).eagerPayloadRoutes).toEqual({ geoCountryOutlines: 1 })
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('fails closed when the payload spreads to more routes than pinned', () => {
      const tmpDir = makeTempDir('metravel-bundle-budget-payload-spread-')
      try {
        const marker = '4155,4241,-5,23,-8,10'
        const { jsDir, htmlDir } = buildFixture(tmpDir, ['quests.html', 'index.html'], ['map.html'], marker)
        const testBudgetPath = writeBudget(tmpDir, { marker, maxRoutes: 1, mustNotLoad: [] })

        const result = runNodeCli([guardScriptPath, '--fail', '--json'], {
          BUNDLE_BUDGET_JS_DIR: jsDir,
          BUNDLE_BUDGET_HTML_DIR: htmlDir,
          BUNDLE_BUDGET_CONFIG: testBudgetPath,
        })

        expect(result.status).toBe(1)
        expect(JSON.parse(result.stdout).breaches).toContainEqual(
          expect.objectContaining({
            label: 'EAGER payload routes (geoCountryOutlines)',
            actual: 2,
            max: 1,
          }),
        )
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    // Односторонний рэтчет по количеству разрешает разгрузить главную и тем же
    // числом нагрузить карту. Поимённый список закрывает уже отвоёванное.
    it('fails closed when the payload returns to a route freed earlier', () => {
      const tmpDir = makeTempDir('metravel-bundle-budget-payload-forbidden-')
      try {
        const marker = '4155,4241,-5,23,-8,10'
        const { jsDir, htmlDir } = buildFixture(tmpDir, ['index.html'], ['quests.html'], marker)
        const testBudgetPath = writeBudget(tmpDir, {
          marker,
          maxRoutes: 99,
          mustNotLoad: ['index.html'],
        })

        const result = runNodeCli([guardScriptPath, '--fail', '--json'], {
          BUNDLE_BUDGET_JS_DIR: jsDir,
          BUNDLE_BUDGET_HTML_DIR: htmlDir,
          BUNDLE_BUDGET_CONFIG: testBudgetPath,
        })

        expect(result.status).toBe(1)
        expect(JSON.parse(result.stdout).breaches).toContainEqual({
          label: 'EAGER payload on forbidden route: geoCountryOutlines on index.html',
          forbidden: true,
        })
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    // Пин на переименованную страницу снимался бы молча — тот же класс дыры,
    // что и пропавший маркер.
    it('fails closed when a pinned route disappears from the build', () => {
      const tmpDir = makeTempDir('metravel-bundle-budget-payload-pin-gone-')
      try {
        const marker = '4155,4241,-5,23,-8,10'
        const { jsDir, htmlDir } = buildFixture(tmpDir, ['quests.html'], [], marker)
        const testBudgetPath = writeBudget(tmpDir, {
          marker,
          maxRoutes: 99,
          mustNotLoad: ['renamed-away.html'],
        })

        const result = runNodeCli([guardScriptPath, '--fail', '--json'], {
          BUNDLE_BUDGET_JS_DIR: jsDir,
          BUNDLE_BUDGET_HTML_DIR: htmlDir,
          BUNDLE_BUDGET_CONFIG: testBudgetPath,
        })

        expect(result.status).toBe(1)
        expect(JSON.parse(result.stdout).breaches).toContainEqual({
          label: 'EAGER payload pinned route missing from build: geoCountryOutlines on renamed-away.html',
          missing: true,
        })
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    // `search.html` и `search/index.html` — одна страница; без схлопывания она
    // давала бы двойной вклад и рэтчет считал бы несуществующий рост.
    it('collapses the duplicate index.html route key when counting', () => {
      const tmpDir = makeTempDir('metravel-bundle-budget-payload-dedup-')
      try {
        const marker = '4155,4241,-5,23,-8,10'
        const { jsDir, htmlDir } = buildFixture(
          tmpDir,
          ['search.html', 'search/index.html'],
          ['map.html'],
          marker,
        )
        const testBudgetPath = writeBudget(tmpDir, { marker, maxRoutes: 1, mustNotLoad: [] })

        const result = runNodeCli([guardScriptPath, '--fail', '--json'], {
          BUNDLE_BUDGET_JS_DIR: jsDir,
          BUNDLE_BUDGET_HTML_DIR: htmlDir,
          BUNDLE_BUDGET_CONFIG: testBudgetPath,
        })

        expect(result.status).toBe(0)
        expect(JSON.parse(result.stdout).eagerPayloadRoutes).toEqual({ geoCountryOutlines: 1 })
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    // Молчаливый пропуск был бы худшим исходом: гейт выглядит зелёным, но не
    // охраняет ничего. Маркер обязан находиться в сборке.
    it('fails closed when the payload marker is absent from the build', () => {
      const tmpDir = makeTempDir('metravel-bundle-budget-payload-missing-')
      try {
        const { jsDir, htmlDir } = buildFixture(tmpDir, [], ['index.html'], 'unused-marker')
        const testBudgetPath = writeBudget(tmpDir, {
          marker: 'marker-that-does-not-exist',
          maxRoutes: 99,
          mustNotLoad: [],
        })

        const result = runNodeCli([guardScriptPath, '--fail', '--json'], {
          BUNDLE_BUDGET_JS_DIR: jsDir,
          BUNDLE_BUDGET_HTML_DIR: htmlDir,
          BUNDLE_BUDGET_CONFIG: testBudgetPath,
        })

        expect(result.status).toBe(1)
        expect(JSON.parse(result.stdout).breaches).toContainEqual({
          label: 'EAGER payload marker not found in build: geoCountryOutlines',
          missing: true,
        })
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    })

    it('fails closed when payload attribution is configured but HTML routes are off', () => {
      const tmpDir = makeTempDir('metravel-bundle-budget-payload-nohtml-')
      try {
        const jsDir = path.join(tmpDir, 'js')
        fs.mkdirSync(jsDir, { recursive: true })
        fs.writeFileSync(path.join(jsDir, 'payload-abcdef.js'), "globalThis.d='marker';")
        const testBudgetPath = path.join(tmpDir, 'budget.json')
        fs.writeFileSync(
          testBudgetPath,
          JSON.stringify({
            eager: {
              chunks: [],
              htmlRoutes: false,
              payloadRoutes: { geoCountryOutlines: { marker: 'marker', maxRoutes: 99 } },
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
          label: 'EAGER payload attribution unavailable: geoCountryOutlines (htmlRoutes disabled?)',
          missing: true,
        })
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    })
  })
})
