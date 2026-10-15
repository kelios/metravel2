#!/usr/bin/env node
// #2434: a pressable backdrop must be a sibling of its panel. Wrapping the
// panel in an accessible Pressable hides its controls from iOS VoiceOver.
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const OWNER = 'components/ui/BottomSheet.tsx'
const SCAN_DIRS = ['app', 'components', 'screens']

function findViolationsInSource(file, text) {
  if (file === OWNER) return []
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const pressables = new Set()
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== 'react-native') continue
    const clause = statement.importClause
    if (clause?.name) pressables.add(`${clause.name.text}.Pressable`)
    const bindings = clause?.namedBindings
    if (bindings && ts.isNamespaceImport(bindings)) pressables.add(`${bindings.name.text}.Pressable`)
    if (bindings && ts.isNamedImports(bindings)) {
      for (const item of bindings.elements) {
        if ((item.propertyName ?? item.name).text === 'Pressable') pressables.add(item.name.text)
      }
    }
  }
  const unwrap = (node) => {
    while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node))) node = node.expression
    return node
  }
  const noOp = (node) => {
    node = unwrap(node)
    return node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) &&
      ts.isBlock(node.body) && node.body.statements.length === 0
  }
  const violations = []
  const visit = (node, insidePressable = false) => {
    let inside = insidePressable
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const opening = ts.isJsxElement(node) ? node.openingElement : node
      if (pressables.has(opening.tagName.getText(source))) {
        const handler = opening.attributes.properties.find((item) => ts.isJsxAttribute(item) && item.name.getText(source) === 'onPress')
        if (handler) {
          if (insidePressable && handler.initializer && ts.isJsxExpression(handler.initializer) && noOp(handler.initializer.expression)) {
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
            violations.push(`${file}:${line + 1}: backdrop wraps a no-op Pressable panel; use BottomSheet or a sibling backdrop`)
          }
          inside = true
        }
      }
    }
    ts.forEachChild(node, (child) => visit(child, inside))
  }
  visit(source)
  return violations
}

function collectViolations(root = path.resolve(__dirname, '..')) {
  const violations = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.[jt]sx$/.test(entry.name)) {
        const rel = path.relative(root, full).split(path.sep).join('/')
        violations.push(...findViolationsInSource(rel, fs.readFileSync(full, 'utf8')))
      }
    }
  }
  for (const dir of SCAN_DIRS) {
    const full = path.join(root, dir)
    if (fs.existsSync(full)) walk(full)
  }
  return violations
}

if (require.main === module) {
  const violations = collectViolations()
  if (violations.length) {
    console.error(`guard:sheet-backdrop: ${violations.join('\n')}`)
    process.exitCode = 1
  } else console.log('guard:sheet-backdrop: ok')
}

module.exports = { findViolationsInSource, collectViolations }
