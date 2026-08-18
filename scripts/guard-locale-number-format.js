#!/usr/bin/env node

// Structural guard for LOCALE-NUMBER-FORMAT-001 (#1459).
//
// `i18n/format.ts` is the canonical layer for locale-sensitive numbers
// (`formatNumber`, `formatInteger`, `formatCompactNumber`, `formatCurrency`),
// with `utils/distanceCalculator.ts` as the distance-domain wrapper. Nothing
// prevents a call site from writing `value.toFixed(1)` and gluing a unit by
// hand, and four tickets in a row (#1433, #1440, #1449, #1457) fixed exactly
// that in one more domain each. This guard turns the fifth occurrence into a
// failing check instead of a fifth ticket.
//
// Three shapes are reported:
//   1. `display-toFixed`  — a `.toFixed(0..2)` result that reaches user-visible
//      text (JSX text, a display attribute, a translation argument, or a
//      binding used in one of those places).
//   2. `manual-unit-suffix` — a computed number glued to a hardcoded unit or
//      compact suffix (`K`, `M`, `тыс.`, `км`, `KB`, …), whether the number came
//      from `.toFixed()`, `Math.round()` or plain arithmetic. Such a suffix is
//      user-visible by definition, so this shape is reported wherever it is
//      written.
//   3. `numeric-translation-argument` (#1468) — the other half of the same
//      invariant. Shapes 1 and 2 say «the unit must come from the translation
//      key, not from the code», and a call site that obeys them still prints an
//      English number: `i18nT('… {{value1}} км', { value1: round(km) })` hands
//      i18next a raw `number`, and `i18n/instance.ts` has no `interpolation.
//      format`, so the locale never enters. This shape reads the unit from the
//      RU string instead of from a template literal: when a placeholder is
//      immediately followed by a unit, its value must arrive already formatted
//      by `i18n/format.ts` or a domain wrapper. A template literal counts as
//      formatted only when every substitution inside it already is — a bare
//      `` `${km}` `` just stringifies the number and still prints English.
//
// Deliberately out of scope, structurally rather than by allowlist:
//   * coordinates (`lat`/`lng`/`lon`/`latitude`/`longitude` receivers) — they
//     are a technical notation, not a locale-formatted number;
//   * precision >= 3 — cache keys, geometry and coordinate rounding live there,
//     while displayed numbers in this codebase round to 0..2 digits;
//   * everything that never reaches a display position (cache keys, request
//     params, console diagnostics, SVG path data);
//   * every placeholder that is not followed by a unit — counters, indexes,
//     years, page numbers and identifiers keep printing as they are, because
//     nothing in the string says they are a measured quantity;
//   * i18next's `count`, which selects the plural form and must stay a number.

const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// v2 (#1468): added the `numeric-translation-argument` shape and the two
// counters that keep its scan from going vacuous.
const CONTRACT_VERSION = 2
const SCAN_DIRS = Object.freeze([
  'app',
  'components',
  'constants',
  'hooks',
  'screens',
  'services',
  'utils',
])
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])
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
  '__mocks__',
  'e2e',
])

// Displayed numbers in this codebase round to 0..2 digits; 3+ digits is the
// cache-key/geometry/coordinate band.
const MAX_DISPLAY_FRACTION_DIGITS = 2

// Coordinates are a technical notation (`55.12345, 27.54321`), not a
// locale-formatted number: they go into map URLs, cache keys and copy-to-
// clipboard payloads where a locale decimal comma would be a defect.
const COORDINATE_RECEIVER = /\b(lat|lng|lon|latitude|longitude|coord|coords|latlng|center|bounds|northeast|southwest)\b/i

// ISO-8601 duration (`PT45M`, `P2D`) is a machine format for JSON-LD and APIs:
// its `M` is a minute marker in a payload no reader ever sees.
const ISO_DURATION_PREFIX = /(?:^|[^A-Za-z])P(?:T[\dHMS]*|[\dYMWD]*)$/

