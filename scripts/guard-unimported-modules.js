#!/usr/bin/env node
'use strict'

// #2260: read-only module graph and immutable first-introduction debt boundary.
const fs = require('node:fs')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const ts = require('typescript')
const crypto = require('node:crypto')

const BASELINE_PATH = 'scripts/unimported-modules-baseline.json'
// Bootstrap checkpoint: populated ONLY after independent review and first ledger commit.
const INITIAL_AUTHORITY = Object.freeze({ commit: null, blob: null })
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js', '.jsx', '.cjs']
const CANDIDATE_DIRS = new Set(['api', 'app', 'components', 'context', 'hooks', 'screens', 'services', 'stores', 'utils', 'constants', 'types', 'styles'])
const OMIT_DIRS = new Set(['node_modules', '.git', '.expo', '.codex-temp', '.codex-debug', '__tests__', '__mocks__', 'e2e', 'coverage', 'dist', 'build', 'test-results', 'playwright-report', '__pycache__'])
const RUNNER_MODULES = new Set(['jest.config.js', 'jest.expo-globals.js', 'playwright.config.js'])
const normalizedConfig = (file) => file.replace(/\.(?:ts|tsx|mjs|cjs)$/, '.js')
const CONFIG_ENTRIES = Object.freeze({
  'entry.js': 'package.json application entry',
  'metro.config.js': 'Metro configuration entry',
  'babel.config.js': 'Babel configuration entry',
  'app.config.js': 'Expo application configuration entry',
  'eslint.config.js': 'Executable source lint configuration',
})
const posix = (value) => value.split(path.sep).join('/')
const ASSET_EXTENSIONS = new Set(['.json', '.css', '.scss', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.ttf', '.otf', '.woff', '.woff2', '.mp4', '.mp3', '.wasm'])
const sourcePath = (value) => SOURCE_EXTENSIONS.some((extension) => value.endsWith(extension))
const excluded = (value) => value.split('/').some((part) => OMIT_DIRS.has(part)) || /(?:^|\/)[^/]+\.(?:test|spec)\.[^/]+$/.test(value)
const localSpecifier = (value) => value.startsWith('.') || value.startsWith('@/') || value.startsWith('/')
const sorted = (values) => [...values].sort()
const diagnostic = (kind, message) => ({ kind, message })

function confinedFile(root, relative) {
  const absolute = path.resolve(root, relative)
  if (!absolute.startsWith(root + path.sep)) return false
  try {
    const real = fs.realpathSync(absolute)
    return real.startsWith(root + path.sep) && fs.statSync(absolute).isFile()
  } catch { return false }
}

function inventory(root) {
  const files = []
  function walk(relative) {
    for (const item of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const name = relative ? `${relative}/${item.name}` : item.name
      if (excluded(name)) continue
      if (item.isSymbolicLink()) {
        if (sourcePath(name)) {
          if (!confinedFile(root, name)) throw new Error(`invalid-policy: source symlink escapes repository: ${name}`)
          files.push(name)
        }
        continue
      }
      if (item.isDirectory()) walk(name)
      else if (sourcePath(name)) files.push(name)
    }
  }
  for (const dir of sorted(new Set([...CANDIDATE_DIRS, 'scripts']))) {
    const absolute = path.join(root, dir)
    if (!fs.existsSync(absolute)) continue
    const metadata = fs.lstatSync(absolute)
    const real = fs.realpathSync(absolute)
    if (!real.startsWith(root + path.sep) || (!metadata.isDirectory() && (!metadata.isSymbolicLink() || !fs.statSync(absolute).isDirectory()))) throw new Error(`invalid-policy: source directory missing containment: ${dir}`)
    // Confined directory aliases retain their repository path identity.
    walk(dir)
  }
  for (const item of fs.readdirSync(root, { withFileTypes: true })) {
    if (!sourcePath(item.name) || excluded(item.name) || RUNNER_MODULES.has(normalizedConfig(item.name))) continue
    if (item.isSymbolicLink() && !confinedFile(root, item.name)) throw new Error(`invalid-policy: source symlink escapes repository: ${item.name}`)
    if (item.isFile() || item.isSymbolicLink()) files.push(item.name)
  }
  return sorted(new Set(files))
}

const hoistedVariables = new WeakMap()
function hoistedVariable(scope, name) {
  if (!hoistedVariables.has(scope)) {
    const declarations = new Map()
    const collectNames = (pattern, declaration) => {
      if (ts.isIdentifier(pattern)) declarations.set(pattern.text, declaration)
      else if (ts.isObjectBindingPattern(pattern) || ts.isArrayBindingPattern(pattern)) {
        for (const element of pattern.elements) if (ts.isBindingElement(element)) collectNames(element.name, declaration)
      }
    }
    const visit = (node) => {
      if (node !== scope && ts.isFunctionLike(node)) return
      if (node !== scope && (ts.isClassStaticBlockDeclaration(node) || ts.isModuleDeclaration(node))) return
      if (ts.isVariableDeclarationList(node) && !(node.flags & ts.NodeFlags.BlockScoped)) {
        for (const declaration of node.declarations) collectNames(declaration.name, declaration)
      }
      ts.forEachChild(node, visit)
    }
    visit(scope)
    hoistedVariables.set(scope, declarations)
  }
  const node = hoistedVariables.get(scope).get(name)
  return node ? { node, scope, immutable: false } : null
}

// Resolve lexical declarations without building a typechecker or executing source.
function lexicalBinding(identifier) {
  const name = identifier.text
  const names = (node) => ts.isIdentifier(node) ? node.text === name : (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) && node.elements.some((element) => ts.isBindingElement(element) && names(element.name))
  let scope = identifier.parent
  while (scope) {
    if (ts.isFunctionLike(scope)) {
      const parameter = scope.parameters.find((item) => names(item.name))
      if (parameter) return { node: parameter, scope, parameter: true }
      if (scope.name && names(scope.name)) return { node: scope, scope, function: true }
      const hoisted = hoistedVariable(scope, name)
      if (hoisted) return hoisted
    }
    if (ts.isClassStaticBlockDeclaration(scope)) {
      const hoisted = hoistedVariable(scope, name)
      if (hoisted) return hoisted
    }
    if (ts.isCatchClause(scope) && scope.variableDeclaration && names(scope.variableDeclaration.name)) return { node: scope.variableDeclaration, scope }
    if ((ts.isForStatement(scope) || ts.isForInStatement(scope) || ts.isForOfStatement(scope)) && scope.initializer && ts.isVariableDeclarationList(scope.initializer)) {
      const declaration = scope.initializer.declarations.find((item) => names(item.name))
      if (declaration) return { node: declaration, scope, immutable: Boolean(scope.initializer.flags & ts.NodeFlags.Const) }
    }
    if (ts.isBlock(scope) || ts.isSourceFile(scope)) {
      for (const statement of scope.statements) {
        if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name) && declaration.name.text === name) return { node: declaration, scope, immutable: Boolean(statement.declarationList.flags & ts.NodeFlags.Const) }
          if (ts.isObjectBindingPattern(declaration.name)) for (const binding of declaration.name.elements) if (ts.isIdentifier(binding.name) && binding.name.text === name) return { node: declaration, scope, immutable: Boolean(statement.declarationList.flags & ts.NodeFlags.Const), binding }
          if (names(declaration.name)) return { node: declaration, scope, immutable: Boolean(statement.declarationList.flags & ts.NodeFlags.Const) }
        }
        if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) return { node: statement, scope, function: true }
        if (ts.isClassDeclaration(statement) && statement.name?.text === name) return { node: statement, scope }
        if (ts.isImportEqualsDeclaration(statement) && statement.name.text === name) return { node: statement, scope, immutable: true }
        if (ts.isImportDeclaration(statement) && statement.importClause) {
          const clause = statement.importClause
          if (clause.name?.text === name) return { node: statement, scope, immutable: true }
          if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings) && clause.namedBindings.name.text === name) return { node: statement, scope, immutable: true }
          if (clause.namedBindings && ts.isNamedImports(clause.namedBindings) && clause.namedBindings.elements.some((element) => element.name.text === name)) return { node: statement, scope, immutable: true }
        }
      }
      if (ts.isSourceFile(scope)) {
        const hoisted = hoistedVariable(scope, name)
        if (hoisted) return hoisted
      }
    }
    scope = scope.parent
  }
  return null
}

