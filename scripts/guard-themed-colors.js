#!/usr/bin/env node

/**
 * Гейт правила темизации (`docs/RULES.md` → «UI rules»): цвет тематической
 * поверхности берётся из `useThemedColors()` (`hooks/useTheme.ts:199`), а не
 * прямым чтением `DESIGN_TOKENS.colors.*`.
 *
 * Механизм дефекта: `constants/designSystem.ts` строит токен как
 * `Platform.OS === 'web' ? var(--color-…, fallback) : fallback`. На web это
 * живая CSS-переменная, которую переопределяет `html[data-theme="dark"]`
 * (`app/global.css`). На native ветка ложна, в `StyleSheet.create` уезжает
 * литерал СВЕТЛОЙ палитры, а модульный `StyleSheet.create` считается один раз
 * при загрузке — смена темы в рантайме его не пересчитывает. Итог: экран молча
 * остаётся светлым на Android и iPhone, в браузере при этом всё правильно.
 *
 * Нарушением считается только то чтение, которое реально можно исправить: у
 * токена есть тематический аналог в `getThemedColors()` И его светлое значение
 * отличается от тёмного. Аналог ищется не только по имени: `error*` и `card`
 * собраны из тех же палитровых записей, что `danger*` и `surface`, и чинятся тем
 * же `useThemedColors()`. Токен без аналога (`travelPoint`, `bookPage*`) чинить
 * нечем, а токен с одинаковыми значениями на обеих темах чинить незачем.
 * Классификация выводится из самого источника, а не из списка имён, поэтому
 * гейт сам ужесточается: как только у токена появится расходящийся тематический
 * аналог, его прежние прямые чтения станут нарушениями поверх baseline.
 */

const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const CONTRACT_VERSION = 1
// `utils/` в области намеренно: `utils/passwordStrength.ts` возвращает цвет
// прямо в RN-индикатор `components/forms/PasswordStrengthIndicator.tsx`, то есть
// на тематическую поверхность — тот же дефект, просто не в `components/`.
const SCAN_DIRS = Object.freeze(['app', 'components', 'hooks', 'utils'])
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx'])

// Каталог дизайн-системы принадлежит репозиторию, а не сканируемому дереву:
// `--root` двигает только область поиска чтений.
const CATALOG_ROOT = path.resolve(__dirname, '..')
const DESIGN_SYSTEM_FILE = 'constants/designSystem.ts'
const PALETTE_FILE = 'constants/modernMattePalette.ts'

// В `*.web.*` ветка `Platform.OS === 'web'` истинна всегда, поэтому токен там —
// живая CSS-переменная, а не замороженный литерал: класс дефекта не возникает.
const WEB_ONLY_FILE = /\.web\.(?:js|jsx|ts|tsx)$/
const TEST_FILE = /(?:^|\/)(?:__tests__|__mocks__)\//
const TEST_FILE_SUFFIX = /\.(?:test|spec)\.(?:js|jsx|ts|tsx)$/

const THEMED = 'themed'
const THEME_INVARIANT = 'theme-invariant'
const NO_THEMED_COUNTERPART = 'no-themed-counterpart'

const parseSource = (filePath, content) =>
  ts.createSourceFile(filePath, String(content), ts.ScriptTarget.Latest, true, getScriptKind(filePath))

const getScriptKind = (filePath) => {
  switch (path.extname(filePath).toLowerCase()) {
    case '.js': return ts.ScriptKind.JS
    case '.jsx': return ts.ScriptKind.JSX
    case '.tsx': return ts.ScriptKind.TSX
    default: return ts.ScriptKind.TS
  }
}

const findExportedObject = (sourceFile, name) => {
  let found = null
  const visit = (node) => {
    if (found) return
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue
        let initializer = declaration.initializer
        while (initializer && (ts.isAsExpression(initializer) || ts.isParenthesizedExpression(initializer))) {
          initializer = initializer.expression
        }
        if (initializer && ts.isObjectLiteralExpression(initializer)) found = initializer
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

const propertyName = (property) => {
  if (!property.name) return null
  if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) return property.name.text
  return null
}

/** Плоская карта `key -> строковый литерал`; вычисляемые значения пропускаются. */
const readStringMap = (objectLiteral) => {
  const map = {}
  if (!objectLiteral) return map
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) continue
    const key = propertyName(property)
    if (key && ts.isStringLiteral(property.initializer)) map[key] = property.initializer.text
  }
  return map
}

