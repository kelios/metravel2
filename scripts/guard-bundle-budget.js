#!/usr/bin/env node

/**
 * Stage 7 regression guard: web bundle size budget.
 *
 * Reads the production web build chunks from `dist/prod/_expo/static/js/web`,
 * groups them by logical chunk name (filename without the content hash), and
 * compares raw + gzip + Brotli sizes against the committed budget in
 * `config/bundle-budget.json`.
 *
 * Goal: prevent the travel-route performance refactor (see
 * docs/TRAVEL_PERFORMANCE_REFACTOR.md, этап 7) from silently regressing.
 *
 * Usage:
 *   node scripts/guard-bundle-budget.js            # report only (exit 0)
 *   node scripts/guard-bundle-budget.js --fail     # exit 1 on any breach
 *   node scripts/guard-bundle-budget.js --json      # machine-readable output
 *   node scripts/guard-bundle-budget.js --update    # rewrite budget from current build
 */

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const repoRoot = path.join(__dirname, '..')
const DEFAULT_TOLERANCE_PCT = 5
const MAX_GLOBAL_REQUEST_SPARE_PCT = 5
const DEFAULT_BUDGET_DESCRIPTION =
  'Web bundle size budget (KB). Regression guard: critical path + eager chunks and total JS. Regenerate with `node scripts/guard-bundle-budget.js --update`, then re-curate key chunks. Runs in release:check after build:web:prod.'

function resolveRepoPath(value, fallback) {
  if (!value) return fallback
  return path.isAbsolute(value) ? value : path.join(repoRoot, value)
}

const jsDir = resolveRepoPath(
  process.env.BUNDLE_BUDGET_JS_DIR,
  path.join(repoRoot, 'dist', 'prod', '_expo', 'static', 'js', 'web'),
)
const htmlDir = resolveRepoPath(
  process.env.BUNDLE_BUDGET_HTML_DIR,
  path.join(repoRoot, 'dist', 'prod'),
)
const budgetPath = resolveRepoPath(
  process.env.BUNDLE_BUDGET_CONFIG,
  path.join(repoRoot, 'config', 'bundle-budget.json'),
)
const contractTestPath = resolveRepoPath(
  process.env.BUNDLE_BUDGET_CONTRACT_TEST,
  path.join(repoRoot, '__tests__', 'scripts', 'bundle-budget-release-contract.test.ts'),
)

const EAGER_REQUEST_PIN_START = '// bundle-budget-sync:eager-requests:start'
const EAGER_REQUEST_PIN_END = '// bundle-budget-sync:eager-requests:end'

const args = process.argv.slice(2)
const FAIL = args.includes('--fail')
const JSON_OUT = args.includes('--json')
const UPDATE = args.includes('--update')

function die(msg) {
  console.error(msg)
  process.exit(1)
}

function requireEagerRequestBudget(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  if (!Number.isInteger(value.maxRequests) || value.maxRequests <= 0) {
    throw new Error(`${label}.maxRequests must be a positive integer.`)
  }
  if (
    !value.maxRequestsByRoute ||
    typeof value.maxRequestsByRoute !== 'object' ||
    Array.isArray(value.maxRequestsByRoute)
  ) {
    throw new Error(`${label}.maxRequestsByRoute must be an object.`)
  }
  const routeEntries = Object.entries(value.maxRequestsByRoute)
  if (routeEntries.length === 0) {
    throw new Error(`${label}.maxRequestsByRoute must not be empty.`)
  }
  for (const [route, limit] of routeEntries) {
    if (
      !route.endsWith('.html') ||
      route.startsWith('/') ||
      route.includes('\\') ||
      route.split('/').includes('..')
    ) {
      throw new Error(`${label} route must be a normalized relative .html path: ${route}.`)
    }
    if (!Number.isInteger(limit) || limit <= 0 || limit > value.maxRequests) {
      throw new Error(`${label}.maxRequestsByRoute.${route} must be a positive integer at most maxRequests.`)
    }
  }
  const highestRouteLimit = Math.max(...routeEntries.map(([, limit]) => limit))
  const fallbackSparePct = ((value.maxRequests - highestRouteLimit) / highestRouteLimit) * 100
  if (fallbackSparePct > MAX_GLOBAL_REQUEST_SPARE_PCT) {
    throw new Error(
      `${label}.maxRequests fallback spare must stay at or below ${MAX_GLOBAL_REQUEST_SPARE_PCT}%.`,
    )
  }
  return {
    maxRequests: value.maxRequests,
    maxRequestsByRoute: Object.fromEntries(routeEntries),
  }
}