function isCall(node, name) {
  if (!node || !ts.isCallExpression(node) || node.expression.getText().replace(/\s/g, '') !== name) return false
  if (name === 'require' || name === 'require.resolve') {
    const loader = name === 'require' ? node.expression : node.expression.expression
    if (lexicalBinding(loader) || !unmodified(loader)) return false
  }
  return true
}
function unwrap(node) {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node))) node = node.expression
  return node
}
function importedPath(node) {
  if (ts.isIdentifier(node)) {
    const binding = lexicalBinding(node)
    if (!binding?.immutable || !unmodified(node, binding)) return false
    const declaration = binding.node
    if (ts.isImportDeclaration(declaration)) {
      const clause = declaration.importClause
      const namespace = clause?.namedBindings
      return ['path', 'node:path'].includes(declaration.moduleSpecifier.text) && (clause?.name?.text === node.text || (namespace && ts.isNamespaceImport(namespace) && namespace.name.text === node.text))
    }
    return ts.isIdentifier(declaration.name) && isCall(declaration.initializer, 'require') && ts.isStringLiteralLike(declaration.initializer.arguments[0]) && ['path', 'node:path'].includes(declaration.initializer.arguments[0].text)
  }
  return isCall(node, 'require') && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0]) && ['path', 'node:path'].includes(node.arguments[0].text)
}
function cwdCall(node) { return isCall(node, 'process.cwd') && node.arguments.length === 0 && !lexicalBinding(node.expression.expression) && unmodified(node.expression.expression, null, 'cwd') }
function pathCall(node, method) { return ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === method && importedPath(node.expression.expression) }
const mutationCache = new WeakMap()
function unmodified(identifier, binding, protectedProperty) {
  const scope = binding?.scope || identifier.getSourceFile()
  if (!mutationCache.has(scope)) mutationCache.set(scope, new Map())
  const cached = mutationCache.get(scope)
  const key = `${binding?.node.pos ?? 'global'}:${identifier.text}:${protectedProperty || ''}`
  if (cached.has(key)) return cached.get(key)
  let written = false
  function visit(node) {
    let target
    if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) target = node.left
    if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)) target = node.operand
    let property
    while (target && (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target))) {
      property = ts.isPropertyAccessExpression(target) ? target.name.text : ts.isStringLiteralLike(target.argumentExpression) ? target.argumentExpression.text : '*'
      target = target.expression
    }
    if ((!protectedProperty || !property || property === '*' || property === protectedProperty) && target && ts.isIdentifier(target) && target.text === identifier.text && lexicalBinding(target)?.node === binding?.node) written = true
    ts.forEachChild(node, visit)
  }
  visit(scope)
  cached.set(key, !written)
  return !written
}
function argvDerived(node, seen = new Set()) {
  node = unwrap(node)
  if (ts.isPropertyAccessExpression(node) && node.name.text === 'argv' && ts.isIdentifier(node.expression) && node.expression.text === 'process') return !lexicalBinding(node.expression) && unmodified(node.expression, null, 'argv')
  if (ts.isIdentifier(node)) {
    const binding = lexicalBinding(node)
    if (!binding?.immutable || !binding.node.initializer || seen.has(binding.node) || !unmodified(node, binding)) return false
    seen.add(binding.node)
    return argvDerived(binding.node.initializer, seen)
  }
  if (ts.isElementAccessExpression(node)) return argvDerived(node.expression, seen)
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ['slice', 'find'].includes(node.expression.name.text)) return argvDerived(node.expression.expression, seen)
  return false
}
function argvGetter(declaration) {
  if (!declaration?.body) return false
  const returns = []
  function visit(node) {
    if (node !== declaration && ts.isFunctionLike(node)) return
    if (ts.isReturnStatement(node)) returns.push(node.expression)
    ts.forEachChild(node, visit)
  }
  visit(declaration)
  function validReturn(node) {
    if (!node) return false
    node = unwrap(node)
    if (argvDerived(node)) return true
    if (ts.isConditionalExpression(node)) return validReturn(node.whenTrue) && validReturn(node.whenFalse)
    if (ts.isIdentifier(node)) return Boolean(lexicalBinding(node)?.parameter)
    return ts.isStringLiteralLike(node) && node.text === ''
  }
  return returns.length > 0 && returns.every(validReturn) && returns.some((node) => {
    node = unwrap(node)
    return argvDerived(node) || (ts.isConditionalExpression(node) && (argvDerived(node.whenTrue) || argvDerived(node.whenFalse)))
  })
}
function operatorInput(node, seen = new Set()) {
  node = unwrap(node)
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
    const binding = lexicalBinding(node.expression)
    const init = binding?.node.initializer
    if (!binding?.immutable || !unmodified(node.expression, binding) || !isCall(init, 'parseCliArgs') || init.arguments.length !== 2 || init.arguments[0].getText() !== 'process.argv' || lexicalBinding(init.arguments[0].expression) || !unmodified(init.arguments[0].expression, null, 'argv')) return false
    const parser = lexicalBinding(init.expression)
    if (!parser?.binding || (parser.binding.propertyName?.text || parser.binding.name.text) !== 'parseCliArgs' || !unmodified(init.expression, parser) || !isCall(parser.node.initializer, 'require') || !ts.isStringLiteralLike(parser.node.initializer.arguments[0])) return false
    const specifier = parser.node.initializer.arguments[0].text
    return specifier.startsWith('.') && path.posix.normalize(path.posix.join(path.posix.dirname(node.getSourceFile().fileName), specifier)).replace(/\.js$/, '') === 'scripts/lib/cli-contract'
  }
  if (!ts.isIdentifier(node)) return false
  const binding = lexicalBinding(node)
  if (!binding || seen.has(binding.node) || !unmodified(node, binding)) return false
  if (binding.parameter) return true
  if (!binding.immutable || !binding.node.initializer) return false
  seen.add(binding.node)
  const init = unwrap(binding.node.initializer)
  if (isCall(init, 'getArg')) {
    const getter = lexicalBinding(init.expression)
    return Boolean(getter?.function && argvGetter(getter.node))
  }
  return operatorInput(init, seen)
}
function resolveLoaderArgument(node, seen = new Set()) {
  node = unwrap(node)
  if (ts.isIdentifier(node)) {
    const binding = lexicalBinding(node)
    if (!binding?.immutable || !binding.node.initializer || seen.has(binding.node) || !unmodified(node, binding)) return null
    seen.add(binding.node)
    return resolveLoaderArgument(binding.node.initializer, seen)
  }
  if (pathCall(node, 'resolve') && node.arguments.length === 2 && cwdCall(node.arguments[0])) {
    if (ts.isStringLiteralLike(node.arguments[1])) return { kind: 'finite', target: `@/${node.arguments[1].text}` }
    if (operatorInput(node.arguments[1])) return { kind: 'operator-input' }
  }
  // Package-root loaders never produce local application-module edges.
  if (pathCall(node, 'join') && node.arguments.length > 1 && node.arguments.slice(1).every(ts.isStringLiteralLike)) {
    const base = unwrap(node.arguments[0])
    if (pathCall(base, 'dirname') && base.arguments.length === 1 && isCall(base.arguments[0], 'require.resolve') && base.arguments[0].arguments.length === 1 && ts.isStringLiteralLike(base.arguments[0].arguments[0]) && !localSpecifier(base.arguments[0].arguments[0].text)) return { kind: 'package-loader' }
  }
  return null
}
function copiedConfigLoader(file, node, ast) {
  if (!file.startsWith('scripts/') || !pathCall(node, 'join') || node.arguments.length !== 2 || !ts.isIdentifier(node.arguments[0]) || node.arguments[0].text !== 'runtimeRoot' || !ts.isStringLiteralLike(node.arguments[1]) || node.arguments[1].text !== 'app.config.js') return false
  // Validate the finite copy contract in AST nodes, never in comments/strings.
  let copied = false
  function visit(item) {
    if (ts.isForOfStatement(item) && ts.isIdentifier(item.expression) && item.expression.text === 'IOS_SUBMIT_CONFIG_FILES') {
      const binding = lexicalBinding(item.expression)
      const initializer = binding?.node.initializer
      const list = isCall(initializer, 'Object.freeze') ? initializer.arguments[0] : initializer
      const includesConfig = binding?.immutable && list && ts.isArrayLiteralExpression(list) && list.elements.some((element) => ts.isStringLiteralLike(element) && element.text === 'app.config.js')
      const body = item.statement
      if (includesConfig && ts.isBlock(body)) {
        const definitions = new Map()
        for (const statement of body.statements) if (ts.isVariableStatement(statement) && statement.declarationList.flags & ts.NodeFlags.Const) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) definitions.set(declaration.name.text, declaration.initializer)
        const source = definitions.get('sourcePath')
        const destination = definitions.get('runtimePath')
        const joinOf = (expression, first) => expression && pathCall(expression, 'join') && expression.arguments.length === 2 && expression.arguments[0].getText() === first && expression.arguments[1].getText() === 'relativePath'
        if (joinOf(source, 'projectRoot') && joinOf(destination, 'runtimeRoot')) for (const statement of body.statements) {
          if (!ts.isExpressionStatement(statement) || !isCall(statement.expression, 'fs.copyFileSync')) continue
          const call = statement.expression
          const fsBinding = lexicalBinding(call.expression.expression)
          if (fsBinding?.immutable && isCall(fsBinding.node.initializer, 'require') && ['fs', 'node:fs'].includes(fsBinding.node.initializer.arguments[0]?.text) && call.arguments.length === 2 && call.arguments[0].getText() === 'sourcePath' && call.arguments[1].getText() === 'runtimePath') copied = true
        }
      }
    }
    ts.forEachChild(item, visit)
  }
  visit(ast)
  return copied
}

