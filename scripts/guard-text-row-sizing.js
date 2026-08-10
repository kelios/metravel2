#!/usr/bin/env node

// Structural guard for NATIVE-TEXT-ROW-001 (#1344).
//
// Android Yoga can measure dynamic Text in a flex row at its intrinsic width
// and silently truncate it even when mobile web wraps the same content. A row
// child therefore needs one zero-basis outlet, a bounded width/group, or an
// explicit product ellipsis contract. Standalone `flexShrink` keeps the
// intrinsic basis, while multiple `flex` labels divide the row into competing
// allocations; neither is sufficient for this family.

const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const CONTRACT_VERSION = 1
const SCAN_DIRS = Object.freeze(['app', 'components', 'screens'])
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

// This guard intentionally covers the high-signal #1342 shape: an Android-
// relevant wrapping row with at least three JSX children and at least two
// concurrently plausible dynamic labels that have no sizing outlet. It does
// not claim to prove every two-child icon/label row or web-only layout.
//
// Keep this list small, stable and reviewed. Each key is structural
// (`file::row-style::text-style`), not line-based, and every entry must still
// match a real finding or the guard fails with a stale-allowlist error.
const MAX_ALLOWLIST_ENTRIES = 4
const ALLOWLIST = Object.freeze({})

const UNKNOWN_VALUE = Symbol('unknown-style-value')

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const parseSource = (filePath, content) =>
  ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)

const shouldIgnoreDir = (name) => IGNORED_DIRS.has(name) || name.startsWith('dist-')

const isAndroidRelevantSource = (fileName) =>
  !fileName.endsWith('.web.tsx') && !fileName.endsWith('.ios.tsx')

const collectSourceFiles = (rootDir) => {
  const files = []
  const walk = (dirPath) => {
    if (!fs.existsSync(dirPath)) return
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const absolute = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        if (!shouldIgnoreDir(entry.name)) walk(absolute)
        continue
      }
      if (
        !entry.isFile() ||
        !SOURCE_EXTENSIONS.has(path.extname(entry.name)) ||
        !isAndroidRelevantSource(entry.name)
      ) {
        continue
      }
      files.push(normalizePath(path.relative(rootDir, absolute)))
    }
  }
  for (const directory of SCAN_DIRS) walk(path.join(rootDir, directory))
  return files.sort()
}

const propertyName = (node) => {
  if (!node?.name) return null
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) return node.name.text
  return null
}

const staticStyleValue = (node) => {
  if (!node) return UNKNOWN_VALUE
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) {
    return staticStyleValue(node.expression)
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const value = staticStyleValue(node.operand)
    return typeof value === 'number' ? -value : UNKNOWN_VALUE
  }
  return UNKNOWN_VALUE
}

const readStyleObject = (objectLiteral) => {
  const properties = new Map()
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) continue
    const name = propertyName(property)
    if (!name) continue
    properties.set(name, staticStyleValue(property.initializer))
  }
  return properties
}

const isStyleSheetCreateCall = (node) =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  ts.isIdentifier(node.expression.expression) &&
  node.expression.expression.text === 'StyleSheet' &&
  node.expression.name.text === 'create'