function detectLineEnding(source) {
  const crlfCount = source.split('\r\n').length - 1
  const bareLfCount = source.replace(/\r\n/g, '').split('\n').length - 1
  return crlfCount > bareLfCount ? '\r\n' : '\n'
}

function parseEagerRequestPin(source, label) {
  const lines = source.split(/\r?\n/)
  const startIndexes = lines.flatMap((line, index) => (line === EAGER_REQUEST_PIN_START ? [index] : []))
  const endIndexes = lines.flatMap((line, index) => (line === EAGER_REQUEST_PIN_END ? [index] : []))
  if (startIndexes.length !== 1 || endIndexes.length !== 1 || endIndexes[0] <= startIndexes[0] + 1) {
    throw new Error(`${label} must contain exactly one non-empty ordered eager request pin block.`)
  }

  const payload = lines
    .slice(startIndexes[0] + 1, endIndexes[0])
    .map((line) => {
      if (!line.startsWith('// ')) {
        throw new Error(`${label} eager request pin must contain JSON comment lines.`)
      }
      return line.slice(3)
    })
    .join('\n')
  let parsed
  try {
    parsed = JSON.parse(payload)
  } catch {
    throw new Error(`${label} eager request pin must contain valid JSON.`)
  }
  return {
    lines,
    lineEnding: detectLineEnding(source),
    startIndex: startIndexes[0],
    endIndex: endIndexes[0],
    budget: requireEagerRequestBudget(parsed, `${label} eager request pin`),
  }
}

function formatEagerRequestPin(requestBudget) {
  const payload = JSON.stringify(requestBudget, null, 2)
    .split('\n')
    .map((line) => `// ${line}`)
  return [EAGER_REQUEST_PIN_START, ...payload, EAGER_REQUEST_PIN_END]
}

function updateEagerRequestPin(source, requestBudget, label) {
  const current = parseEagerRequestPin(source, label)
  return [
    ...current.lines.slice(0, current.startIndex),
    ...formatEagerRequestPin(requestBudget),
    ...current.lines.slice(current.endIndex + 1),
  ].join(current.lineEnding)
}

function comparableRequestBudget(value) {
  return JSON.stringify({
    maxRequests: value.maxRequests,
    maxRequestsByRoute: Object.fromEntries(
      Object.entries(value.maxRequestsByRoute).sort(([a], [b]) => a.localeCompare(b)),
    ),
  })
}

