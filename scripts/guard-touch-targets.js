#!/usr/bin/env node

// Структурный гард семейства «интерактивный элемент меньше минимального
// тач-таргета» (#192 → #1044 → #1271 → #1274).
//
// ПОЧЕМУ РАЗМЕР, А НЕ hitSlop. `hitSlop` не добирает тач-таргет, если родитель
// обтягивает элемент вплотную: на Android RN ищет цель, спускаясь по дереву
// (`TouchTargetHelper`), и hitSlop потомка проверяется ТОЛЬКО после того, как
// точка уже попала внутрь родителя. Ряд, высота которого равна высоте кнопки,
// срезает весь вертикальный hitSlop — проверено тап-пробой на устройстве
// (#1271: тап на 3,4dp ниже кнопки с `hitSlop={6}` не срабатывал).
// Поэтому единственный надёжный тач-таргет — собственный размер вью, и гард
// намеренно НЕ засчитывает hitSlop как добор.
//
// Рабочий приём: таргет задаётся размером самого вью (прозрачная рамка), а
// видимый круг/пилюля остаётся прежним внутри неё — см.
// `MAP_TOOLBAR_TOUCH_TARGET_SIZE` в
// `components/MapPage/MapMobile/MapMobileTopOverlay.styles.ts`.

const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const CONTRACT_VERSION = 1

// Порог = 44dp. Android/Material рекомендует 48dp, и для НОВЫХ компактных
// иконочных кнопок это по-прежнему правильная цель, но 44 — принятый в проекте
// фактический floor (`docs/DESIGN_SYSTEM.md`, ToolActionsRow «44/48dp»), и на
// нём стоит 58 существующих элементов. Гард ловит явные недомерки и регрессии;
// подъём floor до 48 — отдельное дизайн-решение, а не задача regression guard.
const MIN_TOUCH_TARGET = 44

const SCAN_DIRS = Object.freeze(['app', 'components', 'hooks', 'screens'])
const SOURCE_EXTENSIONS = new Set(['.tsx'])
const IGNORED_DIRS = new Set([
  '.git',
  '.expo',
  '.codex-temp',
  '.codex-debug',
  '.claude',
  'node_modules',
  'dist',
  'web-build',
  'coverage',
  'test-results',
  'playwright-report',
  '__tests__',
  'e2e',
])

// Элементы, которые сами являются тач-таргетом.
//
// `IconButton` (#1280) входит сюда, потому что его `Pressable` и есть видимая
// поверхность, а проп `style` потребителя применяется ПОСЛЕ собственных
// размеров примитива и может перебить их в меньшую сторону. Без этого пункта
// гард видит только «сырые» Pressable и пропускает целый слой мест, где
// сабминимальный таргет приходит из стиля вызывающего экрана.
const INTERACTIVE_ELEMENTS = new Set([
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
  'IconButton',
])

// Ключи, которыми вью задаёт собственный размер. `maxWidth`/`maxHeight`
// намеренно не входят: они ограничивают, но не назначают тач-таргет.
const SIZE_KEYS = Object.freeze(['width', 'height', 'minWidth', 'minHeight'])

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const shouldIgnoreDir = (name) => IGNORED_DIRS.has(name) || name.startsWith('dist-')

const collectSourceFiles = (rootDir) => {
  const files = []
  const walk = (dirPath) => {
    if (!fs.existsSync(dirPath)) return
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const absolute = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        if (shouldIgnoreDir(entry.name)) continue
        walk(absolute)
        continue
      }
      if (!entry.isFile()) continue
      // Стили лежат и в `.ts`-сиблингах — они нужны для резолва, но сами не
      // содержат JSX, поэтому подхватываются отдельно в `readStyleSheets`.
      if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue
      files.push(normalizePath(path.relative(rootDir, absolute)))
    }
  }
  for (const dir of SCAN_DIRS) walk(path.join(rootDir, dir))
  return files.sort()
}

const parseSource = (filePath, content) =>
  ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

const numericValue = (node) => {
  if (!node) return null
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) return numericValue(node.expression)
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const inner = numericValue(node.operand)
    return inner === null ? null : -inner
  }
  return null
}