const callArguments = (property, callees) => {
  if (!ts.isPropertyAssignment(property)) return null
  const { initializer } = property
  if (!ts.isCallExpression(initializer)) return null
  if (!ts.isIdentifier(initializer.expression)) return null
  if (!callees.has(initializer.expression.text)) return null
  return initializer.arguments
}

/** Текст выражения без переносов и лишних пробелов — ключ сопоставления. */
const expressionKey = (expression) =>
  expression ? expression.getText().replace(/\s+/g, '') : null

/** `DESIGN_TOKENS.colors` → `token -> выражение светлого fallback`. */
const readDesignTokenColors = (sourceFile) => {
  const designTokens = findExportedObject(sourceFile, 'DESIGN_TOKENS')
  const colorsProperty = designTokens?.properties.find(
    (property) => ts.isPropertyAssignment(property) && propertyName(property) === 'colors',
  )
  const colors = colorsProperty?.initializer
  const tokens = {}
  if (!colors || !ts.isObjectLiteralExpression(colors)) return tokens

  const callees = new Set(['colorVar', 'colorVarAlphaHex'])
  for (const property of colors.properties) {
    const token = propertyName(property)
    const args = callArguments(property, callees)
    if (!token || !args || args.length < 2) continue
    tokens[token] = args[1]
  }
  return tokens
}

/** `getThemedColors()` → `token -> { light, dark }` выражения. */
const readThemedColors = (sourceFile) => {
  let returned = null
  const visit = (node) => {
    if (returned) return
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'getThemedColors' && node.body) {
      for (const statement of node.body.statements) {
        if (ts.isReturnStatement(statement) && statement.expression && ts.isObjectLiteralExpression(statement.expression)) {
          returned = statement.expression
        }
      }
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  const themed = {}
  if (!returned) return themed

  const callees = new Set(['themedColor', 'themedColorAlphaHex'])
  for (const property of returned.properties) {
    const token = propertyName(property)
    const args = callArguments(property, callees)
    if (!token || !args || args.length < 3) continue
    themed[token] = { light: args[1], dark: args[2] }
  }
  return themed
}

const resolveColorExpression = (expression, catalog) => {
  if (!expression) return null
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text
  if (!ts.isPropertyAccessExpression(expression)) return null
  if (!ts.isIdentifier(expression.expression)) return null

  const holder = expression.expression.text
  const key = expression.name.text
  if (holder === 'MODERN_MATTE_PALETTE') return catalog.paletteLight[key] ?? null
  if (holder === 'MODERN_MATTE_PALETTE_DARK') return catalog.paletteDark[key] ?? null
  if (holder === 'DESIGN_COLORS') return catalog.designColors[key] ?? null
  return null
}

const loadCatalog = (catalogRoot = CATALOG_ROOT) => {
  const readCatalogFile = (relativePath) => {
    const absolutePath = path.join(catalogRoot, relativePath)
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`design system catalog not found: ${relativePath}`)
    }
    return parseSource(relativePath, fs.readFileSync(absolutePath, 'utf8'))
  }

  const designSystem = readCatalogFile(DESIGN_SYSTEM_FILE)
  const palette = readCatalogFile(PALETTE_FILE)

  const catalog = {
    paletteLight: readStringMap(findExportedObject(palette, 'MODERN_MATTE_PALETTE')),
    paletteDark: readStringMap(findExportedObject(palette, 'MODERN_MATTE_PALETTE_DARK')),
    designColors: readStringMap(findExportedObject(designSystem, 'DESIGN_COLORS')),
  }
  const tokenFallbacks = readDesignTokenColors(designSystem)
  const themedColors = readThemedColors(designSystem)

  if (Object.keys(catalog.paletteLight).length === 0 || Object.keys(catalog.paletteDark).length === 0) {
    throw new Error(`${PALETTE_FILE}: light/dark palettes were not parsed`)
  }
  if (Object.keys(tokenFallbacks).length === 0 || Object.keys(themedColors).length === 0) {
    throw new Error(`${DESIGN_SYSTEM_FILE}: DESIGN_TOKENS.colors / getThemedColors were not parsed`)
  }

  // Аналог ищется по палитровой записи, а не по имени: `error` собран из той же
  // `MODERN_MATTE_PALETTE.danger`, что и тематический `danger`, а `card` — из
  // `surface`. По имени такой токен выглядел бы «чинить нечем» и молча уходил из
  // области гейта, хотя `useThemedColors()` его закрывает.
  const counterpartByPaletteEntry = new Map()
  for (const [name, themed] of Object.entries(themedColors)) {
    const key = expressionKey(themed.light)
    if (!key) continue
    // Одноимённая запись выигрывает у случайного соседа по той же палитре.
    if (!counterpartByPaletteEntry.has(key) || name === key.split('.').pop()) {
      counterpartByPaletteEntry.set(key, { name, ...themed })
    }
  }

  const classification = {}
  const counterparts = {}
  for (const [token, fallback] of Object.entries(tokenFallbacks)) {
    const themed = themedColors[token] ?? counterpartByPaletteEntry.get(expressionKey(fallback))
    if (!themed) {
      classification[token] = NO_THEMED_COUNTERPART
      continue
    }
    const light = resolveColorExpression(themed.light, catalog)
    const dark = resolveColorExpression(themed.dark, catalog)
    // Нераспознанное выражение считается тематическим: молчать выгоднее гейту,
    // а не дефекту.
    classification[token] = light !== null && dark !== null && light === dark ? THEME_INVARIANT : THEMED
    if (classification[token] === THEMED) counterparts[token] = themed.name ?? token
  }

  return { classification, counterparts, tokenCount: Object.keys(tokenFallbacks).length }
}