function replaceFilesWithRollback(filesToReplace) {
  const targetKeys = filesToReplace.map((file) => {
    const realPath = fs.realpathSync.native(file.path)
    return process.platform === 'win32' ? realPath.toLowerCase() : realPath
  })
  if (new Set(targetKeys).size !== filesToReplace.length) {
    throw new Error('Atomic bundle budget sync targets must be distinct.')
  }
  const nonce = `${process.pid}-${Date.now()}`
  const prepared = []
  try {
    for (const [index, file] of filesToReplace.entries()) {
      const stat = fs.statSync(file.path)
      if (!stat.isFile() || fs.lstatSync(file.path).isSymbolicLink()) {
        throw new Error(`Atomic bundle budget sync target must be a regular file: ${file.path}`)
      }
      const preparedFile = {
        ...file,
        tempPath: `${file.path}.${nonce}-${index}.tmp`,
        backupPath: `${file.path}.${nonce}-${index}.backup`,
        mode: stat.mode & 0o7777,
      }
      if (fs.existsSync(preparedFile.tempPath) || fs.existsSync(preparedFile.backupPath)) {
        throw new Error(`Atomic bundle budget sync staging path already exists for ${file.path}.`)
      }
      prepared.push(preparedFile)
      fs.writeFileSync(preparedFile.tempPath, file.content, {
        encoding: 'utf8',
        flag: 'wx',
        mode: preparedFile.mode,
      })
      fs.chmodSync(preparedFile.tempPath, preparedFile.mode)
      file.validate(fs.readFileSync(preparedFile.tempPath, 'utf8'))
    }
  } catch (error) {
    for (const file of prepared) fs.rmSync(file.tempPath, { force: true })
    throw error
  }

  const backedUp = []
  const installed = []
  try {
    for (const file of prepared) {
      fs.renameSync(file.path, file.backupPath)
      backedUp.push(file)
      fs.renameSync(file.tempPath, file.path)
      installed.push(file)
    }
  } catch (error) {
    const rollbackErrors = []
    for (const file of [...installed].reverse()) {
      try {
        fs.rmSync(file.path, { force: true })
      } catch (rollbackError) {
        rollbackErrors.push(`${file.path}: cannot remove partial replacement (${rollbackError.message})`)
      }
    }
    for (const file of [...backedUp].reverse()) {
      if (!fs.existsSync(file.backupPath)) continue
      if (fs.existsSync(file.path)) {
        rollbackErrors.push(`${file.path}: destination occupied; original preserved at ${file.backupPath}`)
        continue
      }
      try {
        fs.renameSync(file.backupPath, file.path)
      } catch (rollbackError) {
        rollbackErrors.push(
          `${file.path}: cannot restore original (${rollbackError.message}); original preserved at ${file.backupPath}`,
        )
      }
    }
    const rollbackSuffix = rollbackErrors.length ? ` Rollback failed: ${rollbackErrors.join('; ')}` : ''
    throw new Error(`Atomic bundle budget sync failed: ${error.message}.${rollbackSuffix}`)
  } finally {
    for (const file of prepared) fs.rmSync(file.tempPath, { force: true })
  }
  for (const file of prepared) fs.rmSync(file.backupPath, { force: true })
}

if (!fs.existsSync(jsDir)) {
  die(
    `Web build chunks not found at ${path.relative(repoRoot, jsDir)}.\n` +
      `Run "npm run build:web:prod" first.`,
  )
}

// Strip the Metro content hash so chunks are stable across builds.
//   entry-1a2b3c4d5e6f.js        -> entry
//   __common-9f8e7d.js           -> __common
//   TravelDetailsContainer-ab12.js -> TravelDetailsContainer
function logicalName(file) {
  return file.replace(/\.js$/, '').replace(/-[0-9a-f]{6,}$/i, '')
}

const KB = 1024
const toKB = (bytes) => Math.round((bytes / KB) * 10) / 10

const files = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'))

// Aggregate per logical chunk (a logical name can map to >1 hashed file
// across incremental builds; sum them so the budget stays meaningful).
const chunks = new Map()
const fileSizes = new Map()
let allRaw = 0
let allGzip = 0
let allBrotli = 0
for (const file of files) {
  const buf = fs.readFileSync(path.join(jsDir, file))
  const raw = buf.length
  const gzip = zlib.gzipSync(buf).length
  const brotli = zlib.brotliCompressSync(buf, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
  }).length
  allRaw += raw
  allGzip += gzip
  allBrotli += brotli
  fileSizes.set(file, { raw, gzip, brotli })
  const name = logicalName(file)
  // Route-scoped chunk dependency metadata is measured by the HTML eager and
  // release-total budgets. Strip only that generated prefix for named feature
  // budgets so a 300-byte manifest does not look like feature-code growth.
  const source = buf.toString('utf8')
  const budgetSource = source.replace(
    /^globalThis\.__METRAVEL_CHUNK_DEPS__\?\?=\{};globalThis\.__METRAVEL_CHUNK_DEPS__\[[^\]]+\]=\[(?:"[^"]*"|[0-9]+)(?:,(?:"[^"]*"|[0-9]+))*\];/,
    '',
  )
  const budgetBuf = budgetSource.length === source.length ? buf : Buffer.from(budgetSource)
  const budgetRaw = budgetBuf.length
  const budgetGzip = budgetBuf === buf ? gzip : zlib.gzipSync(budgetBuf).length
  const budgetBrotli =
    budgetBuf === buf
      ? brotli
      : zlib.brotliCompressSync(budgetBuf, {
          params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
        }).length
  const prev = chunks.get(name) || { raw: 0, gzip: 0, brotli: 0, files: 0 }
  chunks.set(name, {
    raw: prev.raw + budgetRaw,
    gzip: prev.gzip + budgetGzip,
    brotli: prev.brotli + budgetBrotli,
    files: prev.files + 1,
  })
}