const propertyName = (node) => {
  if (!node.name) return null
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) return node.name.text
  return null
}

const readStyleObject = (objectLiteral) => {
  const dims = {}
  for (const prop of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const key = propertyName(prop)
    if (!key || !SIZE_KEYS.includes(key)) continue
    const value = numericValue(prop.initializer)
    // `minWidth/minHeight: 0` — flex-идиома «разрешить сжатие», а не размер.
    if (value !== null && value > 0) dims[key] = value
  }
  return dims
}

/**
 * Все объявленные размеры из `StyleSheet.create({...})` файла.
 * Возвращает `{ [styleName]: { width?, height?, minWidth?, minHeight? } }`.
 */
const collectStyleSizes = (sourceFile) => {
  const styles = {}

  const visit = (node) => {
    const isStyleSheetCreate =
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'StyleSheet' &&
      node.expression.name.text === 'create'

    if (isStyleSheetCreate) {
      const [arg] = node.arguments
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const prop of arg.properties) {
          if (!ts.isPropertyAssignment(prop)) continue
          const name = propertyName(prop)
          if (!name) continue
          let initializer = prop.initializer
          if (ts.isAsExpression(initializer)) initializer = initializer.expression
          if (!ts.isObjectLiteralExpression(initializer)) continue
          styles[name] = readStyleObject(initializer)
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return styles
}

/**
 * Имена стилей, на которые ссылается `style`-проп.
 * Разбирает member-доступ, массивы, условия и — что критично для `Pressable` —
 * колбэк-форму `style={({ pressed }) => [...]}`. Без неё гард пропускает
 * большинство `Pressable` в проекте (именно так две находки #1274 сначала не
 * попали в аудит).
 */
const collectStyleReferences = (expression, out = []) => {
  if (!expression) return out
  let node = expression
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) {
    return collectStyleReferences(node.expression, out)
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    if (ts.isBlock(node.body)) {
      const visit = (child) => {
        if (ts.isReturnStatement(child) && child.expression) {
          collectStyleReferences(child.expression, out)
          return
        }
        ts.forEachChild(child, visit)
      }
      visit(node.body)
      return out
    }
    return collectStyleReferences(node.body, out)
  }
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
    out.push(node.name.text)
    return out
  }
  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) collectStyleReferences(element, out)
    return out
  }
  if (ts.isConditionalExpression(node)) {
    collectStyleReferences(node.whenTrue, out)
    collectStyleReferences(node.whenFalse, out)
    return out
  }
  if (ts.isBinaryExpression(node)) {
    collectStyleReferences(node.left, out)
    collectStyleReferences(node.right, out)
    return out
  }
  return out
}

const elementName = (node) => {
  const tag = node.tagName
  if (ts.isIdentifier(tag)) return tag.text
  return ''
}

/**
 * Размеры, объявленные прямо в JSX (`style={{ width: 32 }}`). Без этого гард
 * обходится инлайновым объектом, и контракт «таргет задаётся размером вью»
 * перестаёт быть обязательным.
 */
const collectInlineStyleDims = (expression, out = []) => {
  if (!expression) return out
  const visit = (node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const dims = readStyleObject(node)
      if (Object.keys(dims).length > 0) out.push(dims)
    }
    ts.forEachChild(node, visit)
  }
  visit(expression)
  return out
}

const smallestOf = (dimsList) => {
  let smallest = null
  for (const dims of dimsList) {
    for (const key of SIZE_KEYS) {
      const value = dims[key]
      if (typeof value !== 'number' || value >= MIN_TOUCH_TARGET) continue
      if (!smallest || value < smallest.size) smallest = { dimension: key, size: value }
    }
  }
  return smallest
}