/** Токен вне каталога — либо опечатка, либо новый: обе ситуации требуют внимания. */
const classifyToken = (token, classification) =>
  token && Object.hasOwn(classification, token) ? classification[token] : THEMED

/**
 * Локальные имена, под которыми в файле доступен `DESIGN_TOKENS`. Без этого
 * `import { DESIGN_TOKENS as DT }` или `import * as DS` обходили бы гейт одной
 * строкой импорта.
 */
const collectDesignTokenBindings = (sourceFile) => {
  const direct = new Set(['DESIGN_TOKENS'])
  const namespaces = new Set()

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
    if (!/(?:^|\/)constants\/designSystem$/.test(statement.moduleSpecifier.text)) continue

    const bindings = statement.importClause?.namedBindings
    if (!bindings) continue
    if (ts.isNamespaceImport(bindings)) {
      namespaces.add(bindings.name.text)
      continue
    }
    for (const element of bindings.elements) {
      const imported = element.propertyName?.text ?? element.name.text
      if (imported === 'DESIGN_TOKENS') direct.add(element.name.text)
    }
  }

  return { direct, namespaces }
}

/**
 * Сколько раз имя объявлено в файле. Алиас отслеживается только у уникального
 * имени: `const colors = DESIGN_TOKENS.colors` рядом с `const colors =
 * useThemedColors()` в другой области иначе заставил бы гейт обвинить как раз
 * правильную строку. Само объявление алиаса при этом остаётся нарушением, так
 * что файл не замолкает.
 */
const countDeclaredNames = (sourceFile) => {
  const counts = new Map()
  const remember = (name) => {
    if (name && ts.isIdentifier(name)) counts.set(name.text, (counts.get(name.text) ?? 0) + 1)
  }

  const visit = (node) => {
    if (ts.isVariableDeclaration(node) || ts.isBindingElement(node) || ts.isParameter(node)) remember(node.name)
    else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) remember(node.name)
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return counts
}

/** Ключ элемента деструктуризации: исходное имя свойства, а не локальный алиас. */
const bindingElementKey = (element) => {
  if (element.propertyName) {
    return ts.isIdentifier(element.propertyName) || ts.isStringLiteral(element.propertyName)
      ? element.propertyName.text
      : null
  }
  return ts.isIdentifier(element.name) ? element.name.text : null
}