function collectEdges(file, text) {
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const edges = []
  const opaque = []
  const add = (specifier, kind) => edges.push({ specifier, kind })
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const clause = node.importClause
      const named = clause?.namedBindings
      const typeOnly = clause?.isTypeOnly || (!clause?.name && named && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every((element) => element.isTypeOnly))
      add(node.moduleSpecifier.text, typeOnly ? 'type' : 'runtime')
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const typeOnly = node.isTypeOnly || (node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.length > 0 && node.exportClause.elements.every((element) => element.isTypeOnly))
      add(node.moduleSpecifier.text, typeOnly ? 'type' : 'runtime')
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
      add(node.moduleReference.expression.text, node.isTypeOnly ? 'type' : 'runtime')
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) {
      add(node.argument.literal.text, 'type')
    } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || isCall(node, 'require'))) {
      const argument = node.arguments[0]
      if (argument && ts.isStringLiteralLike(argument)) add(argument.text, 'runtime')
      else if (argument) {
        const resolved = resolveLoaderArgument(argument)
        if (resolved?.kind === 'finite') add(resolved.target, 'runtime')
        else if (copiedConfigLoader(file, argument, ast)) add('@/app.config.js', 'runtime')
        else if (resolved?.kind !== 'package-loader') opaque.push({ importer: file, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, expression: argument.getText(ast), kind: 'opaque-loader', operatorInput: resolved?.kind === 'operator-input' })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  for (const ref of ast.referencedFiles) add(ref.fileName.startsWith('.') ? ref.fileName : `./${ref.fileName}`, 'type')
  // Package references terminate the graph; explicit relative type contracts do not.
  for (const ref of ast.typeReferenceDirectives) if (localSpecifier(ref.fileName)) add(ref.fileName, 'type')
  const exported = new Set()
  for (const statement of ast.statements) {
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) exported.add('default')
    if (statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      if (statement.modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)) exported.add('default')
      if (statement.name && ts.isIdentifier(statement.name)) exported.add(statement.name.text)
      if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) exported.add(declaration.name.text)
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) for (const element of statement.exportClause.elements) if (!statement.isTypeOnly && !element.isTypeOnly) exported.add(element.name.text)
  }
  const ambient = file.endsWith('.d.ts') && (!ts.isExternalModule(ast) || ast.statements.some((statement) => ts.isModuleDeclaration(statement) && ts.isStringLiteral(statement.name)))
  const parseErrors = ast.parseDiagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error).map((item) => ({ kind: 'parse-error', importer: file, line: ast.getLineAndCharacterOfPosition(item.start || 0).line + 1, message: ts.flattenDiagnosticMessageText(item.messageText, '\n') }))
  return { edges, opaque, exported, ambient, parseErrors }
}

