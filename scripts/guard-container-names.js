const fs = require('fs')
const path = require('path')

// Guard #1636 (борд #733 — первый рецидив): запрещает вписанные вручную имена
// docker-контейнеров прода в исполняемых командах.
//
// Имя контейнера — не константа, а производная от версии compose и имени
// проекта: v1 склеивал `<project>_<service>_<index>`, v2 — через дефисы. На
// metravel.by эти схемы уже менялись местами и живут на хосте одновременно
// (app/nginx переезжали, база и redis — нет). Каждое вписанное вручную имя
// ломается при следующем пересоздании, и ломается по-разному: часть
// инструментов падала громко, а детектор мёртвых ссылок печатал «всё хорошо» с
// кодом 0, не прочитав ни строчки лога.
//
// Резолв живёт в одном месте — `metravel_container_remote_snippet` и
// `metravel_resolve_container_over_ssh` в scripts/deploy-target.sh.
//
// Что НЕ является нарушением и почему:
//   * строки-комментарии — там имена объясняют историю поломки;
//   * проза и таблицы в Markdown — это описание состояния, а не команда;
//   * блоки ``` без языка — сохранённые транскрипты и вывод логов.
// Проверяются только исполняемые строки: код в .sh/.js/.py и содержимое
// ```bash / ```sh блоков в документации. Инструкции агентов и скиллов тоже в
// периметре: они содержат исполняемые прод-команды, и седьмая копия жила там.

const OUTPUT_CONTRACT_VERSION = 1

// `.claude` целиком брать НЕЛЬЗЯ: `.claude/worktrees/` в .gitignore, там лежат
// checkout'ы параллельных сессий, и гард краснел бы на корректном main из-за
// чужих untracked-файлов, которые правкой этого репозитория не чинятся.
// Перечисляем ровно те подкаталоги, где живут исполняемые прод-команды.
const SCAN_ROOTS = [
  'scripts',
  'docs',
  '.claude/agents',
  '.claude/skills',
  '.claude/commands',
  '.claude/hooks',
]
const SCAN_ROOT_FILES = ['build-prod.sh']

// `worktrees` — вторая линия обороны к сужению SCAN_ROOTS выше: даже если
// периметр однажды снова расширят, чужой checkout в него не попадёт.
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  '__snapshots__',
  'worktrees',
])

const SOURCE_EXTENSIONS = new Set(['.sh', '.bash', '.js', '.cjs', '.mjs', '.py'])
const DOC_EXTENSIONS = new Set(['.md'])

// Сервисы compose. Внутренние дефисы имени сервиса схема не трогает — меняется
// только разделитель между project/service/index, поэтому в шаблоне ниже
// экранируется именно он.
const SERVICES = ['app', 'nginx', 'metravel-gis', 'redis', 'redis-images']

// Литеральное имя = разделители УЖЕ выбраны (`_` или `-`). Запись через класс
// `[-_]`, то есть сам резолв, нарушением не является.
const HARDCODED_NAME_REGEX = new RegExp(
  `metravel[-_](?:${SERVICES.join('|')})[-_]1\\b`,
  'i',
)

const RESOLVER_PATTERN_HINT = '[-_]'

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const parseArgs = (argv) => ({
  output: argv.includes('--json') ? 'json' : 'text',
})

// Комментарий в shell/python (`#`), js (`//`, `*`, `/*`). Строка, состоящая
// целиком из пояснения, нарушением не считается.
const isCommentLine = (line) => {
  const trimmed = String(line || '').trim()
  return (
    trimmed.startsWith('#') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*')
  )
}

// Строка описывает сам резолв (`metravel[-_]app[-_]1`), а не вписанное имя.
const isResolverLine = (line) => String(line || '').includes(RESOLVER_PATTERN_HINT)

