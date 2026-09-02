const fs = require('fs')
const path = require('path')

// Guard #1710 (класс API-PAGE-SIZE-CAP-001): запрещает инлайн-реализацию правила
// «сколько страниц дочитывать» вне канонического `utils/fetchAllPages.ts`.
//
// Правило звучит так: число страниц считается по ФАКТИЧЕСКИ отданному размеру
// первой страницы, а не по запрошенному `perPage`, потому что сервер режет
// страницу своим `max_page_size` и деление на запрошенное молча теряет хвост.
// Это правило уже трижды писали независимо друг от друга — в календаре (#1705),
// в сохранённых точках (#1706) и в каталоге квестов (#1238/#1240), — и дважды
// из трёх это заканчивалось потерянными записями у пользователя. Guard делает
// четвёртую копию падающей проверкой, а не четвёртой карточкой.
//
// Каноническое место — `resolveTotalPages()` в `utils/fetchAllPages.ts`. Своя
// обвязка докачки допустима (каталогу квестов нужны спекулятивные страницы и
// 404-как-конец каталога), но правило она обязана брать оттуда же.

const OUTPUT_CONTRACT_VERSION = 1

// Канонический владелец правила. Список строгий: если файл перестал содержать
// расчёт, guard падает — значит правило переехало, и гейт ослеп бы молча.
const CANONICAL_FILE = 'utils/fetchAllPages.ts'

// Исключения по конвенции соседних guard'ов. Пуст и должен таким остаться:
// своя обвязка докачки допустима, но расчёт числа страниц она обязана брать из
// `resolveTotalPages()` — так живёт `api/quests.ts` с его спекулятивными
// страницами и 404-как-концом каталога.
const ALLOWED_FILES = new Set()

const IGNORED_DIRS = new Set([
  '.git',
  '.expo',
  '.prod-build-tmp',
  '.tmp',
  '.tmp-article',
  '.chk-web',
  '.chk-android',
  '.codex-temp',
  '.claude',
  'node_modules',
  'dist',
  'dist-stub',
  'dist-dev-diag',
  'dist-web-analyze',
  'dist-web-analyze-sm',
  'web-build',
  'coverage',
  'test-results',
  'playwright-report',
  '__tests__',
  'e2e',
  'scripts',
])

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'])

// Инлайнированные вендорные бандлы (напр. `utils/quillInlineAsset.ts`) лежат
// одной минифицированной строкой: искать в них наш паттерн бессмысленно.
const MAX_SCANNED_LINE_LENGTH = 400

// Расчёт числа страниц: `Math.ceil(<что-то про total> / <делитель>)`.
// Делитель намеренно НЕ сверяется со словарём имён: размер страницы зовут и
// `pageSize`, и `size`, и `chunk`, и словарь такую копию пропускал бы. Отсечку
// даёт числитель (`total`/`count`) плюс контекст ниже.
const PAGE_COUNT_REGEX = /Math\.ceil\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g
const TOTAL_OPERAND_REGEX = /\b(?:total|count|totalItems|totalCount)\b/i

// Признак того, что расчёт кормит сетевую докачку, а не отрисовку пагинатора:
// рядом читают страницы ПО НОМЕРУ. Голый `await` в маркеры не годится — тогда
// первый же асинхронный хендлер, добавленный в `PaginationComponent`, красил бы
// гейт на чисто отрисовочном коде, и погасить его было бы нечем.
const PAGE_FETCH_MARKER_REGEX =
  /\b(?:loadPage|getPage|fetchPage|fetchPages|fetchAllPages|perPage|per_page|page_size|pageSize|pageNumber)\s*[(:=,)]|[?&]page=/i