function analyzeGraph(rootDir) {
  const root = fs.realpathSync(rootDir)
  const files = inventory(root)
  const indexedFiles = new Set(files)
  const existenceCache = new Map()
  function exists(file) {
    if (indexedFiles.has(file)) return true
    if (!existenceCache.has(file)) existenceCache.set(file, confinedFile(root, file))
    return existenceCache.get(file)
  }
  const parsed = new Map()
  const manifest = new Map()
  const adjacency = new Map()
  const opaqueLoaders = []
  const toolingInputs = []
  const resolutionCache = new Map()
  const errors = []
  const entries = []
  const candidates = new Set(files.filter((file) => {
    if (file.startsWith('scripts/')) return false
    if (!file.includes('/')) return !RUNNER_MODULES.has(normalizedConfig(file)) && !CONFIG_ENTRIES[normalizedConfig(file)]
    return CANDIDATE_DIRS.has(file.split('/')[0])
  }))
  function parse(file) {
    if (!parsed.has(file)) {
      const content = fs.readFileSync(path.join(root, file), 'utf8')
      manifest.set(file, crypto.createHash('sha256').update(content).digest('hex'))
      parsed.set(file, collectEdges(file, content))
    }
    return parsed.get(file)
  }
  const tsconfig = confinedFile(root, 'tsconfig.json') ? ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile) : { error: { messageText: 'tsconfig.json must be a confined repository file' } }
  if (tsconfig.error) errors.push(diagnostic('invalid-policy', ts.flattenDiagnosticMessageText(tsconfig.error.messageText, '\n')))
  const config = tsconfig.config || {}
  if (config.compilerOptions?.paths && JSON.stringify(config.compilerOptions.paths['@/*']) !== JSON.stringify(['./*'])) errors.push(diagnostic('invalid-policy', 'unsupported @/* alias; expected ["./*"]'))
  const typeRoots = (config.compilerOptions?.typeRoots || []).filter((dir) => !dir.includes('node_modules')).map((dir) => posix(path.relative(root, path.resolve(root, dir))))
  const explicitDeclarations = new Set([...(config.files || []), ...(config.include || []).filter((file) => !/[?*]/.test(file))].map((file) => file.replace(/^\.\//, '')))
  for (const file of files) {
    const facts = parse(file)
    const configFamily = normalizedConfig(file)
    if (CONFIG_ENTRIES[configFamily]) entries.push({ path: file, kind: 'runtime', reason: CONFIG_ENTRIES[configFamily] })
    else if (file.startsWith('scripts/')) entries.push({ path: file, kind: 'runtime', reason: '#2260 executable repository script contract' })
    else if (file.startsWith('app/') && !file.endsWith('.d.ts')) {
      const basename = path.posix.basename(file).replace(/\.[cm]?[jt]sx?$/, '').replace(/\.(?:web|native|ios|android)$/, '')
      if (facts.exported.has('default') || (basename.endsWith('+api') && ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].some((method) => facts.exported.has(method))) || (basename === '+native-intent' && facts.exported.has('redirectSystemPath'))) entries.push({ path: file, kind: 'runtime', reason: 'Expo Router supported export entry contract' })
    }
    if (file.endsWith('.d.ts') && (explicitDeclarations.has(file) || (facts.ambient && (!file.includes('/') || typeRoots.some((dir) => file.startsWith(`${dir}/`)))))) entries.push({ path: file, kind: 'type', reason: 'configured ambient declaration contract' })
  }
  function resolve(importer, specifier) {
    const key = `${importer}\0${specifier}`
    if (resolutionCache.has(key)) return resolutionCache.get(key)
    if (!localSpecifier(specifier)) return []
    const absolute = specifier.startsWith('@/') ? path.resolve(root, specifier.slice(2)) : path.resolve(path.dirname(path.join(root, importer)), specifier)
    if (!absolute.startsWith(root + path.sep)) {
      errors.push({ kind: 'resolution-error', importer, specifier, message: 'dependency escapes repository' })
      return []
    }
    const relative = posix(path.relative(root, absolute))
    const extension = path.posix.extname(relative)
    const sourceExtension = SOURCE_EXTENSIONS.includes(extension)
    const declaration = relative.endsWith('.d.ts')
    if (ASSET_EXTENSIONS.has(extension)) {
      if (!exists(relative)) errors.push({ kind: 'resolution-error', importer, specifier, message: 'local asset or JSON does not exist' })
      return []
    }
    const base = sourceExtension && !declaration ? relative.slice(0, -extension.length) : relative
    const explicitPlatform = /\.(web|native|ios|android)$/.test(base)
    const winners = new Map()
    let ignoredTarget = false
    function choose(stem, suffixes) {
      // Expo sourceExts (getBareExtensions) gives extension precedence before
      // Metro platform suffixes. Explicit extensions keep their exact source,
      // with TypeScript-compatible JS-to-TS substitution only when absent.
      const extensions = declaration ? [''] : sourceExtension ? [extension, ...(['.js', '.jsx', '.mjs', '.cjs'].includes(extension) ? ['.ts', '.tsx'] : [])] : SOURCE_EXTENSIONS
      for (const ext of extensions) for (const suffix of suffixes) {
        const candidate = `${stem}${suffix}${ext}`
        if (exists(candidate)) {
          if (excluded(candidate)) ignoredTarget = true
          else winners.set(candidate, { path: candidate, declaration: candidate.endsWith('.d.ts') })
          const signature = `${stem}${suffix}.d.ts`
          if (!candidate.endsWith('.d.ts') && exists(signature) && !excluded(signature)) winners.set(signature, { path: signature, declaration: true })
          return true
        }
      }
      for (const suffix of suffixes) {
        const signature = `${stem}${suffix}.d.ts`
        if (!declaration && exists(signature)) {
          if (excluded(signature)) ignoredTarget = true
          else winners.set(signature, { path: signature, declaration: true })
          return true
        }
      }
      return false
    }
    const contexts = explicitPlatform || declaration ? [['']] : [[''], ['.web', ''], ['.native', ''], ['.ios', '.native', ''], ['.android', '.native', '']]
    for (const suffixes of contexts) if (!choose(base, suffixes) && !sourceExtension && !declaration) choose(`${base}/index`, suffixes)
    const result = [...winners.values()]
    if (!result.length && !ignoredTarget) errors.push({ kind: 'resolution-error', importer, specifier, message: 'unresolved local source dependency' })
    resolutionCache.set(key, result)
    return result
  }
  // Analyze orphan modules as well: missing imports must never be hidden by debt.
  const queue = [...files]
  const queued = new Set(queue)
  for (let index = 0; index < queue.length; index += 1) {
    const file = queue[index]
    const facts = parse(file)
    opaqueLoaders.push(...facts.opaque)
    errors.push(...facts.parseErrors)
    const edges = []
    for (const edge of facts.edges) for (const target of resolve(file, edge.specifier)) {
      edges.push({ path: target.path, kind: edge.kind === 'type' || target.declaration ? 'type' : 'runtime', specifier: edge.specifier })
      if (!queued.has(target.path)) { queue.push(target.path); queued.add(target.path) }
    }
    adjacency.set(file, edges)
  }
  const runtime = new Set()
  const type = new Set()
  const provenance = new Map()
  const origins = { application: new Set(), tooling: new Set() }
  const traversal = entries.map((entry) => ({ path: entry.path, kind: entry.kind, origin: entry.path.startsWith('scripts/') || normalizedConfig(entry.path) === 'eslint.config.js' ? 'tooling' : 'application', from: null, reason: entry.reason }))
  for (let index = 0; index < traversal.length; index += 1) {
    const item = traversal[index]
    const reached = item.kind === 'runtime' ? runtime : type
    const originKey = `${item.kind}:${item.path}`
    if (origins[item.origin].has(originKey)) continue
    origins[item.origin].add(originKey)
    reached.add(item.path)
    if (!provenance.has(item.path)) provenance.set(item.path, [])
    provenance.get(item.path).push(item)
    for (const edge of adjacency.get(item.path) || []) traversal.push({ path: edge.path, kind: item.kind === 'type' ? 'type' : edge.kind, origin: item.origin, from: item.path, specifier: edge.specifier })
  }
  for (const loader of opaqueLoaders) {
    if (loader.operatorInput && loader.importer.startsWith('scripts/') && !origins.application.has(`runtime:${loader.importer}`) && !origins.application.has(`type:${loader.importer}`)) toolingInputs.push({ ...loader, kind: 'operator-input', reason: 'operator-supplied tooling data; no source targets inferred and no reachability conferred' })
    else errors.push(loader)
  }
  const unreachable = sorted([...candidates].filter((file) => !runtime.has(file) && !type.has(file)))
  const unreachableDetails = unreachable.map((file) => ({ path: file, incoming: [...adjacency].flatMap(([importer, edges]) => edges.filter((edge) => edge.path === file).map((edge) => ({ importer, kind: edge.kind, specifier: edge.specifier }))), outgoing: adjacency.get(file) || [] }))
  const sourceManifest = sorted(manifest.keys()).map((file) => ({ path: file, sha256: manifest.get(file) }))
  const manifestHash = crypto.createHash('sha256').update(JSON.stringify(sourceManifest)).digest('hex')
  return { files, sourceManifest, manifestHash, toolingInputs: toolingInputs.sort((a, b) => a.importer.localeCompare(b.importer) || a.line - b.line), candidates: sorted(candidates), entries, runtime: sorted(runtime), type: sorted(type), unreachable, unreachableDetails, errors: errors.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))), provenance: Object.fromEntries(provenance), moduleCount: parsed.size }
}

