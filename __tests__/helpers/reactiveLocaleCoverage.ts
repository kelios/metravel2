import ts from 'typescript'

// Independent inventory, deliberately not the Babel plugin's own classifier.
// Covers direct React render/hook owners and memo/forwardRef invocation boundaries.
export function expectedLocaleOwners(filename: string, source: string) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const owners: Array<{ name: string; line: number }> = []
  const reactNames = new Map<string, string>()
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== 'react') continue
    if (statement.importClause?.name) reactNames.set(statement.importClause.name.text, '*')
    const named = statement.importClause?.namedBindings
    if (named && ts.isNamedImports(named)) for (const specifier of named.elements) reactNames.set(specifier.name.text, (specifier.propertyName ?? specifier.name).text)
    if (named && ts.isNamespaceImport(named)) reactNames.set(named.name.text, '*')
  }
  const functionNode = (node: ts.Node): node is ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction =>
    ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)
  const ownEvidence = (body: ts.Node): boolean => {
    if (ts.isJsxElement(body) || ts.isJsxSelfClosingElement(body) || ts.isJsxFragment(body)) return true
    if (ts.isCallExpression(body)) {
      const called = ts.isIdentifier(body.expression) ? body.expression.text : ts.isPropertyAccessExpression(body.expression) ? body.expression.name.text : ''
      if (/^use[A-Z0-9]/.test(called) || called === 'createElement') return true
    }
    let found = false
    ts.forEachChild(body, node => { if (!functionNode(node) && ownEvidence(node)) found = true })
    return found
  }
  const walk = (node: ts.Node, inFunction = false) => {
    if (functionNode(node) && node.body) {
      const parent = node.parent
      const name = (!ts.isArrowFunction(node) ? node.name?.text : undefined) || (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) ? parent.name.text : 'anonymous')
      const call = ts.isCallExpression(parent) ? parent : null
      const called = call && (ts.isIdentifier(call.expression) ? reactNames.get(call.expression.text) :
        ts.isPropertyAccessExpression(call.expression) && ts.isIdentifier(call.expression.expression) && reactNames.get(call.expression.expression.text) === '*' ? call.expression.name.text : null)
      const wrapper = !!call && call.arguments[0] === node && ['memo', 'forwardRef'].includes(called ?? '')
      const customHook = /^use[A-Z0-9]/.test(name)
      const defaultExport = ts.isExportAssignment(parent) || !!node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)
      const owner = wrapper || !inFunction && (customHook || (/^[A-Z]/.test(name) || defaultExport) && ownEvidence(node.body))
      const worklet = ts.isBlock(node.body) && node.body.statements.some(statement => ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression) && statement.expression.text === 'worklet')
      const asyncFunction = !!node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword)
      if (owner && !worklet && !asyncFunction && !(('asteriskToken' in node) && node.asteriskToken)) owners.push({ name, line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1 })
      ts.forEachChild(node.body, child => walk(child, true))
      return
    }
    ts.forEachChild(node, child => walk(child, inFunction))
  }
  walk(file)
  return owners
}