// A hardcoded suffix in one of these shapes is user-visible text by
// definition — the unit itself must come from the locale.
const UNIT_SUFFIX = /^\s*(K|M|k|B|KB|MB|GB|km|mi|ft|тыс\.?|млн|млрд|км|м|ч|мин)(?![\p{L}\d])/u

const TRANSLATION_CALLEES = new Set(['t', 'i18nT', 'translate', 'getFixedTranslator'])

// RU is the typed key baseline (`i18n/resources.ts`), so it is the one locale
// where every key is guaranteed to exist and to carry the unit the reader sees.
const TRANSLATION_CATALOGUE_DIR = 'i18n/locales/ru'

// Producers of an already-locale-formatted string. `i18n/format.ts` is the
// canonical layer; the rest are its documented domain wrappers, plus the
// translation call itself (a resolved key is text, not a number).
const LOCALE_FORMAT_CALLEES = new Set([
  'formatCompactNumber',
  'formatCurrency',
  'formatDate',
  'formatDateTime',
  'formatDistance',
  'formatDistanceKm',
  'formatDistanceMeters',
  'formatFileSize',
  'formatInteger',
  'formatList',
  'formatNumber',
  'formatRadiusValue',
  'formatRatingValue',
  'formatRelativeTime',
  'formatTravelTime',
  'selectPlural',
  ...TRANSLATION_CALLEES,
])

// `count` drives i18next plural selection: handing it a string would pick the
// wrong form, so it stays a number by contract rather than by exception.
const PLURAL_SELECTOR_ARGUMENT = 'count'

// Callees that hand back a number ready to be printed.
const NUMERIC_CALLEES = new Set([
  'abs',
  'ceil',
  'floor',
  'max',
  'min',
  'round',
  'toFixed',
  'trunc',
  'Number',
  'parseFloat',
  'parseInt',
])

// Names that carry a quantity rather than a label: they are what a hardcoded
// unit gets glued to.
const NUMERIC_NAME = /(count|total|sum|distance|length|size|bytes|price|amount|value|num|rating|score|duration|hours|minutes|seconds|speed|width|height|weight|km|percent|progress)/i

// A JSX prop is user-facing by default: a component that receives a string
// prints it. The exceptions are machine payloads — geometry, identity, styling,
// navigation targets and event handlers — where a locale decimal comma would
// itself be the defect.
const MACHINE_ATTRIBUTES = new Set([
  'accessibilityValue',
  'bounds',
  'center',
  'className',
  'coordinate',
  'coordinates',
  'coords',
  'd',
  'href',
  'id',
  'key',
  'keyExtractor',
  'nativeID',
  'path',
  'points',
  'region',
  'source',
  'src',
  'style',
  'testID',
  'transform',
  'uri',
  'url',
  'viewBox',
])

const isDisplayAttribute = (name) =>
  !!name &&
  !MACHINE_ATTRIBUTES.has(name) &&
  !/^on[A-Z]/.test(name) &&
  !name.startsWith('data-')

// Structural key is `file::binding::reason`, never a line number. Keep this
// list small and explained: an entry is a promise that the value is not a
// locale-formatted user-visible number. Stale entries fail the guard.
const MAX_ALLOWLIST_ENTRIES = 4
const ALLOWLIST = Object.freeze({})

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const parseSource = (filePath, content) =>
  ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )

const shouldIgnoreDir = (name) => IGNORED_DIRS.has(name) || name.startsWith('dist-')

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
      if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue
      if (entry.name.endsWith('.d.ts') || entry.name.includes('.test.')) continue
      files.push(normalizePath(path.relative(rootDir, absolute)))
    }
  }
  for (const directory of SCAN_DIRS) walk(path.join(rootDir, directory))
  return files.sort()
}

/**
 * Flat dotted key -> the RU strings it can resolve to. Namespaces are dropped:
 * `t('travel:a.b.c')` and a namespaced `t('a.b.c')` from `useTranslation` are
 * the same key here, and the generated keys carry a content hash, so a bare
 * path is unique in practice. Several strings under one key mean the guard
 * checks all of them.
 */
