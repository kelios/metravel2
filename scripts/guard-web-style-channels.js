'use strict'

const fs = require('fs')
const path = require('path')
const ts = require('typescript')

/**
 * Гейт каналов web-стилизации (#2032, класс RNW-RAW-DATA-ATTRIBUTE-DROPPED; #2036,
 * класс RNW-STYLESHEET-PSEUDO-CLASS-DEAD).
 *
 * Три способа написать стиль, который в исходнике выглядит живым, а до страницы
 * не доходит никогда — ни тесты, ни типы этого не видят:
 *
 *   1. Сырой `data-*` проп на компоненте react-native-web (`View`, `Pressable`,
 *      `Text` и их обёртки). RNW переносит в DOM только allowlist пропов
 *      (`react-native-web/dist/modules/forwardedProps`), `data-*` в нём нет:
 *      атрибут молча пропадает, а CSS-селектор, `closest()` и e2e-локатор по нему
 *      не находят ничего. Канал один — `dataSet={{ fooBar: 'x' }}` →
 *      `data-foo-bar="x"`. Юнит-тест на react-test-renderer читает проп и
 *      проходит, потому что до DOM дело не доходит. Третий случай подряд:
 *      #1642, #2024, #2032.
 *   2. Таблица стилей, подключённая не из корневого layout. Web-экспорт Expo
 *      выпускает `app/global.css` (`app/_layout.tsx`); CSS из модуля за
 *      `import()`-границей в `dist` не попадает вовсе — так прожили hover-стили
 *      сайдбара деталей путешествия и виджета погоды (#2032).
 *   3. Ключ-псевдокласс в объекте стиля (`':hover'`, `'&:hover'`, `':focus'`,
 *      `':active'`, `'::before'` …). React Native StyleSheet псевдоклассов не
 *      знает, а react-native-web 0.21 компилирует ключ как CSS-свойство:
 *      `.r-:hover-…{:hover:[object Object];}` — правило, которое браузер
 *      отбрасывает. Тест на react-test-renderer видит объект стиля, `as any` глушит
 *      типы. Сорок ключей в 21 файле не работали ни дня (#2036). Канал отклика —
 *      состояние `hovered`/`pressed`/`focused` у `Pressable` или правило на маркере
 *      `dataSet` в `app/global.css` под `@media (hover: hover) and (pointer: fine)`.
 *
 * Правила:
 *   - `raw-data-attribute` — литеральный `data-…` (JSX-атрибут или ключ объекта,
 *     уходящего в JSX-спред или `createElement`) на чём угодно, кроме
 *     DOM-элемента: тег со строчной буквы (`<div>`), `createElement('div', …)`
 *     или тег из переменной со строчной буквы. Объект, путь которого до элемента
 *     гейт не прослеживает (константа, возврат из функции, `Platform.select`),
 *     тоже нарушение: доказать DOM-адресата нечем, а `dataSet` ничего не стоит;
 *   - `data-key-in-dataset` — `data-…` внутри `dataSet`: RNW допишет второй
 *     префикс, и выйдет `data-data-…`;
 *   - `stylesheet-import` — `import`, `require` или `import()` файла `.css` где
 *     угодно, кроме `ROOT_STYLESHEET`; новый web-CSS пишется в `app/global.css`;
 *   - `root-stylesheet-missing` — и сам этот импорт на месте;
 *   - `pseudo-class-style-key` — ключ объектного литерала (или поле типа), имя
 *     которого начинается с псевдокласса/псевдоэлемента: `:x`, `::x`, `&:x`.
 *     Проверяется любой литерал, а не только аргумент `StyleSheet.create`: ключ
 *     живёт и в фабриках стилей, и в `Platform.select`, и в пропах-спредах;
 *   - `debt-count` / `stale-entry` — места, жившие в дереве до правила, перечислены
 *     в `KNOWN_RAW_DATA_ATTRIBUTE_DEBT` и `KNOWN_PSEUDO_CLASS_STYLE_KEY_DEBT` с
 *     точным числом. Число только убывает: новое место в файле из списка красит
 *     гейт так же, как в новом файле, а починка обязана снять или уменьшить запись.
 */
const OUTPUT_CONTRACT_VERSION = 1

const ROOT_STYLESHEET = Object.freeze({ file: 'app/_layout.tsx', specifier: './global.css' })