const collectStyleDefinitions = (sourceFile) => {
  const definitions = new Map()
  const visit = (node) => {
    if (isStyleSheetCreateCall(node)) {
      const [argument] = node.arguments
      if (argument && ts.isObjectLiteralExpression(argument)) {
        for (const property of argument.properties) {
          if (!ts.isPropertyAssignment(property)) continue
          const name = propertyName(property)
          const initializer = property.initializer
          if (!name || !ts.isObjectLiteralExpression(initializer)) continue
          const current = definitions.get(name) || new Map()
          for (const [key, value] of readStyleObject(initializer)) current.set(key, value)
          definitions.set(name, current)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return definitions
}

const jsxAttribute = (opening, name) => {
  for (const property of opening.attributes.properties) {
    if (!ts.isJsxAttribute(property)) continue
    if (property.name && ts.isIdentifier(property.name) && property.name.text === name) return property
  }
  return null
}

const attributeExpression = (attribute) => {
  const initializer = attribute?.initializer
  if (!initializer) return null
  if (ts.isJsxExpression(initializer)) return initializer.expression || null
  if (ts.isStringLiteral(initializer)) return initializer
  return null
}

const mergeProperties = (target, source) => {
  for (const [key, value] of source) target.set(key, value)
  return target
}

const mergePropertyVariants = (leftVariants, rightVariants) => {
  const merged = []
  for (const left of leftVariants) {
    for (const right of rightVariants) {
      merged.push(mergeProperties(new Map(left), right))
    }
  }
  return merged
}

const collectStyleReferences = (expression, out = []) => {
  if (!expression) return out
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)) {
    return collectStyleReferences(expression.expression, out)
  }
  if (ts.isPropertyAccessExpression(expression)) {
    out.push(expression.name.text)
    return out
  }
  if (ts.isArrayLiteralExpression(expression)) {
    for (const element of expression.elements) collectStyleReferences(element, out)
    return out
  }
  if (ts.isConditionalExpression(expression)) {
    collectStyleReferences(expression.whenTrue, out)
    collectStyleReferences(expression.whenFalse, out)
    return out
  }
  if (ts.isBinaryExpression(expression)) {
    collectStyleReferences(expression.left, out)
    collectStyleReferences(expression.right, out)
    return out
  }
  return out
}

const resolveStyle = (opening, definitions) => {
  const attribute = jsxAttribute(opening, 'style')
  const expression = attributeExpression(attribute)
  const properties = new Map()
  const styleNames = collectStyleReferences(expression)
  for (const name of styleNames) {
    const definition = definitions.get(name)
    if (definition) mergeProperties(properties, definition)
  }

  const collectInlineObjects = (node) => {
    if (!node) return
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) {
      collectInlineObjects(node.expression)
      return
    }
    if (ts.isObjectLiteralExpression(node)) {
      mergeProperties(properties, readStyleObject(node))
      return
    }
    if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) collectInlineObjects(element)
      return
    }
    if (ts.isConditionalExpression(node)) {
      collectInlineObjects(node.whenTrue)
      collectInlineObjects(node.whenFalse)
      return
    }
    if (ts.isBinaryExpression(node)) {
      collectInlineObjects(node.left)
      collectInlineObjects(node.right)
    }
  }
  collectInlineObjects(expression)

  const collectVariants = (node) => {
    if (!node) return [new Map()]
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) {
      return collectVariants(node.expression)
    }
    if (ts.isPropertyAccessExpression(node)) {
      const definition = definitions.get(node.name.text)
      return [definition ? new Map(definition) : new Map()]
    }
    if (ts.isObjectLiteralExpression(node)) return [readStyleObject(node)]
    if (ts.isArrayLiteralExpression(node)) {
      let variants = [new Map()]
      for (const element of node.elements) {
        variants = mergePropertyVariants(variants, collectVariants(element))
      }
      return variants
    }
    if (ts.isConditionalExpression(node)) {
      return [...collectVariants(node.whenTrue), ...collectVariants(node.whenFalse)]
    }
    if (ts.isBinaryExpression(node)) {
      // RN style arrays commonly contain `condition && styles.shrink`. The
      // condition-false branch contributes no style, so a sizing contract in
      // only the right branch is not guaranteed. Treat both operands as
      // runtime alternatives rather than merging them into a false safe state.
      return [...collectVariants(node.left), ...collectVariants(node.right)]
    }
    return [new Map()]
  }

  return { properties, styleNames, variants: collectVariants(expression) }
}

const hasPositiveOrDynamic = (properties, name) => {
  if (!properties.has(name)) return false
  const value = properties.get(name)
  return value === UNKNOWN_VALUE || (typeof value === 'number' && value > 0)
}

const hasBoundedDimension = (properties, name) => {
  if (!properties.has(name)) return false
  const value = properties.get(name)
  if (value === UNKNOWN_VALUE) return true
  if (typeof value === 'number') return value > 0
  return typeof value === 'string' && value.length > 0 && value !== 'auto'
}

const hasSizingContract = (properties) =>
  hasPositiveOrDynamic(properties, 'flex') ||
  hasBoundedDimension(properties, 'width') ||
  hasBoundedDimension(properties, 'maxWidth')

const hasPositiveFlexContract = (properties) => hasPositiveOrDynamic(properties, 'flex')