// Вторая форма того же признака: параллельный заход по диапазону страниц.
const PARALLEL_RANGE_REGEX = /Promise\.all(?:Settled)?\s*\(\s*(?:\/\/[^\n]*\n\s*)*Array\.from\s*\(\s*\{\s*length/
const FETCH_CONTEXT_RADIUS = 30

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const parseArgs = (argv) => ({
  output: argv.includes('--json') ? 'json' : 'text',
})

const shouldIgnoreByDir = (relativePath) => {
  const parts = normalizePath(relativePath).split('/')
  return parts.some((part) => IGNORED_DIRS.has(part) || part.startsWith('dist-'))
}

const shouldScanFile = (relativePath) => {
  if (!relativePath) return false
  if (shouldIgnoreByDir(relativePath)) return false
  return SOURCE_EXTENSIONS.has(path.extname(relativePath))
}

// Комментарии не нарушение: этот guard, доки и пояснения рядом с вызовом
// канонического хелпера вправе цитировать формулу.
const isCommentLine = (line) => {
  const trimmed = String(line || '').trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

const splitTopLevelDivision = (expression) => {
  let depth = 0
  for (let i = 0; i < expression.length; i += 1) {
    const char = expression[i]
    if (char === '(') depth += 1
    else if (char === ')') depth -= 1
    else if (char === '/' && depth === 0) {
      return [expression.slice(0, i), expression.slice(i + 1)]
    }
  }
  return null
}

const isPageCountExpression = (expression) => {
  const operands = splitTopLevelDivision(expression)
  if (!operands) return false
  const [numerator, denominator] = operands
  return TOTAL_OPERAND_REGEX.test(numerator) && denominator.trim().length > 0
}

const hasFetchContext = (lines, lineIndex) => {
  const from = Math.max(0, lineIndex - FETCH_CONTEXT_RADIUS)
  const to = Math.min(lines.length, lineIndex + FETCH_CONTEXT_RADIUS + 1)
  const window = lines.slice(from, to).filter((line) => !isCommentLine(line)).join('\n')
  return PAGE_FETCH_MARKER_REGEX.test(window) || PARALLEL_RANGE_REGEX.test(window)
}

const findPageCountLines = ({ content }) => {
  const lines = String(content || '').split('\n')
  const hits = []
  lines.forEach((line, index) => {
    if (isCommentLine(line)) return
    if (line.length > MAX_SCANNED_LINE_LENGTH) return
    PAGE_COUNT_REGEX.lastIndex = 0
    let match = PAGE_COUNT_REGEX.exec(line)
    while (match) {
      if (isPageCountExpression(match[1])) {
        hits.push({ line: index + 1, snippet: line.trim(), lineIndex: index })
        break
      }
      match = PAGE_COUNT_REGEX.exec(line)
    }
  })
  return { lines, hits }
}

const findViolationsInSource = ({ filePath, content }) => {
  const normalizedPath = normalizePath(filePath)
  if (normalizedPath === CANONICAL_FILE) return []
  if (ALLOWED_FILES.has(normalizedPath)) return []

  const { lines, hits } = findPageCountLines({ content })
  return hits
    .filter((hit) => hasFetchContext(lines, hit.lineIndex))
    .map((hit) => ({ file: normalizedPath, line: hit.line, snippet: hit.snippet }))
}

const evaluateGuard = ({ sources = [] } = {}) => {
  const violations = []
  for (const source of sources) {
    violations.push(...findViolationsInSource(source))
  }

  const canonical = sources.find((source) => normalizePath(source.filePath) === CANONICAL_FILE)
  if (!canonical) {
    return {
      ok: false,
      reason: `Canonical page-count owner ${CANONICAL_FILE} is missing — the guard would silently stop protecting anything`,
      violations,
    }
  }
  if (findPageCountLines(canonical).hits.length === 0) {
    return {
      ok: false,
      reason: `Canonical page-count owner ${CANONICAL_FILE} no longer computes the page count — move resolveTotalPages back or update this guard`,
      violations,
    }
  }

  if (violations.length === 0) {
    return {
      ok: true,
      reason: `Page count is derived only in ${CANONICAL_FILE}`,
      violations: [],
    }
  }

  return {
    ok: false,
    reason: `Inline page-fetch loop found — derive the page count via resolveTotalPages() from ${CANONICAL_FILE} (class API-PAGE-SIZE-CAP-001)`,
    violations,
  }
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

const collectSourceFiles = (rootDir) => {
  const files = []

  const walk = (dirPath) => {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const absolute = path.join(dirPath, entry.name)
      const relative = normalizePath(path.relative(rootDir, absolute))
      if (!relative || relative === '.') continue

      if (entry.isDirectory()) {
        if (shouldIgnoreByDir(relative)) continue
        walk(absolute)
        continue
      }

      if (!entry.isFile()) continue
      if (!shouldScanFile(relative)) continue
      files.push(relative)
    }
  }

  walk(rootDir)
  return files
}

const formatViolations = (violations) => violations.map((v) => `- ${v.file}:${v.line} -> ${v.snippet}`)

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const rootDir = process.cwd()
  const files = collectSourceFiles(rootDir)
  const sources = files.map((relativePath) => ({
    filePath: relativePath,
    content: fs.readFileSync(path.join(rootDir, relativePath), 'utf8'),
  }))

  const result = evaluateGuard({ sources })

  if (args.output === 'json') {
    process.stdout.write(`${JSON.stringify(buildJsonResult(result), null, 2)}\n`)
    if (!result.ok) process.exit(1)
    return
  }

  if (result.ok) {
    console.log(`no-inline-page-fetch-loop: passed. ${result.reason}`)
    return
  }

  console.error('no-inline-page-fetch-loop: failed.')
  console.error(`- ${result.reason}`)
  formatViolations(result.violations).forEach((line) => console.error(line))
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  OUTPUT_CONTRACT_VERSION,
  CANONICAL_FILE,
  ALLOWED_FILES,
  IGNORED_DIRS,
  SOURCE_EXTENSIONS,
  PAGE_COUNT_REGEX,
  PAGE_FETCH_MARKER_REGEX,
  parseArgs,
  shouldScanFile,
  isCommentLine,
  isPageCountExpression,
  findViolationsInSource,
  evaluateGuard,
  buildJsonResult,
}
