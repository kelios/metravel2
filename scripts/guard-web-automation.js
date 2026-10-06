'use strict'

const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const SOURCE_DIRS = ['app', 'components', 'hooks', 'utils', 'services', 'stores', 'api']
const CANONICAL_DETECTORS = new Set(['utils/isWebAutomation.ts', 'utils/analyticsInlineScript.ts'])
const ANALYTICS_HELPER = 'e2e/helpers/analytics.ts'
const PROVIDER_KEYS = new Set(['gtag', 'dataLayer', '__e2eAnalyticsEvents', '__metravelAnalyticsEventQueue', '__metravelAnalyticsIntents'])

function findViolations(source, file) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const declarations = new Map()
  const collect = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) declarations.set(node.name.text, node.initializer)
    ts.forEachChild(node, collect)
  }
  collect(tree)
  const literal = (node, seen = new Set()) => {
    if (!node) return null
    if (ts.isStringLiteralLike(node)) return node.text
    if (ts.isIdentifier(node) && declarations.has(node.text) && !seen.has(node.text)) return literal(declarations.get(node.text), new Set([...seen, node.text]))
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = literal(node.left, seen), right = literal(node.right, seen)
      return left !== null && right !== null ? left + right : null
    }
    return null
  }
  const violations = []
  const inspect = (node) => {
    let key = null
    if (ts.isPropertyAccessExpression(node)) key = node.name.text
    if (ts.isElementAccessExpression(node)) key = literal(node.argumentExpression)
    if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      const name = node.propertyName || node.name
      key = ts.isIdentifier(name) ? name.text : literal(name)
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      ['get', 'defineProperty', 'getOwnPropertyDescriptor'].includes(node.expression.name.text)) key = literal(node.arguments[1])
    const normalized = file.replace(/\\/g, '/')
    const rule = normalized.startsWith('e2e/')
      ? normalized !== ANALYTICS_HELPER && PROVIDER_KEYS.has(key) ? 'analytics-observation-outside-helper' : null
      : key === 'webdriver' && !CANONICAL_DETECTORS.has(normalized) ? 'noncanonical-webdriver-read' : null
    if (rule) violations.push({ file: normalized, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, rule })
    ts.forEachChild(node, inspect)
  }
  inspect(tree)
  return violations
}

function collectViolations(root = process.cwd()) {
  const violations = []
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(file)
      else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
        const relative = path.relative(root, file).split(path.sep).join('/')
        violations.push(...findViolations(fs.readFileSync(file, 'utf8'), relative))
      }
    }
  }
  for (const directory of [...SOURCE_DIRS, 'e2e']) visit(path.join(root, directory))
  return violations
}

if (require.main === module) {
  const violations = collectViolations()
  if (violations.length) {
    console.error('guard-web-automation failed:', JSON.stringify(violations, null, 2))
    process.exitCode = 1
  } else console.log('guard-web-automation ok (empty baseline; canonical detection and common analytics observation)')
}

module.exports = { findViolations, collectViolations }
