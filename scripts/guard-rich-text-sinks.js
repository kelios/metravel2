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
//
// #3262: правило 1 проверяет каждое вхождение `dangerouslySetInnerHTML` (значение —
// вызов `inertMarkup(...)` или переменная, объявленная таким вызовом), а не файл
// целиком. Правило 3 (DOM-стоки): `.innerHTML =`/`.outerHTML =` принимают только
// пустую строку или `toInertHtml(...)`; `insertAdjacentHTML` и `document.write`
// запрещены. Исключения — поимённо с причиной.
//
// #3203: правило 4 (данные в тексте <script>): в сборщиках HTML для WebView и
// печатных документов (в коде есть `ReactNativeWebView`, `<!DOCTYPE html>` или вызов
// `buildLeafletWebViewHtml`) `JSON.stringify` на стороне TS запрещён — только
// `serializeForInlineScript` (`utils/webViewBridge.ts`), иначе `</script>` в данных
// закрывает скрипт. `JSON.stringify` в тексте шаблона исполняется внутри WebView
// и правилом не считается.

const OUTPUT_CONTRACT_VERSION = 1

const SINK_SCAN_ROOTS = ['components/', 'app/', 'utils/', 'hooks/']
const SINK_ALLOWLIST = new Map([
  [
    'app/+html.tsx',
    'Статический HTML-шаблон: inline boot-скрипты, critical CSS и JSON-LD из первопартийных строк; rich-text сюда не попадает.',
  ],
  [
    'utils/inertHtml.ts',
    'Определение рубежа: inertMarkup() — единственное место, где строится { __html }, и принимает только InertHtml.',
  ],
])
const DOM_SINK_ALLOWLIST = new Map([
  [
    'components/MapPage/Map/useMapPlaceRequestMarkers.web.ts',
    'innerHTML получает только константу PIN_ART (первопартийный SVG); названия мест и цвета ставятся через DOM-свойства.',
  ],
  [
    'utils/openBookPreviewWindow.ts',
    'document.write пишет целый печатный документ книги/плана со своими скриптами; rich-text в нём уже прошёл toInertHtml (TravelDataTransformer, #3262) и пересборку ContentParser, заглушка — из строк перевода.',
  ],
  [
    'utils/printHtml.web.ts',
    'Тот же печатный документ, что в openBookPreviewWindow, — печать в текущей вкладке; rich-text внутри уже прошёл toInertHtml.',
  ],
])
const INLINE_SCRIPT_SIGNAL = /ReactNativeWebView|<!DOCTYPE html|\bbuildLeafletWebViewHtml\s*\(/i

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
 * Минимальный лексер JS/TS. `code` — исходник без комментариев (строки сохранены),
 * `bare` — ещё и без текста строк и шаблонов (выражения `${...}` и литералы регулярных
 * выражений сохранены), переводы
 * строк остаются — номера строк не сдвигаются; `regexes` — литералы регулярных выражений.
 */
const lexSource = (source) => {
  const text = String(source || '')
  let code = ''
  let bare = ''
  const regexes = []
  let line = 1
  let prev = ''
  let i = 0
  // Открытые `{`: 'tpl' — подстановка `${` в шаблоне, 'block' — обычная скобка.
  const braces = []
  const blank = (chunk) => chunk.replace(/[^\n]/g, ' ')
  const countLines = (chunk) => (chunk.match(/\n/g) || []).length
  const emit = (chunk, bareChunk = chunk) => {
    code += chunk
    bare += bareChunk
    line += countLines(chunk)
  }
  const emitComment = (chunk) => {
    const blanked = blank(chunk)
    code += blanked
    bare += blanked
    line += countLines(chunk)
  }
  // Текст шаблона от `start` до закрывающей `\`` или до `${`; возвращает индекс после них.
  const scanTemplateText = (start) => {
    let j = start
    while (j < text.length) {
      const ch = text[j]
      if (ch === '\\') { j += 2; continue }
      if (ch === '`') {
        emit(text.slice(start, j + 1), `${blank(text.slice(start, j))}\``)
        prev = 'string'
        return j + 1
      }
      if (ch === '$' && text[j + 1] === '{') {
        emit(text.slice(start, j + 2), `${blank(text.slice(start, j))}\${`)
        braces.push('tpl')
        prev = '{'
        return j + 2
      }
      j += 1
    }
    emit(text.slice(start), blank(text.slice(start)))
    return text.length
  }

  while (i < text.length) {
    const c = text[i]
    const next = text[i + 1]
    if (c === '/' && next === '/') {
      const end = text.indexOf('\n', i)
      const stop = end === -1 ? text.length : end
      emitComment(text.slice(i, stop))
      i = stop
      continue
    }
    if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2)
      const stop = end === -1 ? text.length : end + 2
      emitComment(text.slice(i, stop))
      i = stop
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < text.length) {
        const ch = text[j]
        if (ch === '\\') { j += 2; continue }
        if (ch === c) { j += 1; break }
        if (ch === '\n') break
        j += 1
      }
      const chunk = text.slice(i, j)
      const closed = chunk.length > 1 && chunk.endsWith(c)
      emit(chunk, closed ? `${c}${blank(chunk.slice(1, -1))}${c}` : `${c}${blank(chunk.slice(1))}`)
      prev = 'string'
      i = j
      continue
    }
    if (c === '`') {
      emit('`')
      i = scanTemplateText(i + 1)
      continue
    }
    if (c === '}' && braces[braces.length - 1] === 'tpl') {
      braces.pop()
      emit('}')
      i = scanTemplateText(i + 1)
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
      // Незакрытый до конца строки — не литерал (JSX `/>`, деление): обычный символ.
      if (text[j] !== '/') {
        prev = c
        emit(c)
        i += 1
        continue
      }
      const body = text.slice(i + 1, j)
      j += 1
      while (j < text.length && /[a-z]/i.test(text[j])) j += 1
      regexes.push({ line, body })
      // Текст литерала в `bare` не гасится: лексер без разбора JSX принимает за
      // литерал и `</b>…<div dangerouslySetInnerHTML=… /` в одной строке — сток пропал бы.
      emit(text.slice(i, j))
      prev = 'regex'
      i = j
      continue
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1
      while (j < text.length && /[A-Za-z0-9_$]/.test(text[j])) j += 1
      prev = text.slice(i, j)
      emit(prev)
      i = j
      continue
    }
    if (c === '{') braces.push('block')
    else if (c === '}') braces.pop()
    if (!/\s/.test(c)) prev = c
    emit(c)
    i += 1
  }
  return { code, bare, regexes }
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length