if (UPDATE) {
  if (!fs.existsSync(budgetPath)) {
    die(`Cannot update bundle budget: config not found at ${path.relative(repoRoot, budgetPath)}.`)
  }
  if (!fs.existsSync(contractTestPath)) {
    die(`Cannot update bundle budget: contract test not found at ${path.relative(repoRoot, contractTestPath)}.`)
  }

  let existingBudget
  let existingBudgetSource
  try {
    existingBudgetSource = fs.readFileSync(budgetPath, 'utf-8')
    existingBudget = JSON.parse(existingBudgetSource)
  } catch (error) {
    die(`Cannot update bundle budget: invalid config JSON (${error.message}).`)
  }
  let requestBudget
  let existingContractSource
  try {
    requestBudget = requireEagerRequestBudget(existingBudget.eager, 'bundle budget.eager')
    existingContractSource = fs.readFileSync(contractTestPath, 'utf8')
    parseEagerRequestPin(existingContractSource, 'bundle budget contract test')
  } catch (error) {
    die(`Cannot update bundle budget: ${error.message}`)
  }

  const deferredChunks = existingBudget.deferredChunks || []
  const deferredSet = new Set(deferredChunks)
  const deferredRaw = [...chunks.entries()].reduce(
    (total, [name, chunk]) => total + (deferredSet.has(name) ? chunk.raw : 0),
    0,
  )
  const deferredGzip = [...chunks.entries()].reduce(
    (total, [name, chunk]) => total + (deferredSet.has(name) ? chunk.gzip : 0),
    0,
  )
  const deferredBrotli = [...chunks.entries()].reduce(
    (total, [name, chunk]) => total + (deferredSet.has(name) ? chunk.brotli : 0),
    0,
  )
  const budget = {
    description: existingBudget.description || DEFAULT_BUDGET_DESCRIPTION,
    tolerancePct: DEFAULT_TOLERANCE_PCT,
    deferredChunks,
    ...(Array.isArray(existingBudget.forbiddenChunks)
      ? { forbiddenChunks: existingBudget.forbiddenChunks }
      : {}),
    ...(existingBudget.eager ? { eager: existingBudget.eager } : {}),
    total: {
      maxRawKB: toKB(allRaw - deferredRaw),
      maxGzipKB: toKB(allGzip - deferredGzip),
      maxBrotliKB: toKB(allBrotli - deferredBrotli),
    },
    chunks: {},
  }
  for (const [name, c] of [...chunks.entries()].sort((a, b) => b[1].raw - a[1].raw)) {
    budget.chunks[name] = {
      maxRawKB: toKB(c.raw),
      maxGzipKB: toKB(c.gzip),
      maxBrotliKB: toKB(c.brotli),
    }
  }
  const budgetLineEnding = detectLineEnding(existingBudgetSource)
  const budgetContent = JSON.stringify(budget, null, 2).replace(/\n/g, budgetLineEnding) + budgetLineEnding
  const contractContent = updateEagerRequestPin(
    existingContractSource,
    requestBudget,
    'bundle budget contract test',
  )
  try {
    replaceFilesWithRollback([
      {
        path: contractTestPath,
        content: contractContent,
        validate: (content) => {
          const writtenPin = parseEagerRequestPin(content, 'updated bundle budget contract test').budget
          if (comparableRequestBudget(writtenPin) !== comparableRequestBudget(requestBudget)) {
            throw new Error('updated bundle budget contract test pin does not match budget.eager.')
          }
        },
      },
      {
        path: budgetPath,
        content: budgetContent,
        validate: (content) => {
          const writtenBudget = JSON.parse(content)
          const writtenRequests = requireEagerRequestBudget(
            writtenBudget.eager,
            'updated bundle budget.eager',
          )
          if (comparableRequestBudget(writtenRequests) !== comparableRequestBudget(requestBudget)) {
            throw new Error('updated bundle budget config lost its eager request limits.')
          }
        },
      },
    ])
  } catch (error) {
    die(`Cannot update bundle budget: ${error.message}`)
  }
  console.log(
    `Wrote budget for ${chunks.size} chunks to ${path.relative(repoRoot, budgetPath)} and synced ` +
      `${path.relative(repoRoot, contractTestPath)}`,
  )
  process.exit(0)
}