const collectTranslationCatalogue = (rootDir) => {
  const catalogue = new Map()
  const localeRoot = path.join(rootDir, TRANSLATION_CATALOGUE_DIR)
  if (!fs.existsSync(localeRoot)) return catalogue

  const remember = (key, value) => {
    if (!catalogue.has(key)) catalogue.set(key, new Set())
    catalogue.get(key).add(value)
  }

  const readObject = (objectLiteral, prefix) => {
    for (const property of objectLiteral.properties) {
      if (!ts.isPropertyAssignment(property)) continue
      const name = ts.isIdentifier(property.name)
        ? property.name.text
        : ts.isStringLiteral(property.name)
          ? property.name.text
          : null
      if (name === null) continue
      const key = prefix ? `${prefix}.${name}` : name
      const initializer = unwrapDown(property.initializer)
      if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)) {
        remember(key, initializer.text)
      } else if (ts.isObjectLiteralExpression(initializer)) {
        readObject(initializer, key)
      }
    }
  }

  const walk = (dirPath) => {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const absolute = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        walk(absolute)
        continue
      }
      if (!entry.isFile() || path.extname(entry.name) !== '.ts') continue
      const sourceFile = parseSource(absolute, fs.readFileSync(absolute, 'utf8'))
      const visit = (node) => {
        if (ts.isVariableDeclaration(node) && node.initializer) {
          const initializer = unwrapDown(node.initializer)
          if (ts.isObjectLiteralExpression(initializer)) readObject(initializer, '')
        }
        ts.forEachChild(node, visit)
      }
      visit(sourceFile)
    }
  }
  walk(localeRoot)
  return catalogue
}

const translationTexts = (catalogue, key) => {
  const bare = key.includes(':') ? key.slice(key.indexOf(':') + 1) : key
  return [...(catalogue.get(bare) ?? [])]
}

/**
 * The unit written right after the substitution — `км` in `{{value1}} км`. This
 * is the same question `hardcodedUnitSuffix` asks of a template literal, moved
 * to the place #1459 told call sites to put the unit.
 */
const unitAfterPlaceholder = (text, placeholder) => {
  const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`\\{\\{\\s*-?\\s*${escaped}\\s*(?:,[^}]*)?\\}\\}`, 'u').exec(text)
  if (!match) return null
  const suffix = UNIT_SUFFIX.exec(text.slice(match.index + match[0].length))
  return suffix ? suffix[1] : null
}

/** Named expressions in the file, so a value assembled one line earlier still reads. */
const collectLocalBindings = (sourceFile) => {
  const bindings = new Map()
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      // A name declared twice is ambiguous; the guard keeps the first shape it
      // saw rather than pretending the later one wins.
      if (!bindings.has(node.name.text)) bindings.set(node.name.text, node.initializer)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return bindings
}

/** Did this value come out of the locale layer, or is it a raw number? */
const isLocaleFormatted = (node, bindings, seen = new Set()) => {
  const current = unwrapDown(node)
  if (!current) return false
  if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) return true
  if (ts.isTemplateExpression(current)) {
    // A template is only formatted if every substitution already is: `` `${km}` ``
    // just stringifies a raw number and would print the English «12.6» this shape
    // is here to catch.
    return current.templateSpans.every((span) =>
      isLocaleFormatted(span.expression, bindings, seen),
    )
  }
  if (ts.isCallExpression(current)) return LOCALE_FORMAT_CALLEES.has(calleeName(current) ?? '')
  if (ts.isConditionalExpression(current)) {
    return (
      isLocaleFormatted(current.whenTrue, bindings, seen) &&
      isLocaleFormatted(current.whenFalse, bindings, seen)
    )
  }
  if (
    ts.isBinaryExpression(current) &&
    (current.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      current.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    return (
      isLocaleFormatted(current.left, bindings, seen) &&
      isLocaleFormatted(current.right, bindings, seen)
    )
  }
  if (ts.isIdentifier(current)) {
    if (seen.has(current.text)) return false
    seen.add(current.text)
    const binding = bindings.get(current.text)
    return binding ? isLocaleFormatted(binding, bindings, seen) : false
  }
  return false
}

const isToFixedCall = (node) =>
  ts.isCallExpression(node) &&
  ts.isPropertyAccessExpression(node.expression) &&
  node.expression.name.text === 'toFixed'