const findViolationsInSource = ({ filePath, content }) => {
  const violations = []
  String(content || '')
    .split('\n')
    .forEach((line, idx) => {
      if (isCommentLine(line)) return
      if (isResolverLine(line)) return
      if (!HARDCODED_NAME_REGEX.test(line)) return
      violations.push({ file: normalizePath(filePath), line: idx + 1, snippet: line.trim() })
    })
  return violations
}

// В документации исполняемым считается только содержимое ```bash / ```sh.
// Проза, таблицы и блоки без языка (транскрипты, вывод логов) — описание.
const findViolationsInDoc = ({ filePath, content }) => {
  const violations = []
  let inShellFence = false
  String(content || '')
    .split('\n')
    .forEach((line, idx) => {
      const fence = /^\s*```(\S*)/.exec(line)
      if (fence) {
        const lang = String(fence[1] || '').toLowerCase()
        inShellFence = inShellFence ? false : lang === 'bash' || lang === 'sh' || lang === 'shell'
        return
      }
      if (!inShellFence) return
      if (isCommentLine(line)) return
      if (isResolverLine(line)) return
      if (!HARDCODED_NAME_REGEX.test(line)) return
      violations.push({ file: normalizePath(filePath), line: idx + 1, snippet: line.trim() })
    })
  return violations
}

const collectFiles = (rootDir) => {
  const files = []

  const walk = (absoluteDir) => {
    let entries
    try {
      entries = fs.readdirSync(absoluteDir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const absolute = path.join(absoluteDir, entry.name)
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue
        walk(absolute)
        continue
      }
      if (!entry.isFile()) continue
      const ext = path.extname(entry.name)
      if (!SOURCE_EXTENSIONS.has(ext) && !DOC_EXTENSIONS.has(ext)) continue
      files.push(normalizePath(path.relative(rootDir, absolute)))
    }
  }

  for (const dir of SCAN_ROOTS) walk(path.join(rootDir, dir))
  for (const file of SCAN_ROOT_FILES) {
    if (fs.existsSync(path.join(rootDir, file))) files.push(file)
  }
  return files
}

const evaluateGuard = ({ sources = [], docs = [] } = {}) => {
  const violations = []
  for (const source of sources) violations.push(...findViolationsInSource(source))
  for (const doc of docs) violations.push(...findViolationsInDoc(doc))

  if (violations.length === 0) {
    return {
      ok: true,
      reason: 'Имена docker-контейнеров нигде не вписаны вручную в исполняемых командах',
      violations: [],
    }
  }

  return {
    ok: false,
    reason:
      'Вписанное вручную имя docker-контейнера: возьми его из metravel_resolve_container / metravel_resolve_container_over_ssh (scripts/deploy-target.sh)',
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

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const rootDir = process.cwd()
  const files = collectFiles(rootDir)

  const sources = []
  const docs = []
  for (const relativePath of files) {
    const content = fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
    const bucket = DOC_EXTENSIONS.has(path.extname(relativePath)) ? docs : sources
    bucket.push({ filePath: relativePath, content })
  }

  const result = evaluateGuard({ sources, docs })

  if (args.output === 'json') {
    process.stdout.write(`${JSON.stringify(buildJsonResult(result), null, 2)}\n`)
    if (!result.ok) process.exit(1)
    return
  }

  if (result.ok) {
    console.log(`container-names: passed. ${result.reason}`)
    return
  }

  console.error('container-names: failed.')
  console.error(`- ${result.reason}`)
  result.violations.forEach((v) => console.error(`- ${v.file}:${v.line} -> ${v.snippet}`))
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  OUTPUT_CONTRACT_VERSION,
  SERVICES,
  HARDCODED_NAME_REGEX,
  SCAN_ROOTS,
  SCAN_ROOT_FILES,
  IGNORED_DIRS,
  parseArgs,
  isCommentLine,
  isResolverLine,
  findViolationsInSource,
  findViolationsInDoc,
  evaluateGuard,
  buildJsonResult,
}
