const fs = require('fs')
const path = require('path')

// Guard #1276: оценка ответа в квесте живёт ровно в одном месте.
// Прямой `step.answer(...)` во вью — это ровно та дыра, из-за которой попытки
// игрока нигде не сохранялись: карточка шага сама проверяла ответ и выбрасывала
// ввод, а телеметрия не имела точки съёма. Проверка ответа разрешена только в
// `utils/questAnswerEvaluation.ts` (единая точка оценки) и в
// `utils/questAdapters.ts` (сборка самого чекера).

const OUTPUT_CONTRACT_VERSION = 1

const ALLOWED_FILES = new Set([
  'utils/questAnswerEvaluation.ts',
  'utils/questAdapters.ts',
])

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
  'web-build',
  'coverage',
  'test-results',
  'playwright-report',
  '__tests__',
  'e2e',
])

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'])

// Вызов чекера ответа: `.answer(`, `.answer (`. Чтение свойств (`.answerType`,
// `.answerDisplay`, `.answer._isAny`) нарушением не является.
const DIRECT_ANSWER_CALL_REGEX = /\.answer\s*\(/

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

// Пояснения про запрет в комментариях (в т.ч. в этом guard) — не нарушение.
const isCommentLine = (line) => {
  const trimmed = String(line || '').trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
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
    if (isCommentLine(line)) return
    if (DIRECT_ANSWER_CALL_REGEX.test(line)) {
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
      reason: 'Quest answers are checked only through utils/questAnswerEvaluation',
      violations: [],
    }
  }

  return {
    ok: false,
    reason:
      'Direct quest answer check found outside the evaluation module — call evaluateQuestAnswer() from utils/questAnswerEvaluation instead',
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
    console.log(`quest-answer-eval: passed. ${result.reason}`)
    return
  }

  console.error('quest-answer-eval: failed.')
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
  DIRECT_ANSWER_CALL_REGEX,
  parseArgs,
  shouldScanFile,
  isCommentLine,
  findViolationsInSource,
  evaluateGuard,
  buildJsonResult,
}