// Долг до гейта: файл → число мест `raw-data-attribute`. Сорок мест в 29 файлах
// разобраны в #2035: маркер с читателем переведён на `dataSet` (`data-testid` — на
// `testID`), маркер без читателя снят. Список пуст и пустым остаётся: новое место
// сразу пишется через `dataSet`, строк сюда не добавляют.
const KNOWN_RAW_DATA_ATTRIBUTE_DEBT = Object.freeze({})

// Долг правила `pseudo-class-style-key`: файл → число ключей-псевдоклассов. Сорок
// ключей `':hover'` в 21 файле и девять `':focus'`/`':focus-visible'`/`':active'`
// разобраны в #2036 — отклик переведён на состояние `Pressable` или правило в
// `app/global.css`, ключ неинтерактивного блока снят. Список пуст и пустым остаётся.
const KNOWN_PSEUDO_CLASS_STYLE_KEY_DEBT = Object.freeze({})

// Код web-приложения — те же корни, что у `guard-web-deferred-loading.js`.
// Native-файлы DOM не имеют вовсе, тесты читают пропы, а не DOM.
const SCAN_ROOTS = [
  'api',
  'app',
  'components',
  'config',
  'constants',
  'context',
  'hooks',
  'i18n',
  'screens',
  'services',
  'stores',
  'styles',
  'types',
  'ui',
  'utils',
]
const IGNORED_DIRS = new Set(['__tests__', '__mocks__', 'node_modules'])
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'])
const NON_WEB_FILE = /\.(?:native|ios|android)\.[cm]?[jt]sx?$/
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/

const DATA_ATTRIBUTE = /^data-/
const STYLESHEET_SPECIFIER = /\.css(?:[?#].*)?$/
// Селектор вместо имени свойства: `:hover`, `::before`, `&:hover`, `& :focus`.
const PSEUDO_SELECTOR_KEY = /^&?\s*::?[a-z]/i
// Дешёвый предфильтр: файл без этих подстрок не парсится вовсе.
const PREFILTER = /data-|\.css|['"`]&?\s*::?[a-z]/i

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const parseArgs = (argv) => ({
  output: argv.includes('--json') ? 'json' : 'text',
})

const shouldScanFile = (relativePath) => {
  const normalized = normalizePath(relativePath)
  const parts = normalized.split('/')
  if (!SCAN_ROOTS.includes(parts[0])) return false
  if (parts.some((part) => IGNORED_DIRS.has(part))) return false
  if (!SOURCE_EXTENSIONS.has(path.extname(normalized))) return false
  return !NON_WEB_FILE.test(normalized) && !TEST_FILE.test(normalized)
}

const collectSourceFiles = (rootDir) => {
  const files = []
  const walk = (dirPath) => {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const absolute = path.join(dirPath, entry.name)
      const relative = normalizePath(path.relative(rootDir, absolute))
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) walk(absolute)
      } else if (entry.isFile() && shouldScanFile(relative)) {
        files.push(relative)
      }
    }
  }
  for (const root of SCAN_ROOTS) {
    const absoluteRoot = path.join(rootDir, root)
    if (fs.existsSync(absoluteRoot)) walk(absoluteRoot)
  }
  return files.sort()
}

const scriptKindFor = (filePath) => {
  const extension = path.extname(filePath)
  if (extension === '.tsx') return ts.ScriptKind.TSX
  if (extension === '.ts') return ts.ScriptKind.TS
  // `.js`/`.jsx` в RN-проекте спокойно содержат JSX.
  return ts.ScriptKind.JSX
}

const unwrapExpression = (node) => {
  let current = node
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current) ||
      (ts.isSatisfiesExpression && ts.isSatisfiesExpression(current)))
  ) {
    current = current.expression
  }
  return current
}

const propertyNameText = (name) => {
  if (!name) return null
  if (ts.isStringLiteral(name) || ts.isIdentifier(name)) return name.text
  if (ts.isComputedPropertyName(name)) {
    const expression = unwrapExpression(name.expression)
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      return expression.text
    }
  }
  return null
}

// По соглашению JSX тег со строчной буквы — DOM-элемент, остальное — компонент.
const isIntrinsicTagName = (tagName) => {
  if (ts.isJsxNamespacedName && ts.isJsxNamespacedName(tagName)) return true
  return ts.isIdentifier(tagName) && /^[a-z]/.test(tagName.text)
}

const isCreateElementCall = (call) => {
  const callee = call.expression
  if (ts.isIdentifier(callee)) return callee.text === 'createElement'
  return ts.isPropertyAccessExpression(callee) && callee.name.text === 'createElement'
}