const findSmallestDeclaredSize = (styleNames, styleTables) => {
  let smallest = null
  for (const name of styleNames) {
    let dims = null
    for (const table of styleTables) {
      if (table && Object.prototype.hasOwnProperty.call(table, name)) {
        dims = table[name]
        break
      }
    }
    if (!dims) continue
    for (const key of SIZE_KEYS) {
      const value = dims[key]
      if (typeof value !== 'number') continue
      if (value >= MIN_TOUCH_TARGET) continue
      if (!smallest || value < smallest.size) smallest = { style: name, dimension: key, size: value }
    }
  }
  return smallest
}

const readStyleSheets = (rootDir, filePath) => {
  const absolute = path.join(rootDir, filePath)
  if (!fs.existsSync(absolute)) return null
  const source = fs.readFileSync(absolute, 'utf8')
  if (!source.includes('StyleSheet.create')) return {}
  return collectStyleSizes(parseSource(filePath, source))
}

/** Стили компонента живут либо в нём самом, либо в сиблинге `Foo.styles.ts`. */
const resolveStyleTables = (rootDir, filePath, ownSource) => {
  const tables = [collectStyleSizes(ownSource)]
  const base = filePath.replace(/\.tsx$/, '')
  for (const candidate of [`${base}.styles.ts`, `${base}.styles.tsx`]) {
    const sibling = readStyleSheets(rootDir, candidate)
    if (sibling) tables.push(sibling)
  }
  return tables
}

const scanFile = ({ rootDir, filePath, content }) => {
  if (!/Pressable|Touchable/.test(content)) return []
  const sourceFile = parseSource(filePath, content)
  const styleTables = resolveStyleTables(rootDir, filePath, sourceFile)
  const findings = []

  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = elementName(node)
      if (INTERACTIVE_ELEMENTS.has(name)) {
        let styleNames = []
        let inlineDims = []
        let hasHitSlop = false
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute)) continue
          const attributeName = attribute.name && ts.isIdentifier(attribute.name) ? attribute.name.text : ''
          if (attributeName === 'hitSlop') hasHitSlop = true
          if (attributeName !== 'style') continue
          const initializer = attribute.initializer
          if (initializer && ts.isJsxExpression(initializer) && initializer.expression) {
            styleNames = collectStyleReferences(initializer.expression)
            inlineDims = collectInlineStyleDims(initializer.expression)
          }
        }

        const named = findSmallestDeclaredSize(styleNames, styleTables)
        const inline = smallestOf(inlineDims)
        const useInline = inline && (!named || inline.size < named.size)
        const smallest = useInline ? inline : named

        if (smallest) {
          findings.push({
            file: filePath,
            // Ключ baseline не содержит номер строки: он не должен протухать от
            // сдвига кода, иначе гард шумит на каждом несвязанном рефакторинге.
            // У инлайнового стиля имени нет — ключом становится сам размер.
            key: useInline
              ? `${filePath}::inline(${smallest.dimension}=${smallest.size})`
              : `${filePath}::${smallest.style}`,
            style: useInline ? `inline(${smallest.dimension}=${smallest.size})` : smallest.style,
            dimension: smallest.dimension,
            size: smallest.size,
            element: name,
            hitSlop: hasHitSlop,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return findings
}

const scanTouchTargets = (rootDir) => {
  const findings = []
  for (const filePath of collectSourceFiles(rootDir)) {
    const content = fs.readFileSync(path.join(rootDir, filePath), 'utf8')
    findings.push(...scanFile({ rootDir, filePath, content }))
  }
  return findings
}

/** Baseline хранит по одному худшему размеру на `file::style`. */
const toBaselineEntries = (findings) => {
  const entries = {}
  for (const finding of findings) {
    const current = entries[finding.key]
    if (!current || finding.size < current.size) {
      entries[finding.key] = { size: finding.size, dimension: finding.dimension }
    }
  }
  return Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)))
}

const createBaseline = (rootDir) => ({
  contractVersion: CONTRACT_VERSION,
  minTouchTarget: MIN_TOUCH_TARGET,
  scope: [...SCAN_DIRS],
  entries: toBaselineEntries(scanTouchTargets(rootDir)),
})