const fractionDigits = (node) => {
  const [argument] = node.arguments
  if (!argument) return 0
  if (ts.isNumericLiteral(argument)) return Number(argument.text)
  // A non-literal precision is a configurable formatter (coordinates, map
  // snapshots); it is not the fixed 1-digit display shape this guard owns.
  return Number.POSITIVE_INFINITY
}

const receiverText = (node) => {
  try {
    return node.expression.expression.getText()
  } catch {
    return ''
  }
}

const isCoordinateReceiver = (node) => COORDINATE_RECEIVER.test(receiverText(node))

const unwrapUp = (node) => {
  let current = node
  while (
    current.parent &&
    (ts.isParenthesizedExpression(current.parent) || ts.isAsExpression(current.parent))
  ) {
    current = current.parent
  }
  return current
}

const unwrapDown = (node) => {
  let current = node
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isNonNullExpression(current))
  ) {
    current = current.expression
  }
  return current
}

/** Is the expression a number the code just computed, rather than a ready label? */
const isComputedNumber = (node) => {
  const current = unwrapDown(node)
  if (!current) return false
  if (ts.isNumericLiteral(current)) return true
  if (isToFixedCall(current)) return true
  if (ts.isCallExpression(current)) return NUMERIC_CALLEES.has(calleeName(current) ?? '')
  if (ts.isBinaryExpression(current)) {
    const arithmetic = [
      ts.SyntaxKind.SlashToken,
      ts.SyntaxKind.AsteriskToken,
      ts.SyntaxKind.MinusToken,
      ts.SyntaxKind.PercentToken,
    ]
    if (arithmetic.includes(current.operatorToken.kind)) return true
    // `a ?? 0` / `a || 0` keep whatever the left side was.
    return isComputedNumber(current.left) || isComputedNumber(current.right)
  }
  if (ts.isConditionalExpression(current)) {
    return isComputedNumber(current.whenTrue) || isComputedNumber(current.whenFalse)
  }
  if (ts.isPropertyAccessExpression(current)) return NUMERIC_NAME.test(current.name.text)
  if (ts.isIdentifier(current)) return NUMERIC_NAME.test(current.text)
  return false
}

/** `${x.toFixed(1)} км` / `x.toFixed(1) + ' K'` — the unit is hardcoded. */
const hardcodedUnitSuffix = (node) => {
  const outer = unwrapUp(node)
  const parent = outer.parent
  if (!parent) return null
  if (ts.isTemplateSpan(parent) && parent.expression === outer) {
    const match = UNIT_SUFFIX.exec(parent.literal.text)
    return match ? match[1] : null
  }
  if (
    ts.isBinaryExpression(parent) &&
    parent.operatorToken.kind === ts.SyntaxKind.PlusToken &&
    parent.left === outer &&
    (ts.isStringLiteral(parent.right) || ts.isNoSubstitutionTemplateLiteral(parent.right))
  ) {
    const match = UNIT_SUFFIX.exec(parent.right.text)
    return match ? match[1] : null
  }
  return null
}

/** Text written right before the substitution — `PT` in `PT${minutes}M`. */
const followsIsoDuration = (span) => {
  const template = span.parent
  if (!template || !ts.isTemplateExpression(template)) return false
  const index = template.templateSpans.indexOf(span)
  const before = index <= 0 ? template.head.text : template.templateSpans[index - 1].literal.text
  return ISO_DURATION_PREFIX.test(before)
}

const jsxAttributeName = (node) => {
  if (!ts.isJsxAttribute(node)) return null
  return ts.isIdentifier(node.name) ? node.name.text : node.name?.getText?.() ?? null
}

const calleeName = (node) => {
  const expression = node.expression
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text
  return null
}