function validateLedger(value, label = 'working ledger') {
  if (!value || value.contractVersion !== 1 || !Array.isArray(value.entries)) throw new Error(`invalid-ledger: ${label}: expected contractVersion 1 and entries array`)
  const paths = new Set()
  let previous = ''
  for (const entry of value.entries) {
    if (!entry || typeof entry.path !== 'string' || !entry.path || entry.path.includes('\\') || entry.path.startsWith('/') || entry.path.includes(':') || path.posix.normalize(entry.path) !== entry.path || entry.path.split('/').some((part) => part === '..' || part === '.') || !sourcePath(entry.path) || excluded(entry.path)) throw new Error(`invalid-ledger: ${label}: invalid repository source path`)
    if (typeof entry.reason !== 'string' || !entry.reason.trim() || typeof entry.owner !== 'string' || !entry.owner.trim()) throw new Error(`invalid-ledger: ${label}: ${entry.path} needs reason and owner`)
    if (entry.path <= previous) throw new Error(`invalid-ledger: ${label}: entries must be sorted and unique (${entry.path})`)
    previous = entry.path
    paths.add(entry.path)
  }
  return paths
}

function parseLedger(text, label) {
  let value
  try { value = JSON.parse(text) } catch { throw new Error(`invalid-ledger: ${label}: malformed JSON`) }
  validateLedger(value, label)
  return value
}