/** Выражение внутри `{...}`, начиная с открывающей скобки по индексу `open` (текст строк уже пуст). */
const readBracedExpression = (bare, open) => {
  let depth = 0
  for (let j = open; j < bare.length; j += 1) {
    if (bare[j] === '{') depth += 1
    else if (bare[j] === '}') {
      depth -= 1
      if (depth === 0) return bare.slice(open + 1, j)
    }
  }
  return bare.slice(open + 1)
}

const isInertMarkupValue = (expression, bare) => {
  const value = expression.trim()
  if (/^inertMarkup\s*\(/.test(value)) return true
  if (!/^[A-Za-z_$][\w$]*$/.test(value)) return false
  const declaration = new RegExp(
    `\\b(?:const|let|var)\\s+${value.replace(/\$/g, '\\$')}\\s*=\\s*(?:useMemo\\s*\\(\\s*\\(\\s*\\)\\s*=>\\s*)?inertMarkup\\s*\\(`,
  )
  return declaration.test(bare)
}

const findSinkViolations = ({ filePath, content }) => {
  const normalizedPath = normalizePath(filePath)
  if (!SINK_SCAN_ROOTS.some((root) => normalizedPath.startsWith(root))) return []
  if (SINK_ALLOWLIST.has(normalizedPath)) return []
  const { bare } = lexSource(content)
  if (!bare.includes('dangerouslySetInnerHTML') && !/\b__html\b/.test(bare)) return []

  const lines = bare.split('\n')
  const violations = []
  lines.forEach((text, index) => {
    if (/\b__html\b/.test(text)) {
      violations.push({
        file: normalizedPath,
        line: index + 1,
        rule: 'sink',
        snippet: String(content).split('\n')[index].trim(),
        reason: 'литерал __html: значение стока строится только через inertMarkup(toInertHtml(...))',
      })
    }
  })
  const sinkRe = /\bdangerouslySetInnerHTML\b/g
  let match
  while ((match = sinkRe.exec(bare))) {
    const after = bare.slice(match.index + match[0].length)
    const assign = /^\s*=\s*\{/.exec(after)
    const expression = assign ? readBracedExpression(bare, match.index + match[0].length + assign[0].length - 1) : ''
    if (assign && isInertMarkupValue(expression, bare)) continue
    const line = lineOf(bare, match.index)
    if (violations.some((v) => v.line === line)) continue
    violations.push({
      file: normalizedPath,
      line,
      rule: 'sink',
      snippet: String(content).split('\n')[line - 1].trim(),
      reason: 'dangerouslySetInnerHTML: значение — только inertMarkup(...) из utils/inertHtml.ts (или переменная, объявленная этим вызовом)',
    })
  }
  return violations.sort((a, b) => a.line - b.line)
}

const DOM_HTML_ASSIGNMENT_RE = /\.(?:inner|outer)HTML\s*(\+?=)(?!=)\s*/g
const DOM_HTML_CALL_RES = [
  { re: /\binsertAdjacentHTML\s*\(/g, label: 'insertAdjacentHTML' },
  { re: /\b\w*[dD]oc(?:ument)?\s*\.\s*write(?:ln)?\s*\(/g, label: 'document.write' },
]

const findDomSinkViolations = ({ filePath, content }) => {
  const normalizedPath = normalizePath(filePath)
  if (!SINK_SCAN_ROOTS.some((root) => normalizedPath.startsWith(root))) return []
  if (DOM_SINK_ALLOWLIST.has(normalizedPath)) return []
  const { bare } = lexSource(content)
  const sourceLines = String(content).split('\n')
  const violations = []
  const report = (index, reason) => {
    const line = lineOf(bare, index)
    violations.push({ file: normalizedPath, line, rule: 'dom-sink', snippet: sourceLines[line - 1].trim(), reason })
  }
  let match
  DOM_HTML_ASSIGNMENT_RE.lastIndex = 0
  while ((match = DOM_HTML_ASSIGNMENT_RE.exec(bare))) {
    const value = bare.slice(match.index + match[0].length)
    const clears = match[1] === '=' && /^(?:''|""|``)(?![\w$.([])/.test(value)
    const inert = match[1] === '=' && /^toInertHtml\s*\(/.test(value)
    if (!clears && !inert) report(match.index, 'innerHTML/outerHTML: только пустая строка или toInertHtml(...) из utils/inertHtml.ts')
  }
  for (const { re, label } of DOM_HTML_CALL_RES) {
    re.lastIndex = 0
    while ((match = re.exec(bare))) {
      report(match.index, `${label}: HTML в документ — только через DOM-узлы или toInertHtml; исключение — в DOM_SINK_ALLOWLIST с причиной`)
    }
  }
  return violations.sort((a, b) => a.line - b.line)
}

const findInlineScriptViolations = ({ filePath, content }) => {
  const normalizedPath = normalizePath(filePath)
  if (!SINK_SCAN_ROOTS.some((root) => normalizedPath.startsWith(root))) return []
  if (SINK_ALLOWLIST.has(normalizedPath)) return []
  const { code, bare } = lexSource(content)
  if (!INLINE_SCRIPT_SIGNAL.test(code)) return []
  const sourceLines = String(content).split('\n')
  const violations = []
  const re = /\bJSON\s*\.\s*stringify\s*\(/g
  let match
  while ((match = re.exec(bare))) {
    const line = lineOf(bare, match.index)
    violations.push({
      file: normalizedPath,
      line,
      rule: 'inline-script',
      snippet: sourceLines[line - 1].trim(),
      reason: 'данные в текст <script> — только serializeForInlineScript (utils/webViewBridge.ts): JSON.stringify не экранирует </script>',
    })
  }
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
    violations.push(
      ...findSinkViolations(source),
      ...findDomSinkViolations(source),
      ...findInlineScriptViolations(source),
      ...findAttributeRewriteViolations(source),
    )
  }
  return violations.length === 0
    ? {
      ok: true,
      reason: 'HTML sinks go through inertMarkup()/toInertHtml(); inline-script data via serializeForInlineScript(); no attribute regexes in tag rewriters',
      violations,
    }
    : { ok: false, reason: 'HTML sink, inline-script or attribute-regex violations found', violations }
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
  SINK_SCAN_ROOTS,
  SINK_ALLOWLIST,
  DOM_SINK_ALLOWLIST,
  ATTRIBUTE_REWRITE_FILES,
  ATTRIBUTE_ASSIGNMENT_IN_REGEX,
  parseArgs,
  lexSource,
  shouldScanFile,
  findSinkViolations,
  findDomSinkViolations,
  findInlineScriptViolations,
  findAttributeRewriteViolations,
  evaluateGuard,
  buildJsonResult,
}