/** The call sits directly inside JSX text, a display attribute or a translation argument. */
const isDirectlyDisplayed = (node) => {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isJsxExpression(current) && current.parent) {
      if (ts.isJsxElement(current.parent) || ts.isJsxFragment(current.parent)) return 'jsx-text'
      if (ts.isJsxAttribute(current.parent)) {
        return isDisplayAttribute(jsxAttributeName(current.parent)) ? 'jsx-attribute' : null
      }
    }
    if (ts.isCallExpression(current) && TRANSLATION_CALLEES.has(calleeName(current) ?? '')) {
      return 'translation-argument'
    }
    if (ts.isJsxAttribute(current)) {
      return isDisplayAttribute(jsxAttributeName(current)) ? 'jsx-attribute' : null
    }
  }
  return null
}

/** Innermost named binding the call belongs to — the unit a reviewer reads. */
const enclosingBinding = (node) => {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) return current.name.text
    if ((ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current)) && current.name) {
      return current.name.getText()
    }
    if (ts.isPropertyAssignment(current) && ts.isIdentifier(current.name)) return current.name.text
  }
  return null
}

/**
 * Names that reach a display position in this file: an identifier rendered as
 * JSX text, passed to a translation call or to a display attribute — including
 * the callee of `{formatRating(value)}`. A `.toFixed()` inside the binding of
 * such a name is displayed through one hop.
 */
const collectDisplayNames = (sourceFile) => {
  const names = new Set()

  const identifiersIn = (node, sink = new Set()) => {
    if (!node) return sink
    if (ts.isIdentifier(node)) {
      sink.add(node.text)
      return sink
    }
    if (ts.isPropertyAccessExpression(node)) return identifiersIn(node.expression, sink)
    // The callback must not return a value: `forEachChild` stops at the first
    // truthy result and would visit only the first child.
    ts.forEachChild(node, (child) => {
      identifiersIn(child, sink)
    })
    return sink
  }

  const harvest = (node) => {
    for (const name of identifiersIn(node)) names.add(name)
  }

  const visit = (node) => {
    if (ts.isJsxExpression(node) && node.expression && node.parent) {
      if (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) harvest(node.expression)
    }
    if (ts.isJsxAttribute(node) && isDisplayAttribute(jsxAttributeName(node))) {
      harvest(node.initializer)
    }
    if (ts.isCallExpression(node) && TRANSLATION_CALLEES.has(calleeName(node) ?? '')) {
      for (const argument of node.arguments) harvest(argument)
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  // One value can be assembled before it is printed: `const label = `★ ${raw}``
  // shows `raw` too. Aliases are followed to a fixpoint, but only through plain
  // expressions — harvesting a component or `useMemo` body would declare half
  // the file displayed.
  const aliases = new Map()
  const collectAliases = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      !ts.isFunctionExpression(node.initializer) &&
      !ts.isArrowFunction(node.initializer) &&
      !ts.isCallExpression(node.initializer)
    ) {
      aliases.set(node.name.text, identifiersIn(node.initializer))
    }
    ts.forEachChild(node, collectAliases)
  }
  collectAliases(sourceFile)

  const pending = [...names]
  while (pending.length > 0) {
    const current = pending.pop()
    for (const referenced of aliases.get(current) ?? []) {
      if (names.has(referenced)) continue
      names.add(referenced)
      pending.push(referenced)
    }
  }

  return names
}

const findingKey = ({ filePath, binding, reason }) =>
  [filePath, binding || 'module-scope', reason].join('::')

