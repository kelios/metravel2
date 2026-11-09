const fs = require('fs')
const path = require('path')

// #3202: хранимый XSS в теле статьи появился из-за правки атрибутов регулярками
// по строке тега ПОСЛЕ санитайзера и стока, который принимал любую строку.
//
// Правило 1 (стоки): в components/** и app/** `dangerouslySetInnerHTML` получает
// значение только из `inertMarkup()` (`utils/inertHtml.ts`), а он принимает только
// результат `toInertHtml()`. Литерал `__html` в таком файле запрещён — иначе
// строку можно отдать в сток в обход рубежа. Исключения перечислены поимённо.
//
// Правило 2 (правки атрибутов): в модулях, которые переписывают теги тела статьи,
// регулярное выражение не ищет `имя=` атрибута в строке тега. Чтение и правка
// атрибутов — через `utils/htmlTokens.ts`.

const OUTPUT_CONTRACT_VERSION = 1

const SINK_SCAN_ROOTS = ['components/', 'app/']
const SINK_ALLOWLIST = new Map([
  [
    'app/+html.tsx',
    'Статический HTML-шаблон: inline boot-скрипты, critical CSS и JSON-LD из первопартийных строк; rich-text сюда не попадает.',
  ],
])

const ATTRIBUTE_REWRITE_FILES = [
  'components/travel/stableContent/htmlTransform.ts',
  'components/travel/stableContent/richImageFrames.ts',
  'utils/richTextImageLayout.ts',
  'utils/serverSafeHtml.ts',
]
const ATTRIBUTE_NAMES = [
  'src', 'srcset', 'sizes', 'class', 'style', 'width', 'height', 'alt', 'id', 'href', 'title',
  'loading', 'decoding', 'fetchpriority', 'data-aspect-fallback',
]
// Имя атрибута (не хвост другого слова) и `=` — допускаются `\s*`/`\s+` между ними.
const ATTRIBUTE_ASSIGNMENT_IN_REGEX = new RegExp(
  `(?:^|[^A-Za-z0-9_-])(?:${ATTRIBUTE_NAMES.join('|')})(?:\\\\s[*+?]?)*=`,
  'i',
)

const IGNORED_DIRS = new Set(['node_modules', '__tests__', 'dist', '.expo', 'coverage'])
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx'])

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const parseArgs = (argv) => ({ output: argv.includes('--json') ? 'json' : 'text' })

const REGEX_PRECEDING_CHARS = new Set('(,=:[!&|?{};+-*%<>~^'.split(''))
const REGEX_PRECEDING_WORDS = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw'])

/**
 * Минимальный лексер JS/TS: код без комментариев (строки сохраняются, переводы
 * строк тоже — номера строк не сдвигаются) и список литералов регулярных выражений.
 */
const lexSource = (source) => {
  const text = String(source || '')
  let code = ''
  const regexes = []
  let line = 1
  let prev = ''
  let i = 0
  const keepNewlines = (chunk) => chunk.replace(/[^\n]/g, ' ')
  const countLines = (chunk) => (chunk.match(/\n/g) || []).length

  while (i < text.length) {
    const c = text[i]
    const next = text[i + 1]
    if (c === '/' && next === '/') {
      const end = text.indexOf('\n', i)
      const stop = end === -1 ? text.length : end
      code += keepNewlines(text.slice(i, stop))
      i = stop
      continue
    }
    if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2)
      const stop = end === -1 ? text.length : end + 2
      const chunk = text.slice(i, stop)
      code += keepNewlines(chunk)
      line += countLines(chunk)
      i = stop
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      let depth = 0
      while (j < text.length) {
        const ch = text[j]
        if (ch === '\\') { j += 2; continue }
        if (c === '`' && ch === '$' && text[j + 1] === '{') { depth += 1; j += 2; continue }
        if (c === '`' && depth > 0 && ch === '}') { depth -= 1; j += 1; continue }
        if (ch === c && depth === 0) { j += 1; break }
        if (c !== '`' && ch === '\n') break
        j += 1
      }
      const chunk = text.slice(i, j)
      code += chunk
      line += countLines(chunk)
      prev = 'string'
      i = j
      continue
    }
    if (c === '/' && (prev === '' || REGEX_PRECEDING_CHARS.has(prev) || REGEX_PRECEDING_WORDS.has(prev))) {
      let j = i + 1
      let inClass = false
      while (j < text.length && text[j] !== '\n') {
        const ch = text[j]
        if (ch === '\\') { j += 2; continue }
        if (ch === '[') inClass = true
        else if (ch === ']') inClass = false
        else if (ch === '/' && !inClass) break
        j += 1
      }
      const body = text.slice(i + 1, j)
      j += 1
      while (j < text.length && /[a-z]/i.test(text[j])) j += 1
      regexes.push({ line, body })
      code += text.slice(i, j)
      prev = 'regex'
      i = j
      continue
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1
      while (j < text.length && /[A-Za-z0-9_$]/.test(text[j])) j += 1
      prev = text.slice(i, j)
      code += prev
      i = j
      continue
    }
    if (c === '\n') line += 1
    if (!/\s/.test(c)) prev = c
    code += c
    i += 1
  }
  return { code, regexes }
}