const hasBoundedSizingContract = (properties) =>
  hasBoundedDimension(properties, 'width') || hasBoundedDimension(properties, 'maxWidth')

const hasGuaranteedSizingContract = (resolvedStyle) =>
  resolvedStyle.variants.length > 0 &&
  resolvedStyle.variants.every((properties) => hasSizingContract(properties))

const hasGuaranteedPositiveFlexContract = (resolvedStyle) =>
  resolvedStyle.variants.length > 0 &&
  resolvedStyle.variants.every((properties) => hasPositiveFlexContract(properties))

const hasGuaranteedBoundedSizingContract = (resolvedStyle) =>
  resolvedStyle.variants.length > 0 &&
  resolvedStyle.variants.every((properties) => hasBoundedSizingContract(properties))

const jsxName = (opening) => (ts.isIdentifier(opening.tagName) ? opening.tagName.text : '')

const openingOf = (node) => {
  if (ts.isJsxElement(node)) return node.openingElement
  if (ts.isJsxSelfClosingElement(node)) return node
  return null
}

const importedReactNativeTextNames = (sourceFile) => {
  const names = new Set()
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== 'react-native') continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements) {
      const imported = element.propertyName?.text || element.name.text
      if (imported === 'Text') names.add(element.name.text)
    }
  }
  return names
}

const expressionIsStatic = (expression) => {
  if (!expression) return true
  if (
    ts.isStringLiteral(expression) ||
    ts.isNumericLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression)
  ) {
    return true
  }
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression)) {
    return expressionIsStatic(expression.expression)
  }
  if (ts.isBinaryExpression(expression)) {
    return expressionIsStatic(expression.left) && expressionIsStatic(expression.right)
  }
  return false
}

const isDynamicText = (element) => {
  let dynamic = false
  const visitChild = (node) => {
    if (dynamic) return
    if (ts.isJsxExpression(node)) {
      if (!expressionIsStatic(node.expression)) dynamic = true
      return
    }
    if (ts.isJsxElement(node)) {
      for (const child of node.children) visitChild(child)
    }
  }
  for (const child of element.children) visitChild(child)
  return dynamic
}

const hasIntentionalEllipsis = (opening) =>
  Boolean(jsxAttribute(opening, 'numberOfLines') && jsxAttribute(opening, 'ellipsizeMode'))

const collectTopLevelElements = (children) => {
  const elements = []
  const visitExpression = (node) => {
    if (!node) return
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      elements.push(node)
      return
    }
    ts.forEachChild(node, visitExpression)
  }
  for (const child of children) {
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) elements.push(child)
    else if (ts.isJsxExpression(child)) visitExpression(child.expression)
  }
  return elements
}

const findingKey = ({ filePath, rowStyleNames, textStyleNames }) =>
  [
    filePath,
    rowStyleNames.length > 0 ? rowStyleNames.join('+') : 'inline-row',
    textStyleNames.length > 0 ? textStyleNames.join('+') : 'unstyled-text',
  ].join('::')

