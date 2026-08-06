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

const CONTRACT_VERSION = 2

// Порог = 44dp. Android/Material рекомендует 48dp, и для НОВЫХ компактных
// иконочных кнопок это по-прежнему правильная цель, но 44 — принятый в проекте
// фактический floor (`docs/DESIGN_SYSTEM.md`, ToolActionsRow «44/48dp»), и на
// нём стоит 58 существующих элементов. Гард ловит явные недомерки и регрессии;
// подъём floor до 48 — отдельное дизайн-решение, а не задача regression guard.
const MIN_TOUCH_TARGET = 44

const SCAN_DIRS = Object.freeze(['app', 'components', 'hooks', 'screens'])
// `.ts` нужен не ради JSX, а ради модулей стилей: размер тач-таргета всё чаще
// объявлен не рядом с `Pressable`, а в вынесенном style-модуле (#1274, приёмка).
const SOURCE_EXTENSIONS = new Set(['.tsx', '.ts'])
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
  // `width: isMobile ? 26 : 32` — самая частая форма адаптивного размера, и
  // именно на ней гард молчал про весь мастер квеста. Для гарда значение ветки
  // — худший случай: если хоть одна ветка даёт недомерок, он реален на
  // соответствующей поверхности.
  if (ts.isConditionalExpression(node)) {
    const whenTrue = numericValue(node.whenTrue)
    const whenFalse = numericValue(node.whenFalse)
    if (whenTrue === null || whenFalse === null) return null
    return Math.min(whenTrue, whenFalse)
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

const unwrap = (node) => (node && ts.isAsExpression(node) ? node.expression : node)

const isStyleSheetCreateCall = (node) =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  ts.isIdentifier(node.expression.expression) &&
  node.expression.expression.text === 'StyleSheet' &&
  node.expression.name.text === 'create'

const isPlatformSelectCall = (node) =>
  !!node &&
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  ts.isIdentifier(node.expression.expression) &&
  node.expression.expression.text === 'Platform' &&
  node.expression.name.text === 'select'

/** `Platform.select({ web: {...}, android: {...} })` — не таблица стилей. */
const isPlatformSelectArgument = (node) => isPlatformSelectCall(node.parent)

/**
 * Объектный литерал похож на таблицу стилей: минимум два имени, за каждым из
 * которых стоит объект. Порог в два имени отсекает одиночные обёртки вроде
 * `Platform.select({ web: {...} })`, а сами `Platform.select` исключены явно.
 */
const isStyleMapLiteral = (node) => {
  if (!ts.isObjectLiteralExpression(node)) return false
  let objectProps = 0
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    if (ts.isObjectLiteralExpression(unwrap(prop.initializer))) objectProps += 1
  }
  return objectProps >= 2
}

const readStyleMap = (objectLiteral, styles) => {
  for (const prop of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const name = propertyName(prop)
    if (!name) continue
    const initializer = unwrap(prop.initializer)
    if (!ts.isObjectLiteralExpression(initializer)) continue
    const dims = readStyleObject(initializer)
    const known = styles[name]
    // Один файл может объявить имя дважды (варианты темы) — держим худший.
    if (!known) styles[name] = dims
    else for (const key of SIZE_KEYS) {
      if (typeof dims[key] === 'number' && (typeof known[key] !== 'number' || dims[key] < known[key])) {
        known[key] = dims[key]
      }
    }
  }
}

/**
 * Все объявленные размеры стилей файла.
 * Возвращает `{ [styleName]: { width?, height?, minWidth?, minHeight? } }`.
 *
 * `StyleSheet.create({...})` читается везде. В модулях стилей (`includeFactories`)
 * дополнительно читаются таблицы, возвращаемые фабриками вида
 * `createHeaderStyles = (colors, isMobile) => ({ ... })`: они не проходят через
 * `StyleSheet.create` в своём файле, поэтому раньше были невидимы целиком.
 */
