/* global module, require, process */
const path = require('path')
const fs = require('fs')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const ROOTS = new Set(['app', 'components', 'screens', 'hooks', 'context', 'utils', 'stores'])
const SOURCE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js']
const isLocaleModule = source => /^@\/i18n(?:\/|$)/.test(source)
const isOwnerName = name => /^[A-Z]/.test(name || '') || /^use[A-Z0-9]/.test(name || '')
const getName = p => p.node.id?.name || (p.parentPath.isVariableDeclarator() ? p.parentPath.node.id?.name : null)
const hasWorklet = p => p.node.body?.directives?.some(d => d.value.value === 'worklet')
const isReactImport = (p, name) => {
  const binding = p.scope.getBinding(name)
  return binding?.path.parentPath?.isImportDeclaration() && binding.path.parentPath.node.source.value === 'react'
}
const reactCall = p => {
  const c = p.node.callee
  if (c.type === 'Identifier' && isReactImport(p, c.name)) {
    const imported = p.scope.getBinding(c.name).path.node.imported
    return imported?.name
  }
  if (c.type === 'MemberExpression' && c.object.type === 'Identifier' && isReactImport(p, c.object.name)) return c.property.name
  return null
}
const isOwner = p => {
  if (hasWorklet(p) || p.node.async || p.node.generator) return false
  const parent = p.parentPath
  if (parent.isCallExpression() && ['memo', 'forwardRef'].includes(reactCall(parent)) && parent.get('arguments.0') === p) return true
  const name = getName(p)
  if (!isOwnerName(name) && !p.parentPath.isExportDefaultDeclaration()) return false
  // A nested named helper/render callback is not a React invocation boundary.
  if (p.findParent(q => q.isFunction())) return false
  if (/^use[A-Z0-9]/.test(name || '')) return true
  let evidence = false
  p.traverse({
    Function(q) { q.skip() },
    JSXElement() { evidence = true }, JSXFragment() { evidence = true },
    'CallExpression|OptionalCallExpression'(q) {
      const c = q.node.callee
      const called = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' ? c.property.name : ''
      if (/^use[A-Z0-9]/.test(called) || reactCall(q) === 'createElement') evidence = true
    },
  })
  return evidence
}
const resolveImport = (source, filename, root, platform) => {
  const stem = source.startsWith('@/') ? path.join(root, source.slice(2)) : source.startsWith('.') ? path.resolve(path.dirname(filename), source) : null
  if (!stem) return null
  const prefixes = platform === 'web' ? ['web'] : platform === 'ios' ? ['ios', 'native'] : platform === 'android' ? ['android', 'native'] : []
  const extensions = [
    ...prefixes.flatMap(prefix => SOURCE_EXTENSIONS.map(ext => `.${prefix}${ext}`)),
    ...SOURCE_EXTENSIONS,
    ...prefixes.flatMap(prefix => SOURCE_EXTENSIONS.map(ext => `/index.${prefix}${ext}`)),
    ...SOURCE_EXTENSIONS.map(ext => `/index${ext}`),
  ]
  return [stem, ...extensions.map(ext => stem + ext)].find(candidate => /\.[jt]sx?$/.test(candidate) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null
}
// Imported label getters/formatting helpers remain normal functions. Their React
// caller subscribes; presentation memos must also invalidate across module edges.
const presentationExportCache = new Map()
const sourceProgramCache = new Map()
const sourceSignature = file => {
  const stat = fs.statSync(file)
  return `${stat.mtimeMs}:${stat.size}:${stat.ctimeMs}`
}
// Follow writes only to the local value returned by a presentation factory.
// Deferred callbacks and unrelated API/toast side effects are not its value.
const localizedWrites = (binding, localized) => binding.referencePaths.some(reference => {
  if (reference.getFunctionParent() !== binding.path.getFunctionParent()) return false
  const member = reference.parentPath
  if (!member.isMemberExpression() || member.get('object') !== reference) return false
  const parent = member.parentPath
  if (parent.isCallExpression() && parent.get('callee') === member &&
    ['push', 'unshift', 'splice'].includes(member.node.property.name)) return parent.get('arguments').some(localized)
  return parent.isAssignmentExpression() && parent.get('left') === member && localized(parent.get('right'))
})
const localeReturningExport = (filename, name, root, platform, seen = new Set(), dependencies = new Map()) => {
  const key = `${platform || 'shared'}:${filename}:${name}`
  const cached = presentationExportCache.get(key)
  if (cached && [...cached.dependencies].every(([file, signature]) => fs.existsSync(file) && sourceSignature(file) === signature)) {
    for (const [file, signature] of cached.dependencies) dependencies.set(file, signature)
    return cached.value
  }
  if (seen.has(key)) return false
  const visited = new Set(seen).add(key)
  const signature = sourceSignature(filename)
  dependencies.set(filename, signature)
  const cachedProgram = sourceProgramCache.get(filename)
  let program = cachedProgram?.signature === signature ? cachedProgram.program : null
  if (!program) {
    const ast = parser.parse(fs.readFileSync(filename, 'utf8'), { sourceType: 'module', plugins: ['typescript', 'jsx'] })
    traverse(ast, { Program(p) { program = p; p.stop() } })
    sourceProgramCache.set(filename, { signature, program })
  }
  let target = null
  for (const statement of program.get('body')) {
    if (statement.isExportAllDeclaration()) {
      const dependency = resolveImport(statement.node.source.value, filename, root, platform)
      if (dependency && localeReturningExport(dependency, name, root, platform, visited, dependencies)) { presentationExportCache.set(key, { value: true, dependencies: new Map(dependencies) }); return true }
    }
    if (statement.isExportDefaultDeclaration() && name === 'default') target = statement.get('declaration')
    if (!statement.isExportNamedDeclaration()) continue
    const declaration = statement.get('declaration')
    if (declaration?.node?.id?.name === name) target = declaration
    if (declaration?.isVariableDeclaration()) for (const variable of declaration.get('declarations')) if (variable.node.id.name === name) target = variable.get('init')
    for (const specifier of statement.get('specifiers')) {
      if (specifier.node.exported.name !== name) continue
      if (statement.node.source) {
        const dependency = resolveImport(statement.node.source.value, filename, root, platform)
        if (dependency && localeReturningExport(dependency, specifier.node.local.name, root, platform, visited, dependencies)) return true
      } else target = program.scope.getBinding(specifier.node.local.name)?.path
    }
  }
  if (target?.isIdentifier()) target = target.scope.getBinding(target.node.name)?.path
  if (target?.isVariableDeclarator()) target = target.get('init')
  if (!target?.node || /^use[A-Z0-9]/.test(name) || target.node.async) { presentationExportCache.set(key, { value: false, dependencies: new Map(dependencies) }); return false }
  const localized = (expression, bindingsSeen = new Set()) => {
    if (!expression?.node || expression.isFunction()) return false
    let found = false
    const inspect = p => {
      if (found || !p.isIdentifier()) return
      const binding = p.scope.getBinding(p.node.name)
      if (!binding || bindingsSeen.has(binding)) return
      bindingsSeen.add(binding)
      if (binding.path.isFunctionDeclaration() || binding.path.isVariableDeclarator() && binding.path.get('init').isFunction()) {
        if (!p.parentPath.isCallExpression() || p.parentPath.get('callee') !== p) return
        const fn = binding.path.isFunctionDeclaration() ? binding.path : binding.path.get('init')
        if (fn.node.async || /^use[A-Z0-9]/.test(binding.identifier.name)) return
        if (!fn.get('body').isBlockStatement()) found = localized(fn.get('body'), bindingsSeen)
        else fn.traverse({ Function(p) { p.skip() }, ReturnStatement(p) { if (localized(p.get('argument'), bindingsSeen)) found = true } })
        return
      }
      if (binding.path.isVariableDeclarator()) {
        if (localized(binding.path.get('init'), bindingsSeen) || localizedWrites(binding, value => localized(value, bindingsSeen))) found = true
        return
      }
      if (!binding.path.isImportSpecifier()) return
      const source = binding.path.parentPath.node.source.value
      if (isLocaleModule(source)) { found = true; return }
      const dependency = resolveImport(source, filename, root, platform)
      if (dependency && localeReturningExport(dependency, binding.path.node.imported.name, root, platform, visited, dependencies)) found = true
    }
    if (expression.isIdentifier()) inspect(expression)
    if (expression.isCallExpression()) inspect(expression.get('callee'))
    expression.traverse({
      Function(p) {
        const parent = p.parentPath
        const eager = parent.isCallExpression() && parent.get('callee').isMemberExpression() && ['map', 'flatMap', 'filter', 'reduce', 'sort'].includes(parent.node.callee.property.name)
        if (!eager) p.skip()
      },
      Identifier(p) { if (p.isReferencedIdentifier()) inspect(p) },
    })
    return found
  }
  let result = false
  if (target.isFunction()) {
    if (target.get('body').isBlockStatement()) target.traverse({ Function(p) { p.skip() }, ReturnStatement(p) { if (localized(p.get('argument'))) result = true } })
    else result = localized(target.get('body'))
  } else {
    result = localized(target)
    // Imported lazy label tables expose translations through getter returns.
    target.traverse({ ObjectMethod(p) {
      if (p.node.kind !== 'get') return
      p.traverse({ Function(nested) { nested.skip() }, ReturnStatement(returned) { if (localized(returned.get('argument'))) result = true } })
    } })
  }
  // Do not cache negative cycle decisions while an ancestor is unresolved.
  if (result || seen.size === 0) presentationExportCache.set(key, { value: result, dependencies: new Map(dependencies) })
  return result
}
const isLocaleSensitive = (p, taintedImports, seen = new Set()) => {
  if (!p?.node) return false
  let sensitive = false
  const inspectIdentifier = q => {
    if (sensitive || !q.isReferencedIdentifier()) return
    const binding = q.scope.getBinding(q.node.name)
    if (!binding || seen.has(binding)) return
    if (taintedImports.has(binding)) { sensitive = true; return }
    const next = seen.add(binding)
    if (binding.path.isVariableDeclarator() && isLocaleSensitive(binding.path.get('init'), taintedImports, next)) sensitive = true
    if (binding.path.isFunctionDeclaration() && isLocaleSensitive(binding.path.get('body'), taintedImports, next)) sensitive = true
  }
  if (p.isIdentifier()) inspectIdentifier(p)
  p.traverse({
    Identifier: inspectIdentifier,
    MemberExpression(q) {
      // Module factories frequently expose localized lazy label/title getters.
      if (!sensitive && !q.node.computed && ['label', 'title', 'accessibilityLabel'].includes(q.node.property.name)) sensitive = true
    },
  })
  return sensitive
}
const returnsJsx = callback => {
  let result = false
  const inspect = expression => {
    if (!expression?.node) return
    if (expression.isJSXElement() || expression.isJSXFragment()) result = true
    expression.traverse({ JSXElement() { result = true }, JSXFragment() { result = true } })
  }
  if (!callback.get('body').isBlockStatement()) inspect(callback.get('body'))
  else callback.traverse({ Function(p) { p.skip() }, ReturnStatement(p) { inspect(p.get('argument')) } })
  return result
}
const returnsLocalizedValue = (callback, taintedImports, seen = new Set()) => {
  if (callback.node.async) return false
  const isLocalizedReturn = expression => {
    if (!expression?.node) return false
    if (expression.isCallExpression()) {
      const callee = expression.get('callee')
      if (callee.isMemberExpression() && ['map', 'flatMap', 'filter', 'reduce', 'sort', 'join', 'slice', 'concat', 'trim', 'toUpperCase', 'toLowerCase'].includes(callee.node.property.name)) {
        return localizedPresentationValue(expression, taintedImports, seen)
      }
      if (!callee.isIdentifier() || /^use[A-Z0-9]/.test(callee.node.name)) return false
      const binding = callee.scope.getBinding(callee.node.name)
      if (binding?.path.isImportSpecifier()) return isLocaleModule(binding.path.parentPath.node.source.value) || taintedImports.presentation.has(binding)
      const fn = binding?.path.isFunctionDeclaration() ? binding.path : binding?.path.isVariableDeclarator() ? binding.path.get('init') : null
      if (!fn?.isFunction()) return false
    }
    return localizedPresentationValue(expression, taintedImports, seen)
  }
  if (!callback.get('body').isBlockStatement()) return isLocalizedReturn(callback.get('body'))
  let localized = false
  callback.traverse({ Function(p) { p.skip() }, ReturnStatement(p) { if (isLocalizedReturn(p.get('argument'))) localized = true } })
  return localized
}
const localizedPresentationValue = (expression, taintedImports, seen = new Set()) => {
  if (!expression?.node || expression.isFunction()) return false
  if (expression.isCallExpression()) {
    const callee = expression.get('callee')
    const name = callee.isIdentifier() ? callee.node.name : callee.isMemberExpression() ? callee.node.property.name : ''
    if (name === 'useMemo') return presentationCallback(expression.get('arguments.0'), 'useMemo', taintedImports, seen)
    // Hook/state/service functions are identities/data, not translated values.
    if (/^use[A-Z0-9]/.test(name)) return false
    const binding = callee.isIdentifier() ? callee.scope.getBinding(name) : null
    if (binding?.path.isImportSpecifier() && taintedImports.has(binding)) {
      const source = binding.path.parentPath.node.source.value
      if (isLocaleModule(source) || taintedImports.presentation?.has(binding)) return true
    }
    if (binding && !seen.has(binding)) {
      const fn = binding.path.isFunctionDeclaration() ? binding.path : binding.path.isVariableDeclarator() ? binding.path.get('init') : null
      if (fn?.isFunction() && !fn.node.async && !hasWorklet(fn)) {
        seen.add(binding)
        if (returnsLocalizedValue(fn, taintedImports, seen)) return true
      }
    }
  }
  let localized = false
  const inspect = p => {
    if (localized || !p.isReferencedIdentifier()) return
    const binding = p.scope.getBinding(p.node.name)
    if (!binding || seen.has(binding) || !binding.path.isVariableDeclarator()) return
    seen.add(binding)
    if (localizedPresentationValue(binding.path.get('init'), taintedImports, seen) ||
      localizedWrites(binding, value => localizedPresentationValue(value, taintedImports, seen))) localized = true
  }
  if (expression.isIdentifier()) inspect(expression)
  const inspectMember = p => {
      let object = p.get('object')
      while (object.isMemberExpression()) object = object.get('object')
      if (!object.isIdentifier()) return
      const binding = object.scope.getBinding(object.node.name)
      if (binding?.path.isImportSpecifier() && taintedImports.presentation?.has(binding)) localized = true
      if (binding?.path.isVariableDeclarator()) {
        const init = binding.path.get('init')
        if (init.isObjectExpression() || init.isArrayExpression()) {
          if (localizedPresentationValue(init, taintedImports, seen)) localized = true
          init.traverse({ ObjectMethod(getter) {
            if (getter.node.kind === 'get' && returnsLocalizedValue(getter, taintedImports, seen)) localized = true
            getter.skip()
          } })
        }
      }
  }
  if (expression.isMemberExpression()) inspectMember(expression)
  expression.traverse({
    Function(p) {
      const parent = p.parentPath
      const eager = parent.isCallExpression() && parent.get('callee').isMemberExpression() &&
        ['map', 'flatMap', 'filter', 'reduce', 'sort', 'find', 'some', 'every'].includes(parent.node.callee.property.name)
      if (!eager) p.skip()
    },
    Identifier: inspect,
    CallExpression(p) {
      const callee = p.get('callee')
      if (!callee.isIdentifier()) return
      const binding = callee.scope.getBinding(callee.node.name)
      if (binding?.path.isImportSpecifier() && taintedImports.has(binding)) {
        const source = binding.path.parentPath.node.source.value
        if (isLocaleModule(source) || taintedImports.presentation?.has(binding)) localized = true
      }
      if (binding && !seen.has(binding) && !/^use[A-Z0-9]/.test(callee.node.name)) {
        const fn = binding.path.isFunctionDeclaration() ? binding.path : binding.path.isVariableDeclarator() ? binding.path.get('init') : null
        if (fn?.isFunction() && !fn.node.async && !hasWorklet(fn)) {
          seen.add(binding)
          if (returnsLocalizedValue(fn, taintedImports, seen)) localized = true
        }
      }
    },
    MemberExpression: inspectMember,
  })
  return localized
}
const capturedLocaleValue = (callback, taintedImports) => {
  let result = false
  callback.traverse({ Identifier(p) {
    if (result || !p.isReferencedIdentifier()) return
    const b = p.scope.getBinding(p.node.name)
    if (!b?.path.isVariableDeclarator() || b.scope === callback.scope || b.path.findParent(parent => parent === callback)) return
    // Only already computed presentation data needs a refreshed closure. A
    // custom hook/service's returned functions and raw state remain stable.
    if (localizedPresentationValue(b.path.get('init'), taintedImports)) result = true
  } })
  return result
}
const presentationCallback = (callback, kind, taintedImports, seen = new Set()) => {
  if (!callback?.node) return false
  if (callback.isIdentifier()) {
    const binding = callback.scope.getBinding(callback.node.name)
    if (!binding || seen.has(binding)) return false
    seen.add(binding)
    if (binding.path.isImportSpecifier() || binding.path.isImportDefaultSpecifier()) {
      return taintedImports.presentation.has(binding)
    }
    const definition = binding.path.isVariableDeclarator() ? binding.path.get('init') : binding.path
    return presentationCallback(definition, kind, taintedImports, seen)
  }
  if (!callback.isFunction()) return false
  return kind === 'useMemo'
    ? localizedPresentationValue(callback.get('body'), taintedImports)
    : returnsJsx(callback) || returnsLocalizedValue(callback, taintedImports) || capturedLocaleValue(callback, taintedImports)
}
function reactiveLocalePlugin({ types: t }) {
  return {
    name: 'metravel-reactive-locale',
    visitor: { Program(program, state) {
      const root = state.opts.projectRoot || process.cwd()
      const filename = state.filename || ''
      const platform = state.opts.platform
      const relative = path.relative(root, filename)
      if (!ROOTS.has(relative.split(path.sep)[0]) || relative.endsWith('.d.ts')) return
      const owners = []
      program.traverse({ Function(p) { if (isOwner(p)) owners.push(p) } })
      const taintedImports = new Set()
      taintedImports.presentation = new Set()
      for (const declaration of program.get('body')) {
        if (!declaration.isImportDeclaration() || declaration.node.importKind === 'type') continue
        const source = declaration.node.source.value
        const dependency = resolveImport(source, filename, root, platform)
        for (const specifier of declaration.get('specifiers')) {
          if (specifier.node.importKind === 'type') continue
          const binding = program.scope.getBinding(specifier.node.local.name)
          if (isLocaleModule(source)) taintedImports.add(binding)
          const importedName = specifier.node.imported?.name || (specifier.isImportDefaultSpecifier() ? 'default' : null)
          if (dependency && importedName && !/^use[A-Z0-9]/.test(importedName) && localeReturningExport(dependency, importedName, root, platform)) {
            taintedImports.add(binding)
            taintedImports.presentation.add(binding)
          }
        }
      }
      program.traverse({ Class(classPath) {
        const name = classPath.node.id?.name
        const base = classPath.node.superClass
        const reactClass = base?.type === 'Identifier' ? isReactImport(classPath, base.name) :
          base?.type === 'MemberExpression' && base.object.type === 'Identifier' && isReactImport(classPath, base.object.name)
        if (!reactClass || !isLocaleSensitive(classPath.get('body'), taintedImports)) return
        let wrapped = false
        program.traverse({ JSXOpeningElement(element) {
          if (element.node.name.type === 'JSXIdentifier' && element.node.name.name === name &&
            element.node.attributes.some(attribute => attribute.type === 'JSXAttribute' && attribute.name.name === 'localeRevision')) wrapped = true
        } })
        if (!wrapped) throw classPath.buildCodeFrameError('Locale-sensitive React class requires a state-preserving localeRevision wrapper.')
      } })
      if (!owners.length) return
      const presentationHooks = []
      let needsImport = false
      const hook = program.scope.generateUidIdentifier('useLocaleRevision')
      for (const owner of owners) {
        let existingRevision = null
        if (t.isBlockStatement(owner.node.body)) {
          for (const statement of owner.get('body.body')) {
            if (!statement.isVariableDeclaration()) continue
            for (const declaration of statement.get('declarations')) {
              const init = declaration.get('init')
              if (!init.isCallExpression() || !init.get('callee').isIdentifier()) continue
              const binding = init.scope.getBinding(init.node.callee.name)
              if (binding?.path.isImportSpecifier() && binding.path.node.imported.name === 'useLocaleRevision' &&
                binding.path.parentPath.node.source.value === '@/i18n/useLocaleRevision' && declaration.get('id').isIdentifier()) existingRevision = declaration.node.id
            }
          }
        }
        const revision = existingRevision || owner.scope.generateUidIdentifier('localeRevision')
        if (!t.isBlockStatement(owner.node.body)) owner.node.body = t.blockStatement([t.returnStatement(owner.node.body)])
        owner.traverse({
          Function(p) { if (owners.includes(p) || hasWorklet(p)) p.skip() },
          CallExpression(call) {
            const kind = reactCall(call)
            if (!['useMemo', 'useCallback'].includes(kind)) return
            if (call.node.arguments.some(argument => t.isSpreadElement(argument))) throw call.buildCodeFrameError('React presentation hook spread arguments require an explicit callback/dependency contract.')
            const callback = call.get('arguments.0')
            const presentation = presentationCallback(callback, kind, taintedImports)
            if (!presentation) return
            const deps = call.get('arguments.1')
            // Missing/undefined deps mean "every render". Keep that contract.
            if (!deps?.node || deps.isIdentifier({ name: 'undefined' }) || deps.isUnaryExpression({ operator: 'void' })) return
            if (!deps.isArrayExpression()) throw call.buildCodeFrameError('Locale-sensitive presentation hook requires an explicit dependency array (or undefined).')
            if (deps.node.elements.some(element => t.isIdentifier(element, { name: revision.name }))) return
            deps.pushContainer('elements', t.cloneNode(revision))
            presentationHooks.push({ kind, line: call.node.loc?.start.line, owner: getName(owner) || 'anonymous' })
          },
        })
        if (!existingRevision) {
          needsImport = true
          owner.get('body').unshiftContainer('body', t.variableDeclaration('const', [t.variableDeclarator(revision, t.callExpression(t.cloneNode(hook), []))]))
        }
      }
      if (needsImport) program.unshiftContainer('body', t.importDeclaration([t.importSpecifier(hook, t.identifier('useLocaleRevision'))], t.stringLiteral('@/i18n/useLocaleRevision')))
      state.file.metadata.localeReactivePresentationHooks = presentationHooks
      state.file.metadata.localeReactiveOwners = owners.map(p => ({ name: getName(p) || 'anonymous', line: p.node.loc?.start.line }))
    } },
  }
}
module.exports = reactiveLocalePlugin
module.exports.isOwner = isOwner
module.exports.ROOTS = ROOTS
module.exports.resetLocaleModuleCache = () => { presentationExportCache.clear(); sourceProgramCache.clear() }
