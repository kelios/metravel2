const fs = require('fs')
const path = require('path')

// Guard #3242: внутренние ссылки на статьи ведут сразу на канонический адрес.
//
// Семейство `internal-links-canonical-url` (#1956, #2932, #3242): slug статьи
// меняется при переименовании (`scripts/seo-rename.js`), а адрес, вписанный в
// код руками, остаётся прежним и начинает ходить через 301. Данные API всегда
// несут текущий slug, поэтому устаревают только два источника — литерал в коде
// и адрес, собранный в обход общего построителя. Отсюда два правила:
//
//   1. `stale-literal` — литерал `/travels/<slug>` или slug, переданный
//      построителю литералом (`travelHref('slug')`), записанный как `from`
//      в зеркале редиректов `scripts/seo-redirects.json`. `seo-rename.js` пишет
//      туда пару при каждом переименовании, поэтому следующий же lint называет
//      файл, строку и актуальный slug.
//   2. `ad-hoc-builder` — адрес страницы статьи, собранный шаблонной строкой или
//      конкатенацией вне `utils/routePaths.ts`. Построитель один
//      (`buildTravelPath` / `buildTravelPathFromTravel`): он же отсекает
//      `/travels/null` и `/travels/0` (#1185, #1438).
//
// API-эндпоинты (`/travels/${id}/`, `/api/travels/…`) адресами страниц не
// являются и под правило 2 не попадают: их отличает слэш после сегмента.

const OUTPUT_CONTRACT_VERSION = 1
const REDIRECT_MANIFEST = 'scripts/seo-redirects.json'
const BUILDER_FILE = 'utils/routePaths.ts'

/**
 * Места, где адрес статьи собирается без общего построителя, с причиной.
 * Список закрытый и только сокращается: новый файл сюда не дописывается, а
 * переходит на `utils/routePaths.ts`.
 */
const AD_HOC_BUILDER_BASELINE = new Map([
  [BUILDER_FILE, 'сам построитель'],
  ['app/+html.tsx', 'инлайн-скрипт документа: импорт модулей недоступен'],
  ['public/travel-hero-preload-v2.js', 'инлайн-прелоад вне бандла: импорт модулей недоступен'],
  ['utils/travelLinkGraph.js', 'CommonJS-генератор публикации: бэкенд сверяет путь побайтно с `/travels/<slug>`'],
  ['utils/questTravelLinks.js', 'CommonJS-генератор публикации, общий с node-скриптами'],
  ['utils/travelDetailsSecure.ts', 'абсолютный адрес для JSON-LD, slug уже проверен выше по коду'],
  ['services/offline/travelOfflineAdapter.ts', 'ключ офлайн-маршрута, не ссылка в разметке'],
])

// Продуктовые корни: всё, что попадает в бандл, в SSR или в `public/`. Список
// явный, потому что корень репозитория хранит отчёты и срезы аудитов, в которых
// старые адреса — это данные замера, а не ссылки сайта.
const SCAN_ROOTS = [
  'api', 'app', 'components', 'config', 'constants', 'context', 'data', 'hooks', 'i18n',
  'public', 'screens', 'services', 'stores', 'styles', 'types', 'ui', 'utils',
]
const IGNORED_DIRS = new Set(['node_modules', '__tests__', '__mocks__'])
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json'])

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const parseArgs = (argv) => ({ output: argv.includes('--json') ? 'json' : 'text' })

const shouldIgnoreByDir = (relativePath) => normalizePath(relativePath)
  .split('/')
  .some((part) => IGNORED_DIRS.has(part))

const shouldScanFile = (relativePath) => {
  const normalized = normalizePath(relativePath)
  if (!normalized || shouldIgnoreByDir(normalized)) return false
  if (!SCAN_ROOTS.includes(normalized.split('/')[0])) return false
  return SOURCE_EXTENSIONS.has(path.extname(normalized))
}