const collectTokenReads = (content, filePath, classification) => {
  const sourceFile = parseSource(filePath, content)
  const { direct, namespaces } = collectDesignTokenBindings(sourceFile)
  const declaredNames = countDeclaredNames(sourceFile)
  const isUniqueName = (name) => (declaredNames.get(name) ?? 0) <= 1
  // Локальные имена, за которыми спрятан именно `DESIGN_TOKENS.colors`:
  // `const { colors } = DESIGN_TOKENS` и `const colors = DESIGN_TOKENS.colors`
  // не оставляют на месте использования текстового `.colors`-обращения, по
  // которому его находит основной разбор ниже.
  const colorsAliases = new Set()
  const reads = []

  const isDesignTokensRoot = (expression) => {
    if (ts.isIdentifier(expression)) return direct.has(expression.text)
    return (
      ts.isPropertyAccessExpression(expression) &&
      expression.name.text === 'DESIGN_TOKENS' &&
      ts.isIdentifier(expression.expression) &&
      namespaces.has(expression.expression.text)
    )
  }

  const pushRead = (node, token) => {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    reads.push({
      line: line + 1,
      // Динамический доступ и деструктуризация скрывают имя: без него чтение
      // считается тематическим, иначе гейт обходится одной переменной.
      token: token ?? '<dynamic>',
      classification: classifyToken(token, classification),
    })
  }

  const visit = (node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 'colors' &&
      isDesignTokensRoot(node.expression)
    ) {
      const { parent } = node
      let token = null
      if (parent && ts.isPropertyAccessExpression(parent) && parent.expression === node) {
        token = parent.name.text
      } else if (
        parent &&
        ts.isElementAccessExpression(parent) &&
        parent.expression === node &&
        ts.isStringLiteral(parent.argumentExpression)
      ) {
        token = parent.argumentExpression.text
      } else if (
        parent &&
        ts.isVariableDeclaration(parent) &&
        parent.initializer === node &&
        ts.isIdentifier(parent.name) &&
        isUniqueName(parent.name.text)
      ) {
        // `const colors = DESIGN_TOKENS.colors` — без этого каждое дальнейшее
        // `colors.token` было бы невидимо для гейта.
        colorsAliases.add(parent.name.text)
      }

      pushRead(node, token)
    } else if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      colorsAliases.has(node.expression.text)
    ) {
      pushRead(node, node.name.text)
    } else if (
      ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      colorsAliases.has(node.expression.text)
    ) {
      pushRead(node, ts.isStringLiteral(node.argumentExpression) ? node.argumentExpression.text : null)
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isDesignTokensRoot(node.initializer) &&
      isUniqueName(node.name.text)
    ) {
      // `const alias = DESIGN_TOKENS` (или `= NS.DESIGN_TOKENS`) заводит ещё
      // один корень: без этого переименование в одну строку обходило бы гейт.
      direct.add(node.name.text)
    } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      const owner = node.parent.parent
      const initializer = owner && ts.isVariableDeclaration(owner) ? owner.initializer : null
      if (bindingElementKey(node) === 'colors' && initializer && isDesignTokensRoot(initializer)) {
        // `const { colors } = DESIGN_TOKENS` достаёт подобъект без единого
        // текстового `.colors` — без явного разбора паттерна гейт видит здесь
        // ноль чтений вообще.
        pushRead(node, null)
        if (ts.isIdentifier(node.name) && isUniqueName(node.name.text)) colorsAliases.add(node.name.text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return reads
}

const isScannedFile = (relativePath) =>
  SOURCE_EXTENSIONS.has(path.extname(relativePath).toLowerCase()) &&
  !WEB_ONLY_FILE.test(relativePath) &&
  !TEST_FILE.test(relativePath) &&
  !TEST_FILE_SUFFIX.test(relativePath)

const collectSourceFiles = (root) => {
  const files = []

  const walk = (absoluteDir) => {
    if (!fs.existsSync(absoluteDir)) return
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      const absolutePath = path.join(absoluteDir, entry.name)
      if (entry.isDirectory()) {
        walk(absolutePath)
        continue
      }
      if (!entry.isFile()) continue
      const relativePath = path.relative(root, absolutePath).split(path.sep).join('/')
      if (isScannedFile(relativePath)) files.push(relativePath)
    }
  }

  for (const dir of SCAN_DIRS) walk(path.join(root, dir))
  return files.sort((left, right) => left.localeCompare(right))
}

const scanThemedColors = (root, classification) => {
  const files = {}
  const exempt = { [THEME_INVARIANT]: 0, [NO_THEMED_COUNTERPART]: 0 }
  let occurrences = 0

  for (const relativePath of collectSourceFiles(root)) {
    const reads = collectTokenReads(fs.readFileSync(path.join(root, relativePath), 'utf8'), relativePath, classification)
    const violations = reads.filter((read) => read.classification === THEMED)
    for (const read of reads) {
      if (read.classification !== THEMED) exempt[read.classification] += 1
    }
    if (violations.length === 0) continue

    files[relativePath] = violations
    occurrences += violations.length
  }

  return {
    files,
    totals: { files: Object.keys(files).length, occurrences, exempt },
  }
}

