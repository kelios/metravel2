const fs = require('fs')
const path = require('path')

const OUTPUT_CONTRACT_VERSION = 1
const ALLOWED_FILES = new Set([
  'utils/externalLinks.ts',
])
const IGNORED_DIRS = new Set([
  '.git',
  '.expo',
  'node_modules',
  'dist',
  'coverage',
  'test-results',
  'playwright-report',
  '__tests__',
  'e2e',
])
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'])
const WINDOW_OPEN_REGEX = /\bwindow\s*\.\s*open\s*\(/g

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const parseArgs = (argv) => ({
  output: argv.includes('--json') ? 'json' : 'text',
})

const shouldIgnoreByDir = (relativePath) => {
  const parts = normalizePath(relativePath).split('/')
  return parts.some((part) => IGNORED_DIRS.has(part))
}

const shouldScanFile = (relativePath) => {
  if (!relativePath) return false
  if (shouldIgnoreByDir(relativePath)) return false
  return SOURCE_EXTENSIONS.has(path.extname(relativePath))
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

const findViolationsInSource = ({ filePath, content }) => {
  const normalizedPath = normalizePath(filePath)
  if (ALLOWED_FILES.has(normalizedPath)) return []

  const lines = String(content || '').split('\n')
  const violations = []
  lines.forEach((line, idx) => {
    if (WINDOW_OPEN_REGEX.test(line)) {
      violations.push({
        file: normalizedPath,
        line: idx + 1,
        snippet: line.trim(),
      })
    }
    WINDOW_OPEN_REGEX.lastIndex = 0
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
      reason: 'No direct window.open usage outside approved allowlist files',
      violations: [],
    }
  }

  return {
    ok: false,
    reason: 'Direct window.open usage found outside approved allowlist files',
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
    console.log(`no-direct-window-open: passed. ${result.reason}`)
    return
  }

  console.error('no-direct-window-open: failed.')
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
  WINDOW_OPEN_REGEX,
  parseArgs,
  shouldScanFile,
  findViolationsInSource,
  evaluateGuard,
  buildJsonResult,
}
