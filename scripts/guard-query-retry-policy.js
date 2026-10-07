'use strict'

const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const SOURCE_DIRS = ['app', 'components', 'hooks', 'screens', 'api', 'utils', 'services', 'stores']
const QUERY_CALLS = new Set(['useQuery', 'useInfiniteQuery', 'useQueries', 'queryOptions', 'infiniteQueryOptions', 'fetchQuery', 'prefetchQuery', 'fetchInfiniteQuery', 'prefetchInfiniteQuery'])
const COMMON_VALUES = new Set(['readRetryOnce', 'readRetryTwice', 'stravaReadRetryOnce', 'readRetryAtMost', 'heavyReadRetry'])
// Empty baseline: query overrides belong to the common policy, mutations are separate.

function findViolations(source, file) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const declarations = new Map(), common = new Map(), queryAliases = new Set(QUERY_CALLS)
  const queryNodes = new Set()
  const moduleIsCommon = (module) => module === '@/utils/queryRetryPolicy' ||
    (module.startsWith('.') && path.posix.normalize(path.posix.join(path.posix.dirname(file), module)).replace(/\.[cm]?[jt]s$/, '') === 'utils/queryRetryPolicy')
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const module = statement.moduleSpecifier.text, bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) for (const entry of bindings.elements) {
      const imported = (entry.propertyName || entry.name).text
      if (moduleIsCommon(module) && COMMON_VALUES.has(imported)) common.set(entry.name.text, imported)
      if (module === '@tanstack/react-query' && QUERY_CALLS.has(imported)) queryAliases.add(entry.name.text)
    }
  }
  const collect = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) declarations.set(node.name.text, node.initializer)
    if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node)
    ts.forEachChild(node, collect)
  }
  collect(tree)
  const callName = (node) => ts.isIdentifier(node) ? node.text : ts.isPropertyAccessExpression(node) ? node.name.text : ''
  const propertyName = (node) => {
    if (!node) return ''
    if (ts.isComputedPropertyName(node)) return ts.isStringLiteral(node.expression) ? node.expression.text : ''
    return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : ''
  }
  const mark = (node, seen = new Set()) => {
    if (!node || seen.has(node)) return
    seen.add(node)
    queryNodes.add(node)
    if (ts.isCallExpression(node) && callName(node.expression) === 'useMutation') return
    // Data/key/selector bodies may return objects with an unrelated UI `retry`.
    // They are not option factories; mapped useQueries factories still traverse.
    if (ts.isPropertyAssignment(node) && ['queryKey', 'queryFn', 'select', 'onSuccess', 'onError', 'onSettled'].includes(propertyName(node.name))) return
    if (ts.isIdentifier(node) && declarations.has(node.text)) mark(declarations.get(node.text), seen)
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && declarations.has(node.expression.text)) mark(declarations.get(node.expression.text), seen)
    ts.forEachChild(node, (child) => mark(child, seen))
  }
  const identify = (node) => {
    if (ts.isCallExpression(node) && queryAliases.has(callName(node.expression))) node.arguments.forEach((argument) => mark(argument))
    // Covers returned/exported factories, even before their consumer is imported.
    if (ts.isObjectLiteralExpression(node) && node.properties.some((p) => p.name && ['queryKey', 'queryFn'].includes(propertyName(p.name)))) mark(node)
    ts.forEachChild(node, identify)
  }
  identify(tree)
  const unwrap = (node) => ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) ? unwrap(node.expression) : node
  const allowed = (node) => {
    node = unwrap(node)
    if (node.kind === ts.SyntaxKind.FalseKeyword || (ts.isNumericLiteral(node) && node.text === '0')) return true
    if (ts.isIdentifier(node)) return common.has(node.text) && common.get(node.text) !== 'heavyReadRetry'
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'retry' && ts.isIdentifier(node.expression)) return common.get(node.expression.text) === 'heavyReadRetry'
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) return common.get(node.expression.text) === 'readRetryAtMost'
    if (ts.isConditionalExpression(node)) return allowed(node.whenTrue) && allowed(node.whenFalse)
    return false
  }
  const violations = []
  const inspect = (node) => {
    if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && propertyName(node.name) === 'retry' && queryNodes.has(node)) {
      let mutation = false
      for (let p = node.parent; p; p = p.parent) {
        if (ts.isCallExpression(p) && callName(p.expression) === 'useMutation') { mutation = true; break }
        if (ts.isCallExpression(p) && queryAliases.has(callName(p.expression))) break
      }
      const value = ts.isPropertyAssignment(node) ? node.initializer : node.name
      if (!mutation && !allowed(value)) violations.push({ file, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, rule: 'noncanonical-query-retry', value: value.getText(tree) })
    }
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
  SOURCE_DIRS.forEach((directory) => visit(path.join(root, directory)))
  return violations
}

if (require.main === module) {
  const violations = collectViolations()
  if (violations.length) {
    console.error('guard-query-retry-policy failed:', JSON.stringify(violations, null, 2))
    process.exitCode = 1
  } else console.log('guard-query-retry-policy ok (empty baseline; common bounded read policy)')
}
module.exports = { findViolations, collectViolations }