if (!fs.existsSync(budgetPath)) {
  die(
    `Budget file not found at ${path.relative(repoRoot, budgetPath)}.\n` +
      `Generate it with "node scripts/guard-bundle-budget.js --update".`,
  )
}

const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf-8'))
const tol = 1 + (Number(budget.tolerancePct) || 0) / 100
const forbiddenChunkNames = Array.isArray(budget.forbiddenChunks) ? budget.forbiddenChunks : []
const deferredSet = new Set(Array.isArray(budget.deferredChunks) ? budget.deferredChunks : [])
const deferredRaw = [...chunks.entries()].reduce(
  (total, [name, chunk]) => total + (deferredSet.has(name) ? chunk.raw : 0),
  0,
)
const deferredGzip = [...chunks.entries()].reduce(
  (total, [name, chunk]) => total + (deferredSet.has(name) ? chunk.gzip : 0),
  0,
)
const deferredBrotli = [...chunks.entries()].reduce(
  (total, [name, chunk]) => total + (deferredSet.has(name) ? chunk.brotli : 0),
  0,
)
const totalRaw = allRaw - deferredRaw
const totalGzip = allGzip - deferredGzip
const totalBrotli = allBrotli - deferredBrotli

const breaches = []
for (const name of forbiddenChunkNames) {
  if (chunks.has(name)) {
    breaches.push({ label: `Forbidden chunk present: ${name}`, forbidden: true })
  }
}
function check(label, actualKB, maxKB, tolerance = tol) {
  if (maxKB == null) return
  const limit = Math.round(maxKB * tolerance * 10) / 10
  if (actualKB > limit) {
    breaches.push({ label, actualKB, maxKB, limitKB: limit })
  }
}

// #1372: счётчик, а не байты. После сплита #1286 маршрут стал тянуть десятки
// отдельных JS-файлов, и на мобильной задержке 150 мс round-trip'ы доминируют
// над весом — байтовый бюджет этот класс регрессии не видит. Допуска нет:
// счётчик целый и растёт только осознанной правкой разбиения.
//
// Область охвата: считаются ТОЛЬКО eager-запросы, объявленные тегами <script>
// в статическом HTML. Динамические import()-чанки маршрута сюда не попадают:
// прод-замер #1372 дал 62 сетевых JS-запроса до `app-hydrated` при 32 тегах в
// `/search`, то есть примерно половина графа приходит рантаймом и этим гейтом
// не покрыта. Ловить её нужно сетевым прогоном, а не разбором HTML.
function checkCount(label, actual, max) {
  if (max == null) return
  if (actual > max) {
    breaches.push({ label, actual, max })
  }
}

// `search/index.html` и `search.html` — одна и та же страница; ключ маршрута
// должен быть один, иначе бюджет пришлось бы дублировать.
function toRouteKey(relativePath) {
  return relativePath.replace(/\/index\.html$/, '.html')
}

for (const [name, b] of Object.entries(budget.chunks || {})) {
  const c = chunks.get(name)
  if (!c) continue // chunk dropped/renamed — not a size regression
  check(`${name} (raw)`, toKB(c.raw), b.maxRawKB)
  check(`${name} (gzip)`, toKB(c.gzip), b.maxGzipKB)
  check(`${name} (brotli)`, toKB(c.brotli), b.maxBrotliKB)
}
if (budget.total) {
  check('TOTAL (raw)', toKB(totalRaw), budget.total.maxRawKB)
  check('TOTAL (gzip)', toKB(totalGzip), budget.total.maxGzipKB)
  check('TOTAL (brotli)', toKB(totalBrotli), budget.total.maxBrotliKB)
}

