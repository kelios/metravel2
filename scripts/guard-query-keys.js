// scripts/guard-query-keys.js
// Гвард: запрещает инлайновые строковые литералы React Query ключей вне
// единого источника api/queryKeys.ts. Ключи-переменные (queryKey: [someVar])
// разрешены. Точечное исключение — комментарий `query-keys-allow-literal`
// на той же строке.

const fs = require('fs')
const path = require('path')

const OUTPUT_CONTRACT_VERSION = 1

// Единственный файл, где литералы ключей легитимны.
const ALLOWED_FILES = new Set(['api/queryKeys.ts'])

// Сканируем только слои с серверным стейтом.
const SCAN_DIRS = ['api', 'hooks', 'components', 'app']

const IGNORED_DIRS = new Set([
  '.git',
  '.expo',
  '.prod-build-tmp',
  '.tmp',
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
])
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])

const ALLOW_LITERAL_COMMENT = 'query-keys-allow-literal'

// `queryKey: ['literal'...]` — первый элемент массива является строковым литералом.
const QUERY_KEY_OPTION_REGEX = /queryKey\s*:\s*\[\s*['"`]/
// Позиционный массив-литерал в кэш-методах: invalidateQueries(['literal'...]) и т.п.
const CACHE_METHOD_REGEX =
  /\.(setQueryData|setQueriesData|invalidateQueries|cancelQueries|getQueryData|removeQueries)\(\s*\[\s*['"`]/

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

const collectSourceFiles = (rootDir) => {
  const files = []

  const walk = (dirPath) => {
    if (!fs.existsSync(dirPath)) return
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

  for (const dir of SCAN_DIRS) walk(path.join(rootDir, dir))
  return files
}

const findViolationsInSource = ({ filePath, content }) => {
  const normalizedPath = normalizePath(filePath)
  if (ALLOWED_FILES.has(normalizedPath)) return []

  const lines = String(content || '').split('\n')
  const violations = []
  lines.forEach((line, idx) => {
    if (line.includes(ALLOW_LITERAL_COMMENT)) return
    if (QUERY_KEY_OPTION_REGEX.test(line) || CACHE_METHOD_REGEX.test(line)) {
      violations.push({
        file: normalizedPath,
        line: idx + 1,
        snippet: line.trim(),
      })
    }
  })
  return violations
}

const evaluateGuard = ({ sources = [] } = {}) => {
  const violations = []
  for (const source of sources) {
    violations.push(...findViolationsInSource(source))
  }

  if (violations.length === 0) {
    return {
      ok: true,
      reason: 'All React Query keys go through api/queryKeys.ts',
      violations: [],
    }
  }

  return {
    ok: false,
    reason:
      'Inline string-literal query keys found. Add a factory to api/queryKeys.ts and use it instead.',
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
    console.log(`query-keys: passed. ${result.reason}`)
    return
  }

  console.error('query-keys: failed.')
  console.error(`- ${result.reason}`)
  formatViolations(result.violations).forEach((line) => console.error(line))
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  OUTPUT_CONTRACT_VERSION,
  ALLOWED_FILES,
  IGNORED_DIRS,
  SOURCE_EXTENSIONS,
  QUERY_KEY_OPTION_REGEX,
  CACHE_METHOD_REGEX,
  parseArgs,
  shouldScanFile,
  findViolationsInSource,
  evaluateGuard,
  buildJsonResult,
}