const collectSourceFiles = (rootDir) => {
  const files = []
  const walk = (dirPath) => {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const absolute = path.join(dirPath, entry.name)
      const relative = normalizePath(path.relative(rootDir, absolute))
      if (entry.isDirectory()) {
        if (!shouldIgnoreByDir(relative)) walk(absolute)
      } else if (entry.isFile() && shouldScanFile(relative)) {
        files.push(relative)
      }
    }
  }
  for (const root of SCAN_ROOTS) {
    const absolute = path.join(rootDir, root)
    if (fs.existsSync(absolute)) walk(absolute)
  }
  return files
}

/** `from → to` с раскрытием цепочек: адресом замены всегда служит конечный slug. */
const buildRedirectIndex = (manifest) => {
  const direct = new Map()
  for (const pair of Array.isArray(manifest?.redirects) ? manifest.redirects : []) {
    const from = String(pair?.from || '').trim()
    const to = String(pair?.to || '').trim()
    if (from && to && from !== to) direct.set(from, to)
  }
  const resolved = new Map()
  for (const from of direct.keys()) {
    let target = direct.get(from)
    for (let hop = 0; hop < 10 && direct.has(target); hop += 1) target = direct.get(target)
    resolved.set(from, target)
  }
  return resolved
}

const decodeSegment = (segment) => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

const isCommentLine = (line) => /^\s*(\/\/|\/\*|\*)/.test(line)