const createBaseline = (scan) => ({
  contractVersion: CONTRACT_VERSION,
  scope: [...SCAN_DIRS],
  totals: { files: scan.totals.files, occurrences: scan.totals.occurrences },
  files: Object.fromEntries(
    Object.entries(scan.files).map(([file, violations]) => [file, violations.length]),
  ),
})

const compareToBaseline = (scan, baseline) => {
  if (baseline?.contractVersion !== CONTRACT_VERSION) {
    throw new Error(`unsupported baseline contractVersion=${String(baseline?.contractVersion)}`)
  }
  if (JSON.stringify(baseline.scope) !== JSON.stringify([...SCAN_DIRS])) {
    throw new Error('baseline scope does not match the guard scope')
  }

  const violations = []
  for (const [file, reads] of Object.entries(scan.files)) {
    const allowed = Number(baseline.files?.[file] ?? 0)
    if (reads.length <= allowed) continue
    violations.push({
      file,
      baseline: allowed,
      current: reads.length,
      reads: reads.map(({ line, token }) => ({ line, token })),
    })
  }

  return violations.sort((left, right) => left.file.localeCompare(right.file))
}

const parseArgs = (argv) => {
  const args = {
    root: process.cwd(),
    baseline: 'scripts/themed-colors-baseline.json',
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
  const { classification, counterparts } = loadCatalog()
  const scan = scanThemedColors(args.root, classification)

  if (args.update) {
    const baseline = createBaseline(scan)
    fs.mkdirSync(path.dirname(baselinePath), { recursive: true })
    fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
    process.stdout.write(`Themed-colors baseline updated: ${path.relative(args.root, baselinePath)}.\n`)
    process.stdout.write(`${JSON.stringify(baseline.totals)}\n`)
    return 0
  }

  if (!fs.existsSync(baselinePath)) {
    process.stderr.write(`Themed-colors guard failed: baseline not found at ${baselinePath}.\n`)
    return 1
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
  const violations = compareToBaseline(scan, baseline)

  if (args.json) {
    process.stdout.write(`${JSON.stringify({
      contractVersion: CONTRACT_VERSION,
      totals: scan.totals,
      violationCount: violations.length,
      violations,
    }, null, 2)}\n`)
  } else if (violations.length === 0) {
    process.stdout.write(
      `Themed-colors guard passed. baseline=${scan.totals.occurrences} direct read(s) ` +
      `in ${scan.totals.files} file(s); exempt: ${scan.totals.exempt[THEME_INVARIANT]} theme-invariant, ` +
      `${scan.totals.exempt[NO_THEMED_COUNTERPART]} without a themed counterpart.\n`,
    )
  } else {
    process.stderr.write(`Themed-colors guard found ${violations.length} file(s) over baseline:\n`)
    for (const violation of violations) {
      process.stderr.write(`- ${violation.file} baseline=${violation.baseline} current=${violation.current}\n`)
      for (const read of violation.reads) {
        const counterpart = counterparts[read.token]
        const hint = counterpart ? ` -> useThemedColors().${counterpart}` : ''
        process.stderr.write(`    ${violation.file}:${read.line} DESIGN_TOKENS.colors.${read.token}${hint}\n`)
      }
    }
    process.stderr.write(
      'Read the color through `useThemedColors()` (hooks/useTheme.ts:199) instead of `DESIGN_TOKENS.colors.*`:\n' +
      'a module-level StyleSheet freezes the light palette on Android and iPhone.\n' +
      'A value that leaves RN for an HTML string or an API payload uses `DESIGN_COLORS` instead,\n' +
      'because a `var(--color-…)` token has nothing to resolve against there (docs/RULES.md, «UI rules»).\n' +
      'If a token has just gained a themed counterpart, migrate its reads — do not raise the baseline to match.\n',
    )
  }

  return violations.length === 0 ? 0 : 1
}

if (require.main === module) {
  try {
    process.exitCode = run(parseArgs(process.argv.slice(2)))
  } catch (error) {
    process.stderr.write(`Themed-colors guard failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}

module.exports = {
  CONTRACT_VERSION,
  NO_THEMED_COUNTERPART,
  SCAN_DIRS,
  THEMED,
  THEME_INVARIANT,
  classifyToken,
  collectSourceFiles,
  collectTokenReads,
  compareToBaseline,
  createBaseline,
  isScannedFile,
  loadCatalog,
  parseArgs,
  run,
  scanThemedColors,
}