function git(root, args) {
  try { return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim() }
  catch { throw new Error(`missing-history: git ${args[0]} failed; restore complete committed ledger history`) }
}

function assertSubset(current, previous, label) {
  const added = sorted([...current].filter((file) => !previous.has(file)))
  if (added.length) throw new Error(`baseline-growth: ${label}: ${added.join(', ')}`)
}

function batchGit(root, args, input, encoding = 'utf8') {
  try { return execFileSync('git', ['-C', root, ...args], { input, encoding, maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] }) }
  catch { throw new Error('missing-history: batched committed ledger lookup failed; restore full history') }
}

function verifyHistory(root, authority) {
  if (!authority?.commit || !authority?.blob) throw new Error('initial authority not established: reviewed first ledger introduction commit and blob must be fixed before default lint wiring')
  if (!/^[a-f0-9]{40}$/.test(authority.commit) || !/^[a-f0-9]{40}$/.test(authority.blob)) throw new Error('invalid-policy: initial authority must contain full commit and blob identities')
  if (git(root, ['rev-parse', '--is-shallow-repository']) !== 'false') throw new Error('missing-history: shallow repository cannot establish first ledger introduction')
  git(root, ['merge-base', '--is-ancestor', authority.commit, 'HEAD'])
  const actualBlob = git(root, ['rev-parse', `${authority.commit}:${BASELINE_PATH}`])
  if (actualBlob !== authority.blob) throw new Error('invalid-policy: pinned initial ledger blob differs from authority commit')
  // Path history includes side-branch changes even if their content is later
  // reverted at merge. Unrelated pre-authority branches need no ledger at all.
  const transitions = git(root, ['log', '--full-history', '--reverse', '--topo-order', '--format=%H %P', 'HEAD', '--', BASELINE_PATH]).split('\n').filter(Boolean).map((line) => {
    const [commit, ...parents] = line.split(' ')
    return { commit, parents }
  })
  const revisions = sorted(new Set(['HEAD', authority.commit, ...transitions.flatMap((item) => [item.commit, ...item.parents])]))
  const records = batchGit(root, ['cat-file', '--batch-check'], revisions.map((revision) => `${revision}:${BASELINE_PATH}\n`).join('')).trim().split('\n')
  if (records.length !== revisions.length) throw new Error('missing-history: incomplete batched ledger records')
  const blobs = new Map()
  records.forEach((record, index) => {
    if (record.endsWith(' missing')) blobs.set(revisions[index], null)
    else {
      const [blob, kind] = record.split(' ')
      if (kind !== 'blob' || !/^[a-f0-9]{40}$/.test(blob)) throw new Error('invalid-ledger: committed ledger is not a blob')
      blobs.set(revisions[index], blob)
    }
  })
  const identities = sorted(new Set([...blobs.values()].filter(Boolean)))
  const contents = batchGit(root, ['cat-file', '--batch'], identities.join('\n') + '\n', null)
  const ledgers = new Map()
  let offset = 0
  for (const identity of identities) {
    const newline = contents.indexOf(10, offset)
    const [blob, kind, size] = contents.subarray(offset, newline).toString('utf8').split(' ')
    if (blob !== identity || kind !== 'blob' || !/^\d+$/.test(size)) throw new Error('missing-history: malformed batched ledger blob')
    offset = newline + 1
    ledgers.set(identity, parseLedger(contents.subarray(offset, offset + Number(size)).toString('utf8'), `blob ${identity}`))
    offset += Number(size) + 1
  }
  const pathsAt = (revision) => blobs.get(revision) ? validateLedger(ledgers.get(blobs.get(revision)), `commit ${revision}`) : null
  const introductions = []
  for (const { commit, parents } of transitions) {
    const current = pathsAt(commit)
    const predecessors = parents.map(pathsAt).filter((value) => value !== null)
    if (!current && predecessors.length) throw new Error(`missing-history: ledger deletion/recreation at ${commit} cannot reset authority`)
    if (current && !predecessors.length) introductions.push(commit)
    if (current) for (const previous of predecessors) assertSubset(current, previous, `commit ${commit}`)
  }
  if (introductions.length !== 1 || introductions[0] !== authority.commit) throw new Error('invalid-policy: pinned commit must be the sole first ledger introduction throughout reachable HEAD history')
  const head = pathsAt('HEAD')
  if (!head) throw new Error('missing-history: HEAD ledger missing; deletion cannot reset authority')
  if (!confinedFile(root, BASELINE_PATH)) throw new Error('invalid-ledger: working ledger missing or outside repository')
  const working = parseLedger(fs.readFileSync(path.join(root, BASELINE_PATH), 'utf8'), 'working ledger')
  assertSubset(validateLedger(working), head, 'working ledger versus HEAD')
  return working
}