// Первый аргумент `createElement`: строка, в том числе шаблонная (`` `h${level}` ``
// в `BelarusTravelHub.web.tsx`), — DOM-тег; идентификатор со строчной буквы —
// переменная с DOM-тегом (`tag` в `ResponsiveText`); прочее — компонент.
const isIntrinsicCreateElementTarget = (argument) => {
  const target = unwrapExpression(argument)
  if (!target) return false
  if (
    ts.isStringLiteral(target) ||
    ts.isNoSubstitutionTemplateLiteral(target) ||
    ts.isTemplateExpression(target)
  ) {
    return true
  }
  return ts.isIdentifier(target) && /^[a-z]/.test(target.text)
}

const jsxElementOfAttributes = (attributes) => attributes.parent

const tagLabel = (element, sourceFile) => `<${element.tagName.getText(sourceFile)}>`

/**
 * Куда уходит объектный литерал с ключом `data-…`. Подъём идёт только сквозь
 * выражения, которые возвращают сам объект: скобки и приведения, ветки тернарника
 * и `&&`/`||`/`??`, спред в другой литерал и аргумент вызова-обёртки
 * (`webOnly({ … })`). Всё остальное — адресат не доказан.
 */
const resolveObjectSink = (objectLiteral, sourceFile) => {
  let current = objectLiteral
  for (;;) {
    const parent = current.parent
    if (!parent) return { dom: false, target: 'unresolved' }

    if (
      ts.isParenthesizedExpression(parent) ||
      ts.isAsExpression(parent) ||
      ts.isTypeAssertionExpression(parent) ||
      ts.isNonNullExpression(parent) ||
      (ts.isSatisfiesExpression && ts.isSatisfiesExpression(parent))
    ) {
      current = parent
      continue
    }
    if (ts.isConditionalExpression(parent) && parent.condition !== current) {
      current = parent
      continue
    }
    if (
      ts.isBinaryExpression(parent) &&
      [
        ts.SyntaxKind.AmpersandAmpersandToken,
        ts.SyntaxKind.BarBarToken,
        ts.SyntaxKind.QuestionQuestionToken,
      ].includes(parent.operatorToken.kind)
    ) {
      current = parent
      continue
    }
    if (ts.isSpreadAssignment(parent)) {
      current = parent.parent
      continue
    }
    if (ts.isCallExpression(parent)) {
      if (isCreateElementCall(parent)) {
        if (parent.arguments[1] !== current) return { dom: false, target: 'unresolved' }
        const tag = parent.arguments[0]
        return {
          dom: isIntrinsicCreateElementTarget(tag),
          target: `createElement(${tag ? tag.getText(sourceFile) : '?'})`,
        }
      }
      if (parent.arguments.includes(current)) {
        current = parent
        continue
      }
      return { dom: false, target: 'unresolved' }
    }
    if (ts.isJsxSpreadAttribute(parent)) {
      const element = jsxElementOfAttributes(parent.parent)
      return { dom: isIntrinsicTagName(element.tagName), target: tagLabel(element, sourceFile) }
    }
    if (ts.isJsxExpression(parent) && parent.parent && ts.isJsxAttribute(parent.parent)) {
      const element = jsxElementOfAttributes(parent.parent.parent)
      return { dom: isIntrinsicTagName(element.tagName), target: tagLabel(element, sourceFile) }
    }
    return { dom: false, target: 'unresolved' }
  }
}

// Объект — значение `dataSet`: ключ объекта (`{ dataSet: { … } }`) или
// JSX-атрибут (`dataSet={{ … }}`).
const isDataSetObject = (objectLiteral) => {
  let parent = objectLiteral.parent
  while (parent && (ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent))) {
    parent = parent.parent
  }
  if (!parent) return false
  if (ts.isPropertyAssignment(parent)) return propertyNameText(parent.name) === 'dataSet'
  return (
    ts.isJsxExpression(parent) &&
    Boolean(parent.parent) &&
    ts.isJsxAttribute(parent.parent) &&
    parent.parent.name.getText() === 'dataSet'
  )
}

const stylesheetSpecifierOf = (node) => {
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    return node.moduleSpecifier.text
  }
  if (ts.isCallExpression(node)) {
    const [argument] = node.arguments
    if (!argument || !(ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))) {
      return null
    }
    const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'
    const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
    if (isRequire || isDynamicImport) return argument.text
  }
  return null
}

