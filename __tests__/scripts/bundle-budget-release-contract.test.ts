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
    // #1543: пины повторно опущены до фактических после схлопывания чанков с
    // одинаковым route-set и отложенной загрузки неактивных секций планировщика.
    // Пин существует, чтобы потолок нельзя было ПОДНЯТЬ ради зелёной сборки; опускать его
    // вслед за реальным выигрышем — ровно то, ради чего он и заведён.
    expect(budget?.eager).toMatchObject({
      chunks: ['entry', '__expo-metro-runtime'],
      htmlRoutes: true,
      maxBrotliKB: 775,
      // #1372: потолок на ЧИСЛО eager JS-запросов маршрута. Без пина его легко
      // поднять, чтобы «позеленить» сборку, — а именно это Task Contract
      // задачи и запрещает.
      maxRequests: 20,
      maxRequestsByRoute: {
        'index.html': 14,
        'search.html': 9,
        'map.html': 14,
        'quests.html': 12,
        '(tabs)/travels/[param].html': 16,
        '(tabs)/profile.html': 20,
        '(tabs)/trips/plan/[id].html': 19,
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