function findings(graph, ledger) {
  const paths = validateLedger(ledger)
  const dead = new Set(graph.unreachable)
  return [...graph.unreachable.filter((file) => !paths.has(file)).map((file) => ({ path: file, kind: 'unreachable' })), ...[...paths].filter((file) => !dead.has(file)).map((file) => ({ path: file, kind: 'stale-baseline' }))].sort((a, b) => a.path.localeCompare(b.path) || a.kind.localeCompare(b.kind))
}

function check(root) {
  const ledger = verifyHistory(root, INITIAL_AUTHORITY)
  const graph = analyzeGraph(root)
  return { graph, violations: findings(graph, ledger) }
}

// Injection is deliberately inaccessible to normal CLI/production repository.
function checkFixture(root, authority) {
  const real = fs.realpathSync(root)
  const production = fs.realpathSync(path.resolve(__dirname, '..'))
  if (real === production || !confinedFile(real, '.unimported-modules-fixture') || git(real, ['rev-parse', '--show-toplevel']) !== real) throw new Error('invalid-policy: authority injection requires an isolated marked fixture repository')
  const ledger = verifyHistory(real, authority)
  const graph = analyzeGraph(real)
  return { graph, violations: findings(graph, ledger) }
}

function main(args) {
  if (args.some((arg) => !['--inventory', '--json'].includes(arg))) throw new Error('invalid-policy: only read-only --inventory and --json are supported; no ledger acceptance or authority override')
  const root = path.resolve(__dirname, '..')
  if (args.includes('--inventory')) {
    const graph = analyzeGraph(root)
    console.log(JSON.stringify({ mode: 'review-candidate-only', sourceSha: git(root, ['rev-parse', 'HEAD']), dirtyPaths: git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']).split('\0').filter(Boolean), ...graph }, null, 2))
    return graph.errors.length ? 1 : 0
  }
  const result = check(root)
  if (result.graph.errors.length) {
    console.error(JSON.stringify(result.graph.errors, null, 2))
    return 1
  }
  if (args.includes('--json')) console.log(JSON.stringify(result.violations))
  else if (result.violations.length) for (const violation of result.violations) console.error(`${violation.path}: ${violation.kind}`)
  else console.log(`Unimported modules: PASS (${result.graph.moduleCount} modules; committed shrink-only authority verified)`)
  return result.violations.length ? 1 : 0
}

module.exports = { analyzeGraph, collectEdges, validateLedger, findings, checkFixture, BASELINE_PATH }
if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)) } catch (error) { console.error(`Unimported modules: ${error.message}`); process.exitCode = 1 }
}