const TRAVEL_LITERAL_REGEX = /\/travels\/([^\s"'`<>?#)\\,;$]+)/g
// Голый slug — только как прямой аргумент построителя адреса статьи
// (`buildTravelPath('slug')`, `travelHref('slug')`): вне этого контекста короткий
// старый slug (`grodno`, `torun`) совпадает с обычным ключом города.
const SLUG_LITERAL_REGEX = /\b\w*[tT]ravel(?:Path|Href)\w*\(\s*(['"`])([^'"`\s]+)\1/g
// Шаблон `/travels/${…}` и конкатенация `'/travels/' + …`; `/api/travels/` — эндпоинт.
const TEMPLATE_REGEX = /(?<!\/api)\/travels\/\$\{/g
const CONCAT_REGEX = /(?<!\/api)\/travels\/['"`]\s*\+/g

/** Возвращает выражение `${…}` и символ сразу после закрывающей скобки. */
const readTemplateExpression = (line, start) => {
  let depth = 1
  for (let index = start; index < line.length; index += 1) {
    if (line[index] === '{') depth += 1
    else if (line[index] === '}') {
      depth -= 1
      if (depth === 0) return { expression: line.slice(start, index), next: line[index + 1] || '' }
    }
  }
  return { expression: line.slice(start), next: '' }
}

const findStaleLiterals = ({ filePath, content, redirects }) => {
  const violations = []
  content.split('\n').forEach((line, idx) => {
    for (const match of line.matchAll(TRAVEL_LITERAL_REGEX)) {
      const slug = decodeSegment(match[1]).replace(/\/+$/, '')
      const target = redirects.get(slug)
      if (!target) continue
      violations.push({
        rule: 'stale-literal',
        file: filePath,
        line: idx + 1,
        snippet: `/travels/${slug}`,
        fix: `/travels/${target}`,
      })
    }
    for (const match of line.matchAll(SLUG_LITERAL_REGEX)) {
      const slug = decodeSegment(match[2])
      const target = redirects.get(slug)
      if (!target) continue
      violations.push({ rule: 'stale-literal', file: filePath, line: idx + 1, snippet: slug, fix: target })
    }
  })
  return violations
}

const findAdHocBuilders = ({ filePath, content, includeBaseline = false }) => {
  const violations = []
  if (!includeBaseline && AD_HOC_BUILDER_BASELINE.has(filePath)) return violations
  if (!content.includes('/travels/')) return violations
  content.split('\n').forEach((line, idx) => {
    if (isCommentLine(line)) return
    let adHoc = false
    for (const match of line.matchAll(TEMPLATE_REGEX)) {
      const { expression, next } = readTemplateExpression(line, match.index + match[0].length)
      // `${string}` — шаблонный тип TypeScript. Эндпоинт API — относительный путь
      // клиента (литерал начинается с `/travels/`) со слэшем после сегмента; у
      // абсолютного адреса сайта (`https://metravel.by/travels/${slug}/`) хвостовой
      // слэш эндпоинтом его не делает.
      const startsLiteral = /[`'"]/.test(line[match.index - 1] || '')
      const isApiEndpoint = next === '/' && startsLiteral
      if (expression.trim() !== 'string' && !isApiEndpoint) adHoc = true
    }
    if (CONCAT_REGEX.test(line)) adHoc = true
    CONCAT_REGEX.lastIndex = 0
    if (adHoc) {
      violations.push({
        rule: 'ad-hoc-builder',
        file: filePath,
        line: idx + 1,
        snippet: line.trim().slice(0, 160),
        fix: `buildTravelPath / buildTravelPathFromTravel из ${BUILDER_FILE}`,
      })
    }
  })
  return violations
}

const findViolationsInSource = ({ filePath, content, redirects }) => {
  const normalizedPath = normalizePath(filePath)
  const text = String(content || '')
  return [
    ...findStaleLiterals({ filePath: normalizedPath, content: text, redirects: redirects || new Map() }),
    ...findAdHocBuilders({ filePath: normalizedPath, content: text }),
  ]
}

/** Запись списка исключений без единой сборки адреса — мёртвая: список только сокращается. */
const findDeadBaselineEntries = (sources) => sources
  .map((source) => ({ filePath: normalizePath(source.filePath), content: String(source.content || '') }))
  .filter(({ filePath }) => filePath !== BUILDER_FILE && AD_HOC_BUILDER_BASELINE.has(filePath))
  .filter((source) => findAdHocBuilders({ ...source, includeBaseline: true }).length === 0)
  .map(({ filePath }) => ({
    rule: 'dead-baseline',
    file: filePath,
    line: 1,
    snippet: 'файл больше не собирает адрес статьи сам',
    fix: 'убрать запись из AD_HOC_BUILDER_BASELINE в scripts/guard-travel-links.js',
  }))

const evaluateGuard = ({ sources = [], manifest = { redirects: [] } } = {}) => {
  const redirects = buildRedirectIndex(manifest)
  const violations = [
    ...sources.flatMap((source) => findViolationsInSource({ ...source, redirects })),
    ...findDeadBaselineEntries(sources),
  ]
  return violations.length === 0
    ? { ok: true, reason: 'Internal travel links are canonical and built through utils/routePaths.ts', violations: [] }
    : { ok: false, reason: 'Non-canonical or ad-hoc internal travel links found', violations }
}

const buildJsonResult = (result) => {
  const violations = Array.isArray(result?.violations) ? result.violations : []
  return {
    contractVersion: OUTPUT_CONTRACT_VERSION,
    ok: Boolean(result?.ok),
    reason: String(result?.reason || ''),
    violations,
    violationCount: violations.length,
  }
}

const formatViolations = (violations) => violations.map(
  (v) => `- [${v.rule}] ${v.file}:${v.line} -> ${v.snippet}\n    fix: ${v.fix}`,
)

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const rootDir = process.cwd()
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, REDIRECT_MANIFEST), 'utf8'))
  const sources = collectSourceFiles(rootDir).map((relativePath) => ({
    filePath: relativePath,
    content: fs.readFileSync(path.join(rootDir, relativePath), 'utf8'),
  }))
  const result = evaluateGuard({ sources, manifest })

  if (args.output === 'json') {
    process.stdout.write(`${JSON.stringify(buildJsonResult(result), null, 2)}\n`)
  } else if (result.ok) {
    console.log(`travel-links guard: ${result.reason}.`)
  } else {
    console.error(`travel-links guard: ${result.reason}.`)
    console.error(formatViolations(result.violations).join('\n'))
    console.error('Контракт: docs/RULES.md → «Internal travel links».')
  }
  // exitCode, а не exit(): большой JSON-отчёт должен дописаться в pipe целиком.
  if (!result.ok) process.exitCode = 1
}

if (require.main === module) main()

module.exports = {
  OUTPUT_CONTRACT_VERSION,
  REDIRECT_MANIFEST,
  BUILDER_FILE,
  SCAN_ROOTS,
  AD_HOC_BUILDER_BASELINE,
  parseArgs,
  shouldScanFile,
  buildRedirectIndex,
  findViolationsInSource,
  evaluateGuard,
  buildJsonResult,
}