const findSinkViolations = ({ filePath, content }) => {
  const normalizedPath = normalizePath(filePath)
  if (!SINK_SCAN_ROOTS.some((root) => normalizedPath.startsWith(root))) return []
  if (SINK_ALLOWLIST.has(normalizedPath)) return []
  const { code } = lexSource(content)
  if (!code.includes('dangerouslySetInnerHTML')) return []

  const lines = code.split('\n')
  const usesInertMarkup = /\binertMarkup\s*\(/.test(code)
  const violations = []
  lines.forEach((text, index) => {
    if (/\b__html\b/.test(text)) {
      violations.push({
        file: normalizedPath,
        line: index + 1,
        rule: 'sink',
        snippet: text.trim(),
        reason: 'литерал __html: значение стока строится только через inertMarkup(toInertHtml(...))',
      })
    } else if (/\bdangerouslySetInnerHTML\b/.test(text) && !usesInertMarkup) {
      violations.push({
        file: normalizedPath,
        line: index + 1,
        rule: 'sink',
        snippet: text.trim(),
        reason: 'dangerouslySetInnerHTML без inertMarkup() из utils/inertHtml.ts',
      })
    }
  })
  return violations
}

const findAttributeRewriteViolations = ({ filePath, content }) => {
  const normalizedPath = normalizePath(filePath)
  if (!ATTRIBUTE_REWRITE_FILES.includes(normalizedPath)) return []
  return lexSource(content).regexes
    .filter(({ body }) => ATTRIBUTE_ASSIGNMENT_IN_REGEX.test(body.replace(/\\b/g, ' ')))
    .map(({ line, body }) => ({
      file: normalizedPath,
      line,
      rule: 'attribute-regex',
      snippet: `/${body}/`,
      reason: 'атрибут ищется регуляркой по строке тега; читать и править — через utils/htmlTokens.ts',
    }))
}

const evaluateGuard = ({ sources = [] } = {}) => {
  const violations = []
  for (const source of sources) {
    violations.push(...findSinkViolations(source), ...findAttributeRewriteViolations(source))
  }
  return violations.length === 0
    ? { ok: true, reason: 'Rich-text sinks go through inertMarkup(); no attribute regexes in tag rewriters', violations }
    : { ok: false, reason: 'Rich-text sink or attribute-regex violations found', violations }
}

const shouldScanFile = (relativePath) => {
  const normalized = normalizePath(relativePath)
  if (!SOURCE_EXTENSIONS.has(path.extname(normalized))) return false
  if (normalized.split('/').some((part) => IGNORED_DIRS.has(part))) return false
  return SINK_SCAN_ROOTS.some((root) => normalized.startsWith(root)) || ATTRIBUTE_REWRITE_FILES.includes(normalized)
}

const collectSourceFiles = (rootDir) => {
  const files = [...ATTRIBUTE_REWRITE_FILES.filter((file) => fs.existsSync(path.join(rootDir, file)))]
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(rootDir, dir), { withFileTypes: true })) {
      const relative = normalizePath(path.join(dir, entry.name))
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) walk(relative)
      } else if (entry.isFile() && shouldScanFile(relative) && !files.includes(relative)) {
        files.push(relative)
      }
    }
  }
  for (const root of SINK_SCAN_ROOTS) {
    if (fs.existsSync(path.join(rootDir, root))) walk(root.replace(/\/$/, ''))
  }
  return files
}

const buildJsonResult = (result) => ({
  contractVersion: OUTPUT_CONTRACT_VERSION,
  ok: Boolean(result?.ok),
  reason: String(result?.reason || ''),
  violations: result?.violations ?? [],
  violationCount: (result?.violations ?? []).length,
})

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const rootDir = process.cwd()
  const sources = collectSourceFiles(rootDir).map((filePath) => ({
    filePath,
    content: fs.readFileSync(path.join(rootDir, filePath), 'utf8'),
  }))
  const result = evaluateGuard({ sources })

  if (args.output === 'json') {
    process.stdout.write(`${JSON.stringify(buildJsonResult(result), null, 2)}\n`)
    if (!result.ok) process.exit(1)
    return
  }
  if (result.ok) {
    console.log(`rich-text-sinks: passed. ${result.reason} (${sources.length} files)`)
    return
  }
  console.error('rich-text-sinks: failed.')
  for (const v of result.violations) console.error(`- ${v.file}:${v.line} [${v.rule}] ${v.reason}\n    ${v.snippet}`)
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  OUTPUT_CONTRACT_VERSION,
  SINK_ALLOWLIST,
  ATTRIBUTE_REWRITE_FILES,
  ATTRIBUTE_ASSIGNMENT_IN_REGEX,
  parseArgs,
  lexSource,
  shouldScanFile,
  findSinkViolations,
  findAttributeRewriteViolations,
  evaluateGuard,
  buildJsonResult,
}