const compareToBaseline = (findings, baseline) => {
  if (baseline?.contractVersion !== CONTRACT_VERSION) {
    throw new Error(`unsupported baseline contractVersion=${String(baseline?.contractVersion)}`)
  }
  if (baseline.minTouchTarget !== MIN_TOUCH_TARGET) {
    throw new Error('baseline minTouchTarget does not match the guard threshold')
  }
  if (JSON.stringify(baseline.scope) !== JSON.stringify([...SCAN_DIRS])) {
    throw new Error('baseline scope does not match the guard scope')
  }

  const allowed = baseline.entries || {}
  const current = toBaselineEntries(findings)
  const violations = []

  for (const [key, entry] of Object.entries(current)) {
    const known = allowed[key]
    if (!known) {
      violations.push({ key, kind: 'new', baseline: null, current: entry.size, dimension: entry.dimension })
      continue
    }
    if (entry.size < known.size) {
      violations.push({ key, kind: 'regressed', baseline: known.size, current: entry.size, dimension: entry.dimension })
    }
  }

  return violations.sort((left, right) => left.key.localeCompare(right.key))
}

const parseArgs = (argv) => {
  const args = {
    root: process.cwd(),
    baseline: 'scripts/touch-targets-baseline.json',
    update: false,
    json: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--root' && argv[index + 1]) {
      args.root = path.resolve(argv[index + 1])
      index += 1
    } else if (token === '--baseline' && argv[index + 1]) {
      args.baseline = argv[index + 1]
      index += 1
    } else if (token === '--update') {
      args.update = true
    } else if (token === '--json') {
      args.json = true
    }
  }
  return args
}

const resolveBaselinePath = (root, requestedPath) =>
  path.isAbsolute(requestedPath) ? requestedPath : path.resolve(root, requestedPath)

const run = (args = parseArgs([])) => {
  const baselinePath = resolveBaselinePath(args.root, args.baseline)

  if (args.update) {
    const baseline = createBaseline(args.root)
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true })
    fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
    process.stdout.write(`Touch-target baseline updated: ${path.relative(args.root, baselinePath)}.\n`)
    process.stdout.write(`entries=${Object.keys(baseline.entries).length}\n`)
    return 0
  }

  if (!fs.existsSync(baselinePath)) {
    process.stderr.write(`Touch-target guard failed: baseline not found at ${baselinePath}.\n`)
    return 1
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
  const findings = scanTouchTargets(args.root)
  const violations = compareToBaseline(findings, baseline)
  const result = {
    contractVersion: CONTRACT_VERSION,
    minTouchTarget: MIN_TOUCH_TARGET,
    findingCount: findings.length,
    violationCount: violations.length,
    violations,
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else if (violations.length === 0) {
    process.stdout.write(
      `Touch-target guard passed. min=${MIN_TOUCH_TARGET}dp baseline=${Object.keys(baseline.entries || {}).length}\n`,
    )
  } else {
    process.stderr.write(`Touch-target guard found ${violations.length} sub-minimum touch target(s):\n`)
    for (const violation of violations) {
      const was = violation.kind === 'new' ? 'new' : `was ${violation.baseline}dp`
      process.stderr.write(`- ${violation.key} ${violation.dimension}=${violation.current}dp (${was})\n`)
    }
    process.stderr.write(
      `Interactive elements must size their own view to >= ${MIN_TOUCH_TARGET}dp; ` +
      'hitSlop does not extend past a tight parent and does not count. ' +
      'Wrap the visible shape in a transparent target frame (see MAP_TOOLBAR_TOUCH_TARGET_SIZE).\n',
    )
  }

  return violations.length === 0 ? 0 : 1
}

if (require.main === module) {
  process.exit(run(parseArgs(process.argv.slice(2))))
}

module.exports = {
  CONTRACT_VERSION,
  MIN_TOUCH_TARGET,
  SCAN_DIRS,
  SIZE_KEYS,
  INTERACTIVE_ELEMENTS,
  collectStyleSizes,
  collectStyleReferences,
  collectInlineStyleDims,
  findSmallestDeclaredSize,
  scanFile,
  scanTouchTargets,
  toBaselineEntries,
  createBaseline,
  compareToBaseline,
  parseArgs,
  run,
}