/**
 * Места одного файла: сырые `data-*` (`attributes`), `data-…` внутри `dataSet`
 * (`dataSetKeys`), импорты `.css` (`stylesheets`) и ключи-псевдоклассы
 * (`pseudoClassKeys`).
 */
const analyzeSource = ({ filePath, content }) => {
  const result = { attributes: [], dataSetKeys: [], stylesheets: [], pseudoClassKeys: [] }
  const text = String(content || '')
  if (!PREFILTER.test(text)) return result

  const file = normalizePath(filePath)
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKindFor(file))
  const lineOf = (node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1

  const visit = (node) => {
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sourceFile)
      if (DATA_ATTRIBUTE.test(name)) {
        const element = jsxElementOfAttributes(node.parent)
        if (!isIntrinsicTagName(element.tagName)) {
          result.attributes.push({ line: lineOf(node), name, target: tagLabel(element, sourceFile) })
        }
      }
    } else if (ts.isPropertyAssignment(node)) {
      const name = propertyNameText(node.name)
      if (name && PSEUDO_SELECTOR_KEY.test(name)) {
        result.pseudoClassKeys.push({ line: lineOf(node), name })
      }
      if (name && DATA_ATTRIBUTE.test(name) && !ts.isIdentifier(node.name)) {
        const objectLiteral = node.parent
        if (isDataSetObject(objectLiteral)) {
          result.dataSetKeys.push({ line: lineOf(node), name })
        } else {
          const sink = resolveObjectSink(objectLiteral, sourceFile)
          if (!sink.dom) result.attributes.push({ line: lineOf(node), name, target: sink.target })
        }
      }
    } else if (ts.isPropertySignature(node)) {
      // Поле типа стиля (`':hover'?: ViewStyle`) — приглашение писать мёртвый ключ.
      const name = propertyNameText(node.name)
      if (name && PSEUDO_SELECTOR_KEY.test(name)) {
        result.pseudoClassKeys.push({ line: lineOf(node), name })
      }
    } else {
      const specifier = stylesheetSpecifierOf(node)
      if (specifier && STYLESHEET_SPECIFIER.test(specifier)) {
        result.stylesheets.push({ line: lineOf(node), specifier })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return result
}

const describeAttribute = (site) => `'${site.name}' -> ${site.target}`
const describePseudoClassKey = (site) => `'${site.name}'`
const explainPseudoClassKey = (site) =>
  `${describePseudoClassKey(site)} is not CSS on react-native-web (compiles to an invalid rule); ` +
  'use Pressable hovered/pressed/focused state or a dataSet-marked rule in app/global.css'

/**
 * Места одного правила против его долгового списка: вне списка каждое место —
 * нарушение `rule`; в списке число мест обязано совпасть (`debt-count`); запись
 * без мест — `stale-entry`.
 */
const checkRecordedDebt = ({ sitesByFile, debt, debtName, siteLabel, rule, describe, explain }) => {
  const violations = []
  for (const [file, sites] of sitesByFile) {
    if (!Object.prototype.hasOwnProperty.call(debt, file)) {
      for (const site of sites) {
        violations.push({ rule, file, line: site.line, snippet: explain(site) })
      }
      continue
    }
    if (sites.length !== debt[file]) {
      violations.push({
        rule: 'debt-count',
        file,
        line: sites[0].line,
        snippet:
          `${debtName} expects ${debt[file]} site(s), found ${sites.length}: ` +
          sites.map((site) => `${describe(site)} @${site.line}`).join(', '),
      })
    }
  }

  for (const file of Object.keys(debt)) {
    if (sitesByFile.has(file)) continue
    violations.push({
      rule: 'stale-entry',
      file,
      line: 0,
      snippet: `no ${siteLabel} site left — drop the entry from ${debtName}`,
    })
  }
  return violations
}

const sumDebt = (debt) => Object.values(debt).reduce((sum, count) => sum + count, 0)

const evaluateGuard = ({
  sources = [],
  debt = KNOWN_RAW_DATA_ATTRIBUTE_DEBT,
  pseudoClassDebt = KNOWN_PSEUDO_CLASS_STYLE_KEY_DEBT,
} = {}) => {
  const violations = []
  const attributeFiles = new Map()
  const pseudoClassFiles = new Map()
  let rootStylesheetFound = false

  if (sources.length === 0) {
    violations.push({
      rule: 'empty-scan',
      file: SCAN_ROOTS.join(', '),
      line: 0,
      snippet: 'no web source files were read — a pass over nothing proves nothing',
    })
  }

  for (const source of sources) {
    const file = normalizePath(source.filePath)
    const { attributes, dataSetKeys, stylesheets, pseudoClassKeys } = analyzeSource(source)

    if (attributes.length) attributeFiles.set(file, attributes)
    if (pseudoClassKeys.length) pseudoClassFiles.set(file, pseudoClassKeys)

    for (const site of dataSetKeys) {
      violations.push({
        rule: 'data-key-in-dataset',
        file,
        line: site.line,
        snippet: `'${site.name}' inside dataSet renders as data-${site.name}; use a camelCase key`,
      })
    }

    for (const site of stylesheets) {
      if (file === ROOT_STYLESHEET.file && site.specifier === ROOT_STYLESHEET.specifier) {
        rootStylesheetFound = true
        continue
      }
      violations.push({
        rule: 'stylesheet-import',
        file,
        line: site.line,
        snippet: `${site.specifier} — the web export emits only ${ROOT_STYLESHEET.file} -> ${ROOT_STYLESHEET.specifier}`,
      })
    }
  }

  violations.push(
    ...checkRecordedDebt({
      sitesByFile: attributeFiles,
      debt,
      debtName: 'KNOWN_RAW_DATA_ATTRIBUTE_DEBT',
      siteLabel: 'raw data-*',
      rule: 'raw-data-attribute',
      describe: describeAttribute,
      explain: describeAttribute,
    }),
    ...checkRecordedDebt({
      sitesByFile: pseudoClassFiles,
      debt: pseudoClassDebt,
      debtName: 'KNOWN_PSEUDO_CLASS_STYLE_KEY_DEBT',
      siteLabel: 'pseudo-class style key',
      rule: 'pseudo-class-style-key',
      describe: describePseudoClassKey,
      explain: explainPseudoClassKey,
    }),
  )

  if (sources.length > 0 && !rootStylesheetFound) {
    violations.push({
      rule: 'root-stylesheet-missing',
      file: ROOT_STYLESHEET.file,
      line: 0,
      snippet: `expected the only stylesheet import: ${ROOT_STYLESHEET.specifier}`,
    })
  }

  if (violations.length === 0) {
    return {
      ok: true,
      reason:
        `no raw data-* outside dataSet beyond the recorded debt (${sumDebt(debt)} site(s) in ` +
        `${Object.keys(debt).length} file(s)); no pseudo-class style key beyond the recorded debt ` +
        `(${sumDebt(pseudoClassDebt)} site(s) in ${Object.keys(pseudoClassDebt).length} file(s)); ` +
        `the only stylesheet import is ${ROOT_STYLESHEET.file} -> ${ROOT_STYLESHEET.specifier}`,
      violations: [],
    }
  }

  return {
    ok: false,
    reason:
      'Web styling bypasses its channels: DOM attributes go through dataSet, web CSS through app/global.css, ' +
      'hover/focus/press through Pressable state or app/global.css',
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

const formatViolations = (violations) =>
  violations.map((v) => `- [${v.rule}] ${v.file}${v.line ? `:${v.line}` : ''} -> ${v.snippet}`)

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const rootDir = process.cwd()
  const sources = collectSourceFiles(rootDir).map((relativePath) => ({
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
    console.log(`web-style-channels: passed. ${result.reason}`)
    return
  }

  console.error('web-style-channels: failed.')
  console.error(`- ${result.reason}`)
  formatViolations(result.violations).forEach((line) => console.error(line))
  console.error(
    'A marker on a react-native-web component is `dataSet={{ fooBar: "x" }}` (renders data-foo-bar="x"); ' +
      'a raw data-* prop is dropped before the DOM. Web CSS goes into app/global.css — a stylesheet ' +
      'imported anywhere else never reaches the web export. A pseudo-class key in a style object is ' +
      'not CSS either: use `style={({ hovered, pressed }) => …}` on Pressable or a dataSet-marked rule ' +
      'in app/global.css under @media (hover: hover) and (pointer: fine). See docs/RULES.md → «Design system».',
  )
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  KNOWN_PSEUDO_CLASS_STYLE_KEY_DEBT,
  KNOWN_RAW_DATA_ATTRIBUTE_DEBT,
  OUTPUT_CONTRACT_VERSION,
  ROOT_STYLESHEET,
  SCAN_ROOTS,
  analyzeSource,
  buildJsonResult,
  collectSourceFiles,
  evaluateGuard,
  parseArgs,
  shouldScanFile,
}