const eagerChunkNames = Array.isArray(budget?.eager?.chunks) ? budget.eager.chunks : []
const missingEagerChunks = eagerChunkNames.filter((name) => !chunks.has(name))
const configuredEager = eagerChunkNames.reduce(
  (result, name) => {
    const chunk = chunks.get(name)
    if (!chunk) return result
    result.raw += chunk.raw
    result.gzip += chunk.gzip
    result.brotli += chunk.brotli
    return result
  },
  { raw: 0, gzip: 0, brotli: 0 },
)
let eager = configuredEager
let eagerPage = null
let eagerRequests = 0
let eagerRequestsPage = null
const eagerRequestBreaches = new Map()
const eagerRequestRoutes = new Set()
const payloadRouteCounts = new Map()
if (budget?.eager?.htmlRoutes === true) {
  if (!fs.existsSync(htmlDir)) {
    breaches.push({ label: `EAGER HTML directory missing: ${path.relative(repoRoot, htmlDir)}`, missing: true })
  } else {
    const htmlFiles = []
    const collectHtmlFiles = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) collectHtmlFiles(fullPath)
        else if (entry.isFile() && entry.name.endsWith('.html')) htmlFiles.push(fullPath)
      }
    }
    collectHtmlFiles(htmlDir)
    const candidates = []
    for (const htmlFile of htmlFiles) {
      const html = fs.readFileSync(htmlFile, 'utf8')
      const scriptFiles = new Set(
        [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js(?:\?[^"']*)?)["']/gi)]
          .map((match) => {
            try {
              return path.basename(new URL(match[1], 'https://metravel.invalid').pathname)
            } catch {
              return null
            }
          })
          .filter(Boolean),
      )
      if (!scriptFiles.size) continue
      const result = {
        raw: 0,
        gzip: 0,
        brotli: 0,
        requests: scriptFiles.size,
        scripts: scriptFiles,
        missing: [],
        file: htmlFile,
      }
      for (const scriptFile of scriptFiles) {
        const sizes = fileSizes.get(scriptFile)
        if (!sizes) {
          result.missing.push(scriptFile)
          continue
        }
        result.raw += sizes.raw
        result.gzip += sizes.gzip
        result.brotli += sizes.brotli
      }
      candidates.push(result)
    }
    if (!candidates.length) {
      breaches.push({ label: 'EAGER HTML route scripts missing', missing: true })
    } else {
      // Самая тяжёлая и самая «многозапросная» страница — не обязательно одна и
      // та же, поэтому счётчик берём отдельным максимумом.
      const heaviestByRequests = candidates.reduce((a, b) => (b.requests > a.requests ? b : a))
      eagerRequests = heaviestByRequests.requests
      eagerRequestsPage = toRouteKey(
        path.relative(htmlDir, heaviestByRequests.file) || path.basename(heaviestByRequests.file),
      )
      // Потолок нужен ПОМАРШРУТНЫЙ: глобальный максимум держит только самый
      // многозапросный маршрут, а регрессия на `/search` (32 → 55) прошла бы
      // под ним незамеченной.
      for (const candidate of candidates) {
        const routeKey = toRouteKey(
          path.relative(htmlDir, candidate.file) || path.basename(candidate.file),
        )
        const routeMax = budget?.eager?.maxRequestsByRoute?.[routeKey]
        if (routeMax == null) continue
        eagerRequestRoutes.add(routeKey)
        if (candidate.requests > routeMax) {
          eagerRequestBreaches.set(routeKey, { actual: candidate.requests, max: routeMax })
        }
      }
      // #1393: атрибуция «тяжёлый payload → маршруты, которые его тянут».
      // Ни байтовый, ни счётчиковый бюджет не видят, ЧТО именно приехало на
      // маршрут: #1286 меряет сумму по худшей странице, #1372 — число тегов.
      // Модуль, достижимый из двух и более async-корней, поднимается Metro в
      // shared-чанк без проверки, кому этот чанк нужен, и оба гейта остаются
      // зелёными. Здесь payload опознаётся по маркеру в собранном JS, а не по
      // имени чанка: имена вида `__shared-5` перенумеровываются от сборки к
      // сборке (в #1393 один и тот же payload успел побывать `__shared-5`,
      // `__shared-14` и `__shared-59`), и пин по имени не пережил бы и одной
      // пересборки.
      for (const [payloadName, spec] of Object.entries(budget?.eager?.payloadRoutes || {})) {
        const marker = spec?.marker
        if (!marker) continue
        const carriers = files.filter((file) =>
          fs.readFileSync(path.join(jsDir, file), 'utf8').includes(marker),
        )
        if (!carriers.length) {
          // Маркер пропал — payload переехал, переименовался или вырезан.
          // Молча пропускать нельзя: гейт перестал бы что-либо охранять.
          breaches.push({
            label: `EAGER payload marker not found in build: ${payloadName}`,
            missing: true,
          })
          continue
        }
        const carrierSet = new Set(carriers)
        // Ключи маршрутов, а не файлы: `search/index.html` и `search.html` — одна
        // страница, и без схлопывания она давала бы двойной вклад и в числитель,
        // и в знаменатель.
        const routes = new Set(
          candidates
            .filter((candidate) => [...candidate.scripts].some((script) => carrierSet.has(script)))
            .map((candidate) =>
              toRouteKey(path.relative(htmlDir, candidate.file) || path.basename(candidate.file)),
            ),
        )
        const totalRoutes = new Set(
          candidates.map((candidate) =>
            toRouteKey(path.relative(htmlDir, candidate.file) || path.basename(candidate.file)),
          ),
        )
        payloadRouteCounts.set(payloadName, { routes: routes.size, total: totalRoutes.size })
        checkCount(`EAGER payload routes (${payloadName})`, routes.size, spec.maxRoutes)
        // Односторонний рэтчет `maxRoutes` не защищает конкретный маршрут:
        // освободить главную и одновременно нагрузить карту он разрешает.
        // `mustNotLoad` закрепляет уже освобождённые маршруты поимённо.
        const forbidden = new Set(Array.isArray(spec.mustNotLoad) ? spec.mustNotLoad : [])
        for (const routeKey of forbidden) {
          if (!totalRoutes.has(routeKey)) {
            // Переименованная или исчезнувшая страница молча снимала бы пин —
            // ровно так гейт и перестаёт охранять то, ради чего заведён.
            breaches.push({
              label: `EAGER payload pinned route missing from build: ${payloadName} on ${routeKey}`,
              missing: true,
            })
            continue
          }
          if (routes.has(routeKey)) {
            breaches.push({
              label: `EAGER payload on forbidden route: ${payloadName} on ${routeKey}`,
              forbidden: true,
            })
          }
        }
      }

      const worst = candidates.sort((a, b) => b.brotli - a.brotli)[0]
      eager = { raw: worst.raw, gzip: worst.gzip, brotli: worst.brotli }
      eagerPage = path.relative(htmlDir, worst.file) || path.basename(worst.file)
      for (const candidate of candidates) {
        for (const missing of candidate.missing) {
          const page = path.relative(htmlDir, candidate.file) || path.basename(candidate.file)
          breaches.push({ label: `EAGER HTML asset missing: ${missing} (${page})`, missing: true })
        }
      }
    }
  }
}
if (budget.eager) {
  for (const name of missingEagerChunks) {
    breaches.push({ label: `EAGER chunk missing: ${name}`, missing: true })
  }
  const eagerTol = 1 + (Number(budget.eager.tolerancePct) || 0) / 100
  check('EAGER (raw)', toKB(eager.raw), budget.eager.maxRawKB, eagerTol)
  check('EAGER (gzip)', toKB(eager.gzip), budget.eager.maxGzipKB, eagerTol)
  check('EAGER (brotli)', toKB(eager.brotli), budget.eager.maxBrotliKB, eagerTol)
  const wantsRequestBudget =
    budget.eager.maxRequests != null || budget.eager.maxRequestsByRoute != null
  if (wantsRequestBudget && !eagerRequests) {
    breaches.push({ label: 'EAGER HTML request count unavailable (htmlRoutes disabled?)', missing: true })
  }
  for (const [routeKey, { actual, max }] of eagerRequestBreaches) {
    checkCount(`EAGER (requests, ${routeKey})`, actual, max)
  }
  // Общий потолок ловит маршруты без собственной строки бюджета — в том числе
  // только что появившиеся.
  checkCount(
    `EAGER (requests${eagerRequestsPage ? `, worst HTML ${eagerRequestsPage}` : ''})`,
    eagerRequests,
    budget.eager.maxRequests,
  )
  for (const routeKey of Object.keys(budget.eager.maxRequestsByRoute || {})) {
    if (!eagerRequestRoutes.has(routeKey)) {
      breaches.push({ label: `EAGER budgeted route missing from build: ${routeKey}`, missing: true })
    }
  }
  // Тот же fail-closed принцип, что и у счётчика запросов: настроенная
  // атрибуция payload'ов без разбора HTML-маршрутов молчала бы вместо проверки.
  for (const payloadName of Object.keys(budget.eager.payloadRoutes || {})) {
    if (!payloadRouteCounts.has(payloadName)) {
      breaches.push({
        label: `EAGER payload attribution unavailable: ${payloadName} (htmlRoutes disabled?)`,
        missing: true,
      })
    }
  }
}

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        totalRawKB: toKB(totalRaw),
        totalGzipKB: toKB(totalGzip),
        totalBrotliKB: toKB(totalBrotli),
        allRawKB: toKB(allRaw),
        allGzipKB: toKB(allGzip),
        allBrotliKB: toKB(allBrotli),
        deferredRawKB: toKB(deferredRaw),
        deferredGzipKB: toKB(deferredGzip),
        deferredBrotliKB: toKB(deferredBrotli),
        eagerRawKB: toKB(eager.raw),
        eagerGzipKB: toKB(eager.gzip),
        eagerBrotliKB: toKB(eager.brotli),
        eagerChunks: eagerChunkNames,
        eagerPage,
        eagerRequests,
        eagerRequestsPage,
        eagerRequestsByRoute: Object.fromEntries(
          [...eagerRequestBreaches].map(([routeKey, value]) => [routeKey, value.actual]),
        ),
        eagerPayloadRoutes: Object.fromEntries(
          [...payloadRouteCounts].map(([payloadName, value]) => [payloadName, value.routes]),
        ),
        forbiddenChunks: forbiddenChunkNames,
        chunkCount: chunks.size,
        breaches,
      },
      null,
      2,
    ),
  )
} else {
  console.log(`Bundle budget check — tolerance ±${budget.tolerancePct || 0}%`)
  console.log(
    `  release total: ${toKB(totalRaw)} KB raw / ${toKB(totalGzip)} KB gzip / ` +
      `${toKB(totalBrotli)} KB brotli (${chunks.size} chunks; deferred: ${toKB(deferredRaw)} KB raw / ` +
      `${toKB(deferredGzip)} KB gzip / ${toKB(deferredBrotli)} KB brotli)`,
  )
  if (eagerChunkNames.length) {
    console.log(
      `  eager (${eagerPage ? `worst HTML ${eagerPage}` : eagerChunkNames.join(' + ')}): ${toKB(eager.raw)} KB raw / ` +
        `${toKB(eager.gzip)} KB gzip / ${toKB(eager.brotli)} KB brotli`,
    )
  }
  if (eagerRequests) {
    console.log(
      `  eager JS requests (worst HTML ${eagerRequestsPage}): ${eagerRequests}` +
        (budget?.eager?.maxRequests != null ? ` / ${budget.eager.maxRequests}` : ''),
    )
  }
  for (const [payloadName, { routes, total }] of payloadRouteCounts) {
    const max = budget?.eager?.payloadRoutes?.[payloadName]?.maxRoutes
    console.log(
      `  eager payload ${payloadName}: ${routes} / ${total} HTML routes` +
        (max != null ? ` (max ${max})` : ''),
    )
  }
  if (breaches.length === 0) {
    console.log('✓ all budgeted chunks within limits')
  } else {
    console.log(`✗ ${breaches.length} budget breach(es):`)
    for (const b of breaches) {
      // `missing`/`forbidden` — не размерные нарушения: у них нет ни actual, ни
      // budget, и общий формат печатал бы «undefined KB > undefined KB».
      if (b.missing || b.forbidden) {
        console.log(`  - ${b.label}`)
      } else if (b.actual != null) {
        console.log(`  - ${b.label}: ${b.actual} > ${b.max} (budget ${b.max})`)
      } else {
        console.log(`  - ${b.label}: ${b.actualKB} KB > ${b.limitKB} KB (budget ${b.maxKB} KB)`)
      }
    }
  }
}

if (breaches.length > 0 && FAIL) process.exit(1)
process.exit(0)