const scanFile = ({ filePath, content, catalogue = new Map() }) => {
  const sourceFile = parseSource(filePath, content)
  const displayNames = collectDisplayNames(sourceFile)
  const localBindings = collectLocalBindings(sourceFile)
  const findingsByKey = new Map()
  let toFixedCount = 0
  let unitPlaceholderCount = 0

  const record = (node, { reason, detail, binding }) => {
    const key = findingKey({ filePath, binding, reason })
    if (findingsByKey.has(key)) return
    findingsByKey.set(key, {
      key,
      file: filePath,
      line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
      binding: binding || 'module-scope',
      reason,
      detail,
    })
  }

  const recordUnitSuffix = (expression, suffix) => {
    record(expression, {
      reason: 'manual-unit-suffix',
      detail: `hardcoded suffix "${suffix.trim()}"`,
      binding: enclosingBinding(expression),
    })
  }

  const visit = (node) => {
    if (isToFixedCall(node)) {
      toFixedCount += 1
      // A `toFixed` with a hardcoded unit is reported by the suffix pass below;
      // reporting it twice would only split one defect across two keys.
      if (
        !hardcodedUnitSuffix(node) &&
        !isCoordinateReceiver(node) &&
        fractionDigits(node) <= MAX_DISPLAY_FRACTION_DIGITS
      ) {
        const binding = enclosingBinding(node)
        const directReason = isDirectlyDisplayed(node)
        if (directReason) {
          record(node, { reason: 'display-toFixed', detail: directReason, binding })
        } else if (binding && displayNames.has(binding)) {
          record(node, { reason: 'display-toFixed', detail: `via ${binding}`, binding })
        }
      }
    }

    // `${Math.round(km)} км` / `count + ' K'` — the number itself may come from
    // anywhere, the hardcoded unit is the defect.
    if (ts.isTemplateSpan(node)) {
      const suffix = UNIT_SUFFIX.exec(node.literal.text)
      if (suffix && isComputedNumber(node.expression) && !followsIsoDuration(node)) {
        recordUnitSuffix(node.expression, suffix[1])
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
      (ts.isStringLiteral(node.right) || ts.isNoSubstitutionTemplateLiteral(node.right))
    ) {
      const suffix = UNIT_SUFFIX.exec(node.right.text)
      if (suffix && isComputedNumber(node.left)) recordUnitSuffix(node.left, suffix[1])
    }

    // `i18nT('… {{value1}} км', { value1: round(km) })` — the unit obeys #1459
    // and the number still prints English.
    if (ts.isCallExpression(node) && TRANSLATION_CALLEES.has(calleeName(node) ?? '')) {
      recordTranslationArguments(node)
    }

    ts.forEachChild(node, visit)
  }

  const recordTranslationArguments = (call) => {
    const [keyArgument, ...rest] = call.arguments
    if (
      !keyArgument ||
      !(ts.isStringLiteral(keyArgument) || ts.isNoSubstitutionTemplateLiteral(keyArgument))
    ) {
      return
    }
    const texts = translationTexts(catalogue, keyArgument.text)
    if (texts.length === 0) return

    for (const argument of rest) {
      if (!ts.isObjectLiteralExpression(argument)) continue
      for (const property of argument.properties) {
        const isShorthand = ts.isShorthandPropertyAssignment(property)
        if (!isShorthand && !ts.isPropertyAssignment(property)) continue
        const placeholder = ts.isIdentifier(property.name)
          ? property.name.text
          : ts.isStringLiteral(property.name)
            ? property.name.text
            : null
        if (!placeholder || placeholder === PLURAL_SELECTOR_ARGUMENT) continue

        const unit = texts.map((text) => unitAfterPlaceholder(text, placeholder)).find(Boolean)
        if (!unit) continue
        unitPlaceholderCount += 1

        const value = isShorthand ? property.name : property.initializer
        if (isLocaleFormatted(value, localBindings)) continue

        const keyTail = keyArgument.text.split('.').pop()
        record(property, {
          reason: 'numeric-translation-argument',
          detail: `"${unit}" follows {{${placeholder}}} in ${keyTail}`,
          binding: `${enclosingBinding(call) ?? 'module-scope'}.${placeholder}@${keyTail}`,
        })
      }
    }
  }

  visit(sourceFile)

  return {
    toFixedCount,
    unitPlaceholderCount,
    displayNameCount: displayNames.size,
    findings: [...findingsByKey.values()].sort((left, right) => left.key.localeCompare(right.key)),
  }
}

const evaluateFindings = ({
  files,
  toFixedCount,
  displayNameCount,
  catalogueSize,
  unitPlaceholderCount,
  findings,
  allowlist = ALLOWLIST,
}) => {
  const allowlistKeys = Object.keys(allowlist)
  const findingKeys = new Set(findings.map((finding) => finding.key))
  const staleAllowlist = allowlistKeys.filter((key) => !findingKeys.has(key)).sort()
  const violations = findings.filter((finding) => !Object.hasOwn(allowlist, finding.key))
  const allowlisted = findings.filter((finding) => Object.hasOwn(allowlist, finding.key))
  // Each shape needs its own evidence that it actually looked at something: a
  // silent catalogue or a silent placeholder pass would make shape 3 pass by
  // scanning nothing, which is exactly how #1465 survived #1459.
  const vacuous =
    files === 0 ||
    toFixedCount === 0 ||
    displayNameCount === 0 ||
    catalogueSize === 0 ||
    unitPlaceholderCount === 0
  const allowlistTooLarge = allowlistKeys.length > MAX_ALLOWLIST_ENTRIES

  return {
    ok: !vacuous && !allowlistTooLarge && staleAllowlist.length === 0 && violations.length === 0,
    contractVersion: CONTRACT_VERSION,
    fileCount: files,
    toFixedCount,
    displayNameCount,
    catalogueSize,
    unitPlaceholderCount,
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

const scanLocaleNumberFormat = (rootDir, { allowlist = ALLOWLIST } = {}) => {
  const files = collectSourceFiles(rootDir)
  const catalogue = collectTranslationCatalogue(rootDir)
  const findings = []
  let toFixedCount = 0
  let displayNameCount = 0
  let unitPlaceholderCount = 0
  for (const filePath of files) {
    const result = scanFile({
      filePath,
      content: fs.readFileSync(path.join(rootDir, filePath), 'utf8'),
      catalogue,
    })
    toFixedCount += result.toFixedCount
    displayNameCount += result.displayNameCount
    unitPlaceholderCount += result.unitPlaceholderCount
    findings.push(...result.findings)
  }
  return evaluateFindings({
    files: files.length,
    toFixedCount,
    displayNameCount,
    catalogueSize: catalogue.size,
    unitPlaceholderCount,
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
  const result = scanLocaleNumberFormat(args.root)
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else if (result.ok) {
    process.stdout.write(
      `Locale number format guard passed. files=${result.fileCount} ` +
      `toFixed=${result.toFixedCount} unitPlaceholders=${result.unitPlaceholderCount} ` +
      `allowlisted=${result.allowlistedCount}\n`,
    )
  } else {
    process.stderr.write('Locale number format guard failed.\n')
    if (result.vacuous) {
      process.stderr.write(
        '- scan is vacuous; expected source files, toFixed calls, display positions, ' +
        'an RU catalogue and unit placeholders\n',
      )
    }
    if (result.allowlistTooLarge) {
      process.stderr.write(`- allowlist exceeds reviewed maximum (${MAX_ALLOWLIST_ENTRIES})\n`)
    }
    for (const key of result.staleAllowlist) process.stderr.write(`- stale allowlist entry: ${key}\n`)
    for (const finding of result.violations) {
      process.stderr.write(
        `- ${finding.file}:${finding.line} ${finding.binding} [${finding.reason}] ${finding.detail}\n`,
      )
    }
    if (result.violations.length > 0) {
      process.stderr.write(
        '- displayed numbers go through i18n/format.ts (formatNumber/formatInteger/' +
        'formatCompactNumber/formatCurrency) or utils/distanceCalculator.ts; units come from a ' +
        'translation key, not from a hardcoded suffix; a number handed to a translation ' +
        'placeholder that carries a unit must already be a formatted string\n',
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
  MAX_DISPLAY_FRACTION_DIGITS,
  ALLOWLIST,
  MACHINE_ATTRIBUTES,
  LOCALE_FORMAT_CALLEES,
  PLURAL_SELECTOR_ARGUMENT,
  TRANSLATION_CATALOGUE_DIR,
  isDisplayAttribute,
  parseSource,
  collectSourceFiles,
  collectDisplayNames,
  collectTranslationCatalogue,
  collectLocalBindings,
  unitAfterPlaceholder,
  isLocaleFormatted,
  isToFixedCall,
  isCoordinateReceiver,
  isComputedNumber,
  followsIsoDuration,
  hardcodedUnitSuffix,
  isDirectlyDisplayed,
  enclosingBinding,
  scanFile,
  evaluateFindings,
  scanLocaleNumberFormat,
  parseArgs,
  run,
}