const scanFile = ({ filePath, content }) => {
  const sourceFile = parseSource(filePath, content)
  const textNames = importedReactNativeTextNames(sourceFile)
  if (textNames.size === 0) {
    return { rowCount: 0, dynamicTextCount: 0, findings: [] }
  }

  const definitions = collectStyleDefinitions(sourceFile)
  const findingsByKey = new Map()
  const countedDynamicTextNodes = new Set()
  let rowCount = 0
  let dynamicTextCount = 0

  const recordDynamicText = (node) => {
    if (countedDynamicTextNodes.has(node)) return
    countedDynamicTextNodes.add(node)
    dynamicTextCount += 1
  }

  const inspectRow = (rowElement) => {
    const rowOpening = rowElement.openingElement
    const rowStyle = resolveStyle(rowOpening, definitions)
    const directChildren = collectTopLevelElements(rowElement.children)
    // The intrinsic-width failure family is about competing row children. Two-
    // child icon-label controls are intentionally outside this high-signal
    // guard; bounded/nested groups are treated as their own layout contracts.
    if (directChildren.length < 3 || rowStyle.properties.get('flexWrap') !== 'wrap') return
    rowCount += 1
    const directUnconditionalChildren = new Set(
      rowElement.children.filter((child) => ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)),
    )
    const dynamicCandidates = []

    const countDynamicTextDescendants = (node) => {
      if (!node) return
      if (ts.isJsxElement(node)) {
        const opening = openingOf(node)
        if (opening && textNames.has(jsxName(opening)) && isDynamicText(node)) {
          recordDynamicText(node)
          return
        }
      }
      ts.forEachChild(node, countDynamicTextDescendants)
    }

    const inspectNode = (node, rowChild) => {
      if (!node) return
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const opening = openingOf(node)
        const currentRowChild = rowChild || node
        if (!opening) return

        if (node !== rowElement && ts.isJsxElement(node)) {
          const nestedStyle = resolveStyle(opening, definitions)
          if (nestedStyle.properties.get('flexDirection') === 'row') {
            // A nested row owns its own sizing contract, so its labels are not
            // candidates of the outer row. Still count them to keep bounded-
            // wrapper fixtures and repository scans observably non-vacuous.
            countDynamicTextDescendants(node)
            return
          }
        }

        if (
          ts.isJsxElement(node) &&
          textNames.has(jsxName(opening)) &&
          isDynamicText(node)
        ) {
          recordDynamicText(node)
          const textStyle = resolveStyle(opening, definitions)
          const childOpening = openingOf(currentRowChild)
          const childStyle = childOpening ? resolveStyle(childOpening, definitions) : textStyle
          const childIsText = currentRowChild === node
          const wrapperIsBounded = !childIsText && hasGuaranteedBoundedSizingContract(childStyle)
          // A JSX element hidden under `condition && ...` / ternary is not
          // statically proven concurrent with another branch. Only direct,
          // unconditional row children (or their direct wrapper subtree) form
          // the high-signal competing-intrinsic-width shape.
          if (directUnconditionalChildren.has(currentRowChild)) {
            dynamicCandidates.push({ opening, textStyle, wrapperIsBounded })
          }
        }

        if (ts.isJsxElement(node)) {
          for (const child of node.children) inspectNode(child, currentRowChild)
        }
        return
      }
      if (ts.isJsxExpression(node) && node.expression) inspectNode(node.expression, rowChild)
      else ts.forEachChild(node, (child) => inspectNode(child, rowChild))
    }

    for (const child of rowElement.children) inspectNode(child, null)
    if (dynamicCandidates.length < 2) return

    const competingFlexCandidates = dynamicCandidates.filter(
      ({ opening, textStyle, wrapperIsBounded }) =>
        hasGuaranteedPositiveFlexContract(textStyle) &&
        !hasGuaranteedBoundedSizingContract(textStyle) &&
        !wrapperIsBounded &&
        !hasIntentionalEllipsis(opening),
    )

    const unsafeCandidates = dynamicCandidates.filter(
      ({ opening, textStyle, wrapperIsBounded }) =>
        !hasGuaranteedSizingContract(textStyle) &&
        !wrapperIsBounded &&
        !hasIntentionalEllipsis(opening),
    )
    // One flexible/bounded sibling is the outlet for the remaining row width;
    // the existing occupancy row is the healthy control for that shape. The
    // dangerous cases are at least two intrinsic labels, or multiple competing
    // flex labels that Yoga divides into independent zero-basis shares.
    const reportedCandidates = competingFlexCandidates.length >= 2
      ? competingFlexCandidates
      : unsafeCandidates.length >= 2
        ? unsafeCandidates
        : []
    if (reportedCandidates.length === 0) return

    for (const { opening, textStyle } of reportedCandidates) {
      const key = findingKey({
        filePath,
        rowStyleNames: rowStyle.styleNames,
        textStyleNames: textStyle.styleNames,
      })
      if (!findingsByKey.has(key)) {
        findingsByKey.set(key, {
          key,
          file: filePath,
          line: sourceFile.getLineAndCharacterOfPosition(opening.getStart(sourceFile)).line + 1,
          rowStyle: rowStyle.styleNames.join('+') || 'inline-row',
          textStyle: textStyle.styleNames.join('+') || 'unstyled-text',
        })
      }
    }
  }

  const visit = (node) => {
    if (ts.isJsxElement(node)) {
      const style = resolveStyle(node.openingElement, definitions)
      if (style.properties.get('flexDirection') === 'row') inspectRow(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return {
    rowCount,
    dynamicTextCount,
    findings: [...findingsByKey.values()].sort((left, right) => left.key.localeCompare(right.key)),
  }
}

const evaluateFindings = ({ files, rowCount, dynamicTextCount, findings, allowlist = ALLOWLIST }) => {
  const allowlistKeys = Object.keys(allowlist)
  const findingKeys = new Set(findings.map((finding) => finding.key))
  const staleAllowlist = allowlistKeys.filter((key) => !findingKeys.has(key)).sort()
  const violations = findings.filter((finding) => !Object.hasOwn(allowlist, finding.key))
  const allowlisted = findings.filter((finding) => Object.hasOwn(allowlist, finding.key))
  const vacuous = files === 0 || rowCount === 0 || dynamicTextCount === 0
  const allowlistTooLarge = allowlistKeys.length > MAX_ALLOWLIST_ENTRIES

  return {
    ok: !vacuous && !allowlistTooLarge && staleAllowlist.length === 0 && violations.length === 0,
    contractVersion: CONTRACT_VERSION,
    fileCount: files,
    rowCount,
    dynamicTextCount,
    findingCount: findings.length,
    allowlistedCount: allowlisted.length,
    violationCount: violations.length,
    vacuous,
    allowlistTooLarge,
    staleAllowlist,
    allowlisted,
    violations,
  }
}

const scanTextRowSizing = (rootDir, { allowlist = ALLOWLIST } = {}) => {
  const files = collectSourceFiles(rootDir)
  const findings = []
  let rowCount = 0
  let dynamicTextCount = 0
  for (const filePath of files) {
    const result = scanFile({
      filePath,
      content: fs.readFileSync(path.join(rootDir, filePath), 'utf8'),
    })
    rowCount += result.rowCount
    dynamicTextCount += result.dynamicTextCount
    findings.push(...result.findings)
  }
  return evaluateFindings({
    files: files.length,
    rowCount,
    dynamicTextCount,
    findings,
    allowlist,
  })
}

const parseArgs = (argv) => {
  const args = { root: process.cwd(), json: false }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--root' && argv[index + 1]) {
      args.root = path.resolve(argv[index + 1])
      index += 1
    } else if (argv[index] === '--json') {
      args.json = true
    }
  }
  return args
}