// Independent TypeScript backstop for memoized local presentation factories.
// It follows their returned values/returned local containers, not every translated
// event inside a module. This intentionally does not use the Babel classifier.
export function expectedLocalPresentationMemos(filename: string, source: string, owners = expectedLocaleOwners(filename, source)) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const ownerLines = new Set(owners.map(owner => owner.line))
  const scopes = new Map<ts.Node, Map<string, ts.Node>>()
  const localeNames = new Set<string>()
  const reactNames = new Map<string, string>()
  const fn = (node: ts.Node): node is ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction =>
    ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)
  const scopeOf = (node: ts.Node) => {
    let parent = node.parent
    while (parent && !ts.isBlock(parent) && !ts.isSourceFile(parent) && !fn(parent)) parent = parent.parent
    return parent ?? file
  }
  const bind = (scope: ts.Node, name: string, node: ts.Node) => {
    const bindings = scopes.get(scope) ?? new Map<string, ts.Node>()
    bindings.set(name, node); scopes.set(scope, bindings)
  }
  const collect = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const named = node.importClause?.namedBindings
      if (named && ts.isNamedImports(named)) for (const specifier of named.elements) {
        if (/^@\/i18n(?:\/|$)/.test(node.moduleSpecifier.text)) localeNames.add(specifier.name.text)
        if (node.moduleSpecifier.text === 'react') reactNames.set(specifier.name.text, (specifier.propertyName ?? specifier.name).text)
      }
      if (node.moduleSpecifier.text === 'react') {
        if (node.importClause?.name) reactNames.set(node.importClause.name.text, '*')
        if (named && ts.isNamespaceImport(named)) reactNames.set(named.name.text, '*')
      }
    }
    if (ts.isFunctionDeclaration(node) && node.name) bind(scopeOf(node), node.name.text, node)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) bind(scopeOf(node), node.name.text, node)
    if (fn(node)) for (const parameter of node.parameters) if (ts.isIdentifier(parameter.name)) bind(node, parameter.name.text, parameter)
    ts.forEachChild(node, collect)
  }
  collect(file)
  const lookup = (identifier: ts.Identifier) => {
    let parent: ts.Node | undefined = identifier.parent
    while (parent) {
      const binding = scopes.get(parent)?.get(identifier.text)
      if (binding) return binding
      parent = parent.parent
    }
    return undefined
  }
  const functionFor = (node: ts.Node | undefined, seen = new Set<ts.Node>()): ReturnType<typeof resolveFunction> => resolveFunction(node, seen)
  function resolveFunction(node: ts.Node | undefined, seen: Set<ts.Node>): ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | undefined {
    if (!node || seen.has(node)) return undefined
    seen.add(node)
    if (fn(node)) return node
    if (ts.isVariableDeclaration(node)) return resolveFunction(node.initializer, seen)
    if (ts.isIdentifier(node)) return resolveFunction(lookup(node), seen)
    return undefined
  }
  const functionLocalized = (node: ReturnType<typeof functionFor>, seen: Set<ts.Node>): boolean => {
    if (!node?.body || node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.AsyncKeyword) || !ts.isArrowFunction(node) && node.name && /^use[A-Z0-9]/.test(node.name.text)) return false
    if (ts.isBlock(node.body) && node.body.statements.some(statement => ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression) && statement.expression.text === 'worklet')) return false
    if (!ts.isBlock(node.body)) return localized(node.body, seen)
    let result = false
    const returns = (child: ts.Node) => {
      if (fn(child)) return
      if (ts.isReturnStatement(child) && child.expression && localized(child.expression, seen)) result = true
      ts.forEachChild(child, returns)
    }
    ts.forEachChild(node.body, returns)
    return result
  }
  const localized = (node: ts.Node | undefined, seen: Set<ts.Node>): boolean => {
    if (!node || fn(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) return false
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) return localized(node.expression, seen)
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (localeNames.has(node.expression.text)) return true
      if (/^use[A-Z0-9]/.test(node.expression.text)) return false
      const binding = lookup(node.expression)
      if (binding && !seen.has(binding)) {
        seen.add(binding)
        return functionLocalized(functionFor(binding), seen)
      }
      return false
    }
    if (ts.isIdentifier(node)) {
      const parent = node.parent
      if (ts.isPropertyAssignment(parent) && parent.name === node || ts.isPropertyAccessExpression(parent) && parent.name === node) return false
      const binding = lookup(node)
      if (!binding || seen.has(binding) || !ts.isVariableDeclaration(binding)) return false
      seen.add(binding)
      if (localized(binding.initializer, seen)) return true
      let written = false
      const writes = (child: ts.Node) => {
        if (fn(child)) return
        if (ts.isCallExpression(child) && ts.isPropertyAccessExpression(child.expression) &&
          ts.isIdentifier(child.expression.expression) && lookup(child.expression.expression) === binding &&
          ['push', 'unshift', 'splice'].includes(child.expression.name.text) && child.arguments.some(argument => localized(argument, seen))) written = true
        if (ts.isBinaryExpression(child) && child.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(child.left) &&
          ts.isIdentifier(child.left.expression) && lookup(child.left.expression) === binding && localized(child.right, seen)) written = true
        ts.forEachChild(child, writes)
      }
      const scope = scopeOf(binding)
      ts.forEachChild(scope, writes)
      return written
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      let object = node.expression
      while (ts.isPropertyAccessExpression(object) || ts.isElementAccessExpression(object)) object = object.expression
      const binding = ts.isIdentifier(object) ? lookup(object) : undefined
      if (binding && ts.isVariableDeclaration(binding) && binding.initializer) {
        let getterValue = false
        const getters = (child: ts.Node) => {
          if (ts.isGetAccessorDeclaration(child) && child.body) {
            for (const statement of child.body.statements) if (ts.isReturnStatement(statement) && localized(statement.expression, seen)) getterValue = true
            return
          }
          ts.forEachChild(child, getters)
        }
        getters(binding.initializer)
        if (getterValue) return true
      }
    }
    let result = false
    ts.forEachChild(node, child => {
      if (fn(child)) {
        const parent = child.parent
        if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && ['map', 'flatMap', 'filter', 'reduce', 'sort'].includes(parent.expression.name.text) && functionLocalized(child, seen)) result = true
      } else if (localized(child, seen)) result = true
    })
    return result
  }
  const memos: Array<{ line: number; kind: string }> = []
  const walk = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const kind = ts.isIdentifier(node.expression) ? reactNames.get(node.expression.text) :
        ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression) && reactNames.get(node.expression.expression.text) === '*' ? node.expression.name.text : undefined
      if (kind === 'useMemo' || kind === 'useCallback') {
        let parent = node.parent
        let owned = false
        while (parent) {
          if (fn(parent) && ownerLines.has(file.getLineAndCharacterOfPosition(parent.getStart()).line + 1)) owned = true
          parent = parent.parent
        }
        const callback = functionFor(node.arguments[0])
        if (owned && callback && functionLocalized(callback, new Set()) && node.arguments[1] && ts.isArrayLiteralExpression(node.arguments[1])) {
          memos.push({ line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1, kind })
        }
      }
    }
    ts.forEachChild(node, walk)
  }
  walk(file)
  return memos
}