const collectStyleSizes = (sourceFile, { includeFactories = false } = {}) => {
  const styles = {}

  const visit = (node) => {
    if (isStyleSheetCreateCall(node)) {
      const [arg] = node.arguments
      if (arg && ts.isObjectLiteralExpression(arg)) readStyleMap(arg, styles)
    } else if (includeFactories && isStyleMapLiteral(node) && !isPlatformSelectArgument(node)) {
      readStyleMap(node, styles)
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

const isJsxElement = (node) => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)

const jsxAttribute = (node, name) => {
  for (const attribute of node.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue
    if (attribute.name && ts.isIdentifier(attribute.name) && attribute.name.text === name) return attribute
  }
  return null
}

/** Имена параметров функции, включая деструктуризацию `({ style })`. */
const parameterNames = (declaration) => {
  const names = new Set()
  for (const parameter of declaration.parameters || []) {
    if (ts.isIdentifier(parameter.name)) names.add(parameter.name.text)
    else if (ts.isObjectBindingPattern(parameter.name)) {
      for (const element of parameter.name.elements) {
        if (ts.isIdentifier(element.name)) names.add(element.name.text)
      }
    }
  }
  return names
}

/**
 * Локальные обёртки, пробрасывающие `style` в интерактивный элемент.
 *
 * Такой компонент САМ является тач-таргетом, но размер ему задаёт вызывающий
 * код: `<ActionButton style={styles.backButton}>`. Внутри обёртки имя стиля не
 * видно (там просто проп `style`), а снаружи тег — не `Pressable`, поэтому без
 * этого шага целый слой кнопок невидим. Ровно так гард молчал про кнопку
 * «Назад» 40dp в шапке, пока её не намерили на устройстве (#1274, приёмка).
 *
 * По той же причине в `INTERACTIVE_ELEMENTS` заведён `IconButton` (#1280).
 */
const collectStyleForwardingWrappers = (sourceFile) => {
  const wrappers = new Set()

  const forwardsStyle = (declaration) => {
    const params = parameterNames(declaration)
    if (!params.has('style')) return false
    let found = false
    const visit = (node) => {
      if (found) return
      if (isJsxElement(node) && INTERACTIVE_ELEMENTS.has(elementName(node))) {
        const attribute = jsxAttribute(node, 'style')
        const initializer = attribute && attribute.initializer
        if (initializer && ts.isJsxExpression(initializer) && initializer.expression) {
          const usesOwnStyle = (expression) => {
            let hit = false
            const walk = (child) => {
              if (hit) return
              if (ts.isIdentifier(child) && child.text === 'style') hit = true
              else ts.forEachChild(child, walk)
            }
            walk(expression)
            return hit
          }
          if (usesOwnStyle(initializer.expression)) found = true
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(declaration)
    return found
  }

  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name && forwardsStyle(node)) {
      wrappers.add(node.name.text)
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const initializer = node.initializer
      if (
        (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) &&
        forwardsStyle(initializer)
      ) {
        wrappers.add(node.name.text)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return wrappers
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

/**
 * Находка адресуется файлу, где размер ОБЪЯВЛЕН, а не файлу с JSX: чинить нужно
 * именно объявление, и один вынесенный стиль не должен размножаться на каждого
 * потребителя отдельной записью baseline.
 */
const findSmallestDeclaredSize = (styleNames, styleTables) => {
  let smallest = null
  for (const name of styleNames) {
    let source = null
    for (const table of styleTables) {
      if (table.styles && Object.prototype.hasOwnProperty.call(table.styles, name)) {
        source = table
        break
      }
    }
    if (!source) continue
    for (const key of SIZE_KEYS) {
      const value = source.styles[name][key]
      if (typeof value !== 'number') continue
      if (value >= MIN_TOUCH_TARGET) continue
      if (!smallest || value < smallest.size) {
        smallest = { file: source.file, style: name, dimension: key, size: value }
      }
    }
  }
  return smallest
}

const isStyleModule = (filePath) =>
  /[Ss]tyles?\.(ts|tsx)$/.test(path.basename(filePath)) ||
  /[Ss]tyles?$/.test(path.basename(path.dirname(filePath)))

const readStyleSheets = (rootDir, filePath) => {
  const absolute = path.join(rootDir, filePath)
  if (!fs.existsSync(absolute)) return null
  const source = fs.readFileSync(absolute, 'utf8')
  const includeFactories = isStyleModule(filePath)
  if (!includeFactories && !source.includes('StyleSheet.create')) return {}
  return collectStyleSizes(parseSource(filePath, source), { includeFactories })
}

/** Стили компонента живут либо в нём самом, либо в сиблинге `Foo.styles.ts`. */
const resolveStyleTables = (rootDir, filePath, ownSource) => {
  const tables = [{ file: filePath, styles: collectStyleSizes(ownSource) }]
  const base = filePath.replace(/\.tsx$/, '')
  for (const candidate of [`${base}.styles.ts`, `${base}.styles.tsx`]) {
    const sibling = readStyleSheets(rootDir, candidate)
    if (sibling) tables.push({ file: candidate, styles: sibling })
  }
  return tables
}

/** Имена стилей, которыми хоть где-то стилизуется интерактивный элемент. */
const collectInteractiveStyleNames = (sourceFile, out = new Set()) => {
  const wrappers = collectStyleForwardingWrappers(sourceFile)
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = elementName(node)
      if (INTERACTIVE_ELEMENTS.has(tag) || wrappers.has(tag)) {
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute)) continue
          if (!(attribute.name && ts.isIdentifier(attribute.name) && attribute.name.text === 'style')) continue
          const initializer = attribute.initializer
          if (initializer && ts.isJsxExpression(initializer) && initializer.expression) {
            for (const name of collectStyleReferences(initializer.expression)) out.add(name)
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return out
}

const scanFile = ({ rootDir, filePath, content }) => {
  if (!/Pressable|Touchable/.test(content)) return []
  const sourceFile = parseSource(filePath, content)
  const styleTables = resolveStyleTables(rootDir, filePath, sourceFile)
  const wrappers = collectStyleForwardingWrappers(sourceFile)
  const findings = []

  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = elementName(node)
      if (INTERACTIVE_ELEMENTS.has(name) || wrappers.has(name)) {
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
          // Инлайновый размер объявлен в самом JSX, именованный — в своём файле
          // стилей; ключ всегда указывает туда, где правится размер.
          const declaredIn = useInline ? filePath : smallest.file
          findings.push({
            file: declaredIn,
            // Ключ baseline не содержит номер строки: он не должен протухать от
            // сдвига кода, иначе гард шумит на каждом несвязанном рефакторинге.
            // У инлайнового стиля имени нет — ключом становится сам размер.
            key: useInline
              ? `${filePath}::inline(${smallest.dimension}=${smallest.size})`
              : `${declaredIn}::${smallest.style}`,
            style: useInline ? `inline(${smallest.dimension}=${smallest.size})` : smallest.style,
            dimension: smallest.dimension,
            size: smallest.size,
            element: name,
            hitSlop: hasHitSlop,
            usedIn: filePath,
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

/**
 * Второй проход — по модулям стилей.
 *
 * Резолвинг «свой файл + сиблинг `*.styles.ts`» закрывает только тот случай,
 * когда таблица стилей доезжает до JSX по импорту рядом. В проекте она сплошь и
 * рядом приезжает пропом из родителя (`styles: any`) или собирается агрегатором
 * из подпапки `<feature>Styles/*.ts` — и тогда связь «JSX → объявление» из
 * одного файла не выводится вовсе. Так целый экран мастера квеста оказался
 * невидимым для гарда при живых 26 и 36 dp.
 *
 * Поэтому связь берётся по имени стиля: имя, которым хоть где-то стилизуется
 * интерактивный элемент, считается тач-таргетом во всех модулях стилей.
 * Огрубление намеренное и однонаправленное — гард может заморозить лишний стиль
 * с совпавшим именем, но не может пропустить настоящий недомерок.
 */
const scanStyleModule = ({ rootDir, filePath, interactiveNames }) => {
  const table = readStyleSheets(rootDir, filePath)
  if (!table) return []
  const findings = []
  for (const [name, dims] of Object.entries(table)) {
    if (!interactiveNames.has(name)) continue
    // Одна находка на стиль — по худшей оси, как и в `scanFile`.
    const smallest = smallestOf([dims])
    if (!smallest) continue
    findings.push({
      file: filePath,
      key: `${filePath}::${name}`,
      style: name,
      dimension: smallest.dimension,
      size: smallest.size,
      element: 'style-module',
      hitSlop: false,
    })
  }
  return findings
}

const scanTouchTargets = (rootDir) => {
  const files = collectSourceFiles(rootDir)
  const contents = new Map()
  const readFile = (filePath) => {
    if (!contents.has(filePath)) contents.set(filePath, fs.readFileSync(path.join(rootDir, filePath), 'utf8'))
    return contents.get(filePath)
  }

  const interactiveNames = new Set()
  const findings = []
  for (const filePath of files) {
    if (path.extname(filePath) !== '.tsx') continue
    const content = readFile(filePath)
    if (!/Pressable|Touchable/.test(content)) continue
    collectInteractiveStyleNames(parseSource(filePath, content), interactiveNames)
    findings.push(...scanFile({ rootDir, filePath, content }))
  }

  for (const filePath of files) {
    if (!isStyleModule(filePath)) continue
    findings.push(...scanStyleModule({ rootDir, filePath, interactiveNames }))
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
  collectInteractiveStyleNames,
  collectStyleForwardingWrappers,
  findSmallestDeclaredSize,
  isStyleModule,
  numericValue,
  scanFile,
  scanStyleModule,
  scanTouchTargets,
  toBaselineEntries,
  createBaseline,
  compareToBaseline,
  parseArgs,
  run,
}