const run = (args = parseArgs([])) => {
  const result = scanTextRowSizing(args.root)
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else if (result.ok) {
    process.stdout.write(
      `Text-row sizing guard passed. files=${result.fileCount} rows=${result.rowCount} ` +
      `dynamicText=${result.dynamicTextCount} allowlisted=${result.allowlistedCount}\n`,
    )
  } else {
    process.stderr.write('Text-row sizing guard failed.\n')
    if (result.vacuous) process.stderr.write('- scan is vacuous; expected source files, flex rows and dynamic Text\n')
    if (result.allowlistTooLarge) {
      process.stderr.write(`- allowlist exceeds reviewed maximum (${MAX_ALLOWLIST_ENTRIES})\n`)
    }
    for (const key of result.staleAllowlist) process.stderr.write(`- stale allowlist entry: ${key}\n`)
    for (const finding of result.violations) {
      process.stderr.write(`- ${finding.file}:${finding.line} ${finding.rowStyle} -> ${finding.textStyle}\n`)
    }
    if (result.violations.length > 0) {
      process.stderr.write(
        '- competing dynamic React Native Text needs one positive-flex outlet, bounded widths/groups, ' +
        'or explicit numberOfLines + ellipsizeMode; do not assign flex to multiple labels\n',
      )
    }
  }
  return result.ok ? 0 : 1
}

if (require.main === module) process.exit(run(parseArgs(process.argv.slice(2))))

module.exports = {
  CONTRACT_VERSION,
  SCAN_DIRS,
  MAX_ALLOWLIST_ENTRIES,
  ALLOWLIST,
  parseSource,
  collectSourceFiles,
  collectStyleDefinitions,
  resolveStyle,
  hasSizingContract,
  hasGuaranteedSizingContract,
  hasGuaranteedPositiveFlexContract,
  hasGuaranteedBoundedSizingContract,
  isDynamicText,
  hasIntentionalEllipsis,
  scanFile,
  evaluateFindings,
  scanTextRowSizing,
  parseArgs,
  run,
}
