/* global module, process, require, __filename */

const fs = require('fs')
const path = require('path')
const ts = require('typescript')
const crypto = require('crypto')
const { compileLocaleCatalog, hashTranslationKey } = require('./catalogCompiler')

const cache = new Map()
const runtimeResourceCache = new Map()
const TRANSLATE_IMPORTS = new Set(['translate', 'translatePlural'])
const PLURAL_SUFFIXES = ['one', 'few', 'many', 'other', 'zero', 'two']

// These catalogs are data modules, not executable build plugins. Resolve their
// real import/spread order without evaluating arbitrary TypeScript expressions.
const readRuntimeResourceGraph = (projectRoot, locale) => {
  if (!['ru', 'be', 'uk', 'pl', 'en'].includes(locale)) throw new Error(`Unknown catalog locale: ${locale}`)
  const localeRoot = path.resolve(projectRoot, 'i18n', 'locales', locale)
  const files = new Map()
  const modules = new Map()
  const visiting = new Set()
  const load = (filePath) => {
    if (!filePath.startsWith(`${localeRoot}${path.sep}`)) throw new Error(`Catalog import escapes locale: ${filePath}`)
    if (visiting.has(filePath)) throw new Error(`Circular catalog import: ${filePath}`)
    if (modules.has(filePath)) return modules.get(filePath)
    visiting.add(filePath)
    const source = fs.readFileSync(filePath, 'utf8')
    files.set(filePath, source)
    if (filePath.endsWith('.json')) {
      const result = { default: JSON.parse(source) }
      modules.set(filePath, result)
      visiting.delete(filePath)
      return result
    }
    const ast = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    if (ast.parseDiagnostics.length) throw new Error(`Invalid catalog TypeScript: ${filePath}`)
    const bindings = new Map()
    const exported = {}
    const fail = () => { throw new Error(`Unsupported catalog data expression: ${filePath}`) }
    const evaluate = (node) => {
      const expression = unwrapExpression(node)
      if (expression && (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))) return expression.text
      if (expression && ts.isIdentifier(expression) && bindings.has(expression.text)) return bindings.get(expression.text)
      if (!expression || !ts.isObjectLiteralExpression(expression)) return fail()
      const result = {}
      const assign = (key, value) => Object.defineProperty(result, key, { value, enumerable: true, configurable: true, writable: true })
      for (const property of expression.properties) {
        if (ts.isSpreadAssignment(property)) {
          const spread = evaluate(property.expression)
          if (!spread || typeof spread !== 'object' || Array.isArray(spread)) return fail()
          for (const [key, value] of Object.entries(spread)) assign(key, value)
        } else if (ts.isShorthandPropertyAssignment(property) && !property.objectAssignmentInitializer) {
          assign(property.name.text, evaluate(property.name))
        } else if (ts.isPropertyAssignment(property) && (ts.isStringLiteral(property.name) || ts.isIdentifier(property.name))) {
          // Object-literal __proto__ is a prototype setter, unlike JSON/spread data.
          if (property.name.text === '__proto__') return fail()
          assign(property.name.text, evaluate(property.initializer))
        } else return fail()
      }
      return result
    }
    for (const statement of ast.statements) {
      if (ts.isImportDeclaration(statement)) {
        const clause = statement.importClause
        if (clause?.isTypeOnly) continue
        if (!clause || !ts.isStringLiteral(statement.moduleSpecifier) || !statement.moduleSpecifier.text.startsWith('.')) return fail()
        const target = path.resolve(path.dirname(filePath), statement.moduleSpecifier.text)
        const resolved = [target, `${target}.ts`, path.join(target, 'index.ts')]
          .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
        if (!resolved) return fail()
        const imported = load(resolved)
        if (clause.name) {
          if (!Object.prototype.hasOwnProperty.call(imported, 'default')) return fail()
          bindings.set(clause.name.text, imported.default)
        }
        if (clause.namedBindings) {
          if (!ts.isNamedImports(clause.namedBindings)) return fail()
          for (const item of clause.namedBindings.elements) {
            if (item.isTypeOnly) continue
            const name = item.propertyName?.text || item.name.text
            if (!Object.prototype.hasOwnProperty.call(imported, name)) return fail()
            bindings.set(item.name.text, imported[name])
          }
        }
      } else if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const)) {
        for (const declaration of statement.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name)) return fail()
          const value = evaluate(declaration.initializer)
          bindings.set(declaration.name.text, value)
          if (ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export) exported[declaration.name.text] = value
        }
      } else if (!ts.isTypeAliasDeclaration(statement) && !ts.isInterfaceDeclaration(statement) && !ts.isEmptyStatement(statement)) return fail()
    }
    modules.set(filePath, exported)
    visiting.delete(filePath)
    return exported
  }
  const resources = load(path.join(localeRoot, 'index.ts'))[`${locale}Resources`]
  if (!resources || typeof resources !== 'object' || !Object.keys(resources).length) throw new Error(`Missing runtime catalog: ${locale}`)
  for (const entries of Object.values(resources)) {
    if (!entries || typeof entries !== 'object' || Array.isArray(entries) || Object.values(entries).some((value) => typeof value !== 'string')) {
      throw new Error(`Non-string runtime catalog data: ${locale}`)
    }
  }
  return { resources, files }
}

// Computed once at Metro/Babel configuration startup for an immutable build.
// The revision is also the memo key: tests and successive builds cannot reuse
// a flattened or ordered catalog from a different set of external inputs.
const getCatalogRevision = (projectRoot) => {
  const graphs = ['ru', 'be', 'uk', 'pl', 'en'].map((locale) => [locale, readRuntimeResourceGraph(projectRoot, locale)])
  const inputs = new Map(graphs.flatMap(([, graph]) => [...graph.files]))
  // The existing inline-key reader also scans runtime TS files directly. Keep
  // those inputs in the key even if a future index stops importing one of them.
  const collect = (directory) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      if (item.isDirectory() && item.name !== 'ssg') collect(path.join(directory, item.name))
      else if (item.isFile() && /\.(ts|json)$/.test(item.name)) {
        const file = path.join(directory, item.name)
        inputs.set(file, fs.readFileSync(file, 'utf8'))
      }
    }
  }
  for (const [locale] of graphs) collect(path.join(projectRoot, 'i18n', 'locales', locale))
  for (const file of [__filename, require.resolve('./catalogCompiler')]) inputs.set(file, fs.readFileSync(file, 'utf8'))
  const digest = crypto.createHash('sha256')
  for (const [file, source] of [...inputs].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const relative = file.startsWith(`${projectRoot}${path.sep}`) ? path.relative(projectRoot, file) : path.basename(file)
    digest.update(JSON.stringify([relative.replace(/\\/g, '/'), source]))
  }
  const revision = digest.digest('hex')
  for (const [locale, graph] of graphs) runtimeResourceCache.set(`${projectRoot}\0${locale}\0${revision}`, graph.resources)
  return revision
}

const loadRuntimeResources = (projectRoot, locale, revision) => {
  if (!revision) throw new Error('Production catalog input revision is required')
  const key = `${projectRoot}\0${locale}\0${revision}`
  if (!runtimeResourceCache.has(key) && getCatalogRevision(projectRoot) !== revision) {
    throw new Error('Catalog input revision changed during production transform')
  }
  return runtimeResourceCache.get(key)
}

const unwrapExpression = (expression) => {
  let current = expression
  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current))
  ) {
    current = current.expression
  }
  return current
}

const readObjectEntries = (filePath) => {
  const source = fs.readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const entries = new Map()
  const jsonImports = new Map()

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const importName = statement.importClause?.name?.text
    const importPath = statement.moduleSpecifier
    if (
      !importName ||
      !ts.isStringLiteral(importPath) ||
      !importPath.text.endsWith('.json')
    ) {
      continue
    }
    jsonImports.set(
      importName,
      path.resolve(path.dirname(filePath), importPath.text),
    )
  }

  const visit = (node) => {
    const initializer = ts.isVariableDeclaration(node)
      ? unwrapExpression(node.initializer)
      : undefined
    if (initializer && ts.isObjectLiteralExpression(initializer)) {
      for (const property of initializer.properties) {
        if (
          ts.isSpreadAssignment(property) &&
          ts.isIdentifier(property.expression)
        ) {
          const jsonPath = jsonImports.get(property.expression.text)
          if (!jsonPath) continue
          const jsonEntries = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
          for (const [key, value] of Object.entries(jsonEntries)) {
            if (typeof value === 'string') entries.set(key, value)
          }
          continue
        }
        if (!ts.isPropertyAssignment(property)) continue
        const name = property.name
        const value = property.initializer
        if (
          (ts.isStringLiteral(name) || ts.isIdentifier(name)) &&
          (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))
        ) {
          entries.set(name.text, value.text)
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return entries
}

/** `quest_share` → `questShare`: имя namespace обязано совпасть с ключом рантайма. */
const toCamelCase = (value) =>
  value.replace(/_([a-z0-9])/g, (_match, character) => character.toUpperCase())

/**
 * SSG-only resources (#2399) live in `i18n/locales/<locale>/ssg/*_ssg.ts`
 * and get a `…Ssg` namespace. Runtime resources (`i18n/locales/<locale>/index.ts`)
 * never import them, so they are absent from the client locale chunks; the web
 * inliner reads the runtime set only, and the SSG generator reads both through
 * `loadSsgCatalogs`.
 */
const SSG_ONLY_NAMESPACE_SUFFIX = 'Ssg'
const isSsgOnlyNamespace = (namespace) => namespace.endsWith(SSG_ONLY_NAMESPACE_SUFFIX)

const readCatalogs = (projectRoot, { includeSsgOnly, revision = '' }) => {
  const cacheKey = `${projectRoot}\0${includeSsgOnly ? 'ssg' : 'runtime'}\0${revision}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const localesRoot = path.join(projectRoot, 'i18n', 'locales')
  const localeCodes = fs
    .readdirSync(localesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) =>
      left === 'ru' ? -1 : right === 'ru' ? 1 : left.localeCompare(right),
    )
  const catalogs = new Map()

  for (const locale of localeCodes) {
    const localeRoot = path.join(localesRoot, locale)
    const catalog = new Map()
    const sources = [
      {
        directory: path.join(localeRoot, 'generated'),
        namespace: (name) => name.replace(/_\d+$/, ''),
      },
      {
        directory: path.join(localeRoot, 'static'),
        // Рантайм регистрирует статические каталоги camelCase-ключом:
        // `quest_share_static.ts` → `questShareStatic` (см.
        // `i18n/locales/<locale>/static/index.ts`). Отбрасывания `_static`
        // хватало только однословным именам — двусловный файл получал
        // `quest_shareStatic`, которого в рантайме нет, и весь namespace
        // печатался на web как «Перевод недоступен» (#1675).
        namespace: (name) => `${toCamelCase(name.replace(/_static$/, ''))}Static`,
      },
      ...(includeSsgOnly
        ? [{
            directory: path.join(localeRoot, 'ssg'),
            namespace: (name) =>
              `${toCamelCase(name.replace(/_ssg$/, ''))}${SSG_ONLY_NAMESPACE_SUFFIX}`,
          }]
        : []),
    ]

    for (const source of sources) {
      for (const fileName of fs.readdirSync(source.directory)) {
        if (!fileName.endsWith('.ts') || fileName === 'index.ts') continue
        const stem = fileName.slice(0, -3)
        const namespace = source.namespace(stem)
        for (const [key, value] of readObjectEntries(
          path.join(source.directory, fileName),
        )) {
          catalog.set(`${namespace}:${key}`, value)
        }
      }
    }

    // Hand-written feature namespaces (for example `offline.ts`) live next to
    // common.ts. They are part of runtime resources too and therefore must be
    // available to the web compile-time inliner just like generated chunks.
    for (const fileName of fs.readdirSync(localeRoot)) {
      if (!fileName.endsWith('.ts') || fileName === 'index.ts' || fileName === 'common.ts') continue
      const namespace = fileName.slice(0, -3)
      for (const [key, value] of readObjectEntries(path.join(localeRoot, fileName))) {
        catalog.set(`${namespace}:${key}`, value)
      }
    }

    for (const [key, value] of readObjectEntries(
      path.join(localeRoot, 'common.ts'),
    )) {
      catalog.set(`common:${key}`, value)
    }
    catalogs.set(locale, catalog)
  }

  const result = { localeCodes, catalogs }
  cache.set(cacheKey, result)
  return result
}

/** Runtime catalogs: exactly what `i18n/resources.ts` ships to the client. */
const loadCatalogs = (projectRoot, revision) => readCatalogs(projectRoot, { includeSsgOnly: false, revision })

/** Runtime plus SSG-only catalogs, for the SSG generator and its tests. */
const loadSsgCatalogs = (projectRoot) => readCatalogs(projectRoot, { includeSsgOnly: true })

const getImportedName = (callPath) => {
  const callee = callPath.get('callee')
  if (!callee.isIdentifier()) return null
  const binding = callPath.scope.getBinding(callee.node.name)
  if (!binding?.path.isImportSpecifier()) return null

  const declaration = binding.path.parentPath
  if (!declaration.isImportDeclaration()) return null
  const source = declaration.node.source.value
  if (source !== '@/i18n' && source !== '@/i18n/translate') return null

  const imported = binding.path.node.imported
  return imported.type === 'Identifier' ? imported.name : imported.value
}

const buildCompiledTranslation = (t, key, localeCodes, catalogs) => {
  const values = localeCodes.map((locale) => [locale, catalogs.get(locale).get(key)])
  if (values.some(([, value]) => value === undefined)) return null

  const sourceCatalog = catalogs.get('ru')
  const pluralForms = PLURAL_SUFFIXES.flatMap((suffix) => {
    const value = sourceCatalog.get(`${key}_${suffix}`)
    return value === undefined ? [] : [[suffix, value]]
  })

  return t.objectExpression([
    t.objectProperty(t.identifier('h'), t.numericLiteral(hashTranslationKey(key))),
    t.objectProperty(t.identifier('v'), t.stringLiteral(sourceCatalog.get(key))),
    ...(pluralForms.length === 0
      ? []
      : [
          t.objectProperty(
            t.identifier('p'),
            t.objectExpression(
              pluralForms.map(([suffix, value]) =>
                t.objectProperty(t.identifier(suffix), t.stringLiteral(value)),
              ),
            ),
          ),
        ]),
  ])
}

function inlineLocalizedTranslations(api, options = {}) {
  const { types: t } = api
  const precompile = options.precompileDeferredCatalogs === true
    && api.env('production') && api.caller((caller) => caller?.platform === 'web')
  return {
    name: 'metravel-inline-localized-translations',
    visitor: {
      Program(programPath, state) {
        const projectRoot = state.opts.projectRoot || process.cwd()
        const filename = state.filename || ''
        if (filename.includes(`${path.sep}i18n${path.sep}locales${path.sep}`)) return

        const deferred = /^(be|uk|pl|en)$/.exec(path.basename(filename, '.ts').replace(/^locale-/, ''))
        if (precompile && deferred && filename === path.resolve(projectRoot, 'i18n', 'deferred', `locale-${deferred[1]}.ts`)) {
          const locale = deferred[1]
          const body = programPath.node.body
          const namedImport = (node, source, name) => t.isImportDeclaration(node) && node.source.value === source && node.specifiers.length === 1 && t.isImportSpecifier(node.specifiers[0]) && t.isIdentifier(node.specifiers[0].imported, { name }) && t.isIdentifier(node.specifiers[0].local, { name })
          const exported = body[2]
          const declaration = t.isExportNamedDeclaration(exported) && exported.declaration
          const variable = t.isVariableDeclaration(declaration, { kind: 'const' }) && declaration.declarations.length === 1 && declaration.declarations[0]
          if (body.length !== 3 || !namedImport(body[0], '../catalogCompiler', 'compileLocaleCatalog') || !namedImport(body[1], `../locales/${locale}`, `${locale}Resources`) || !variable || !t.isIdentifier(variable.id, { name: `${locale}Catalog` }) || !t.isCallExpression(variable.init) || !t.isIdentifier(variable.init.callee, { name: 'compileLocaleCatalog' }) || variable.init.arguments.length !== 1 || !t.isIdentifier(variable.init.arguments[0], { name: `${locale}Resources` })) {
            throw programPath.buildCodeFrameError(`Unexpected deferred catalog module shape: ${locale}`)
          }
          const resources = loadRuntimeResources(projectRoot, locale, state.opts.catalogRevision)
          const entries = [...compileLocaleCatalog(resources)]
          programPath.node.body = [t.exportNamedDeclaration(t.variableDeclaration('const', [t.variableDeclarator(t.identifier(`${locale}Catalog`), t.newExpression(t.identifier('Map'), [t.valueToNode(entries)]))]))]
          return
        }

        const { localeCodes, catalogs } = loadCatalogs(projectRoot, state.opts.catalogRevision)
        const sourceCatalog = catalogs.get('ru')

        programPath.traverse({
          CallExpression(callPath) {
            const importedName = getImportedName(callPath)
            if (!TRANSLATE_IMPORTS.has(importedName)) return

            const firstArgument = callPath.get('arguments.0')
            if (!firstArgument?.isStringLiteral()) return
            const compiled = buildCompiledTranslation(
              t,
              firstArgument.node.value,
              localeCodes,
              catalogs,
            )
            if (compiled) firstArgument.replaceWith(compiled)
          },
          StringLiteral(stringPath) {
            if (!sourceCatalog.has(stringPath.node.value)) return
            const compiled = buildCompiledTranslation(
              t,
              stringPath.node.value,
              localeCodes,
              catalogs,
            )
            if (compiled) stringPath.replaceWith(compiled)
          },
        })
      },
    },
  }
}

module.exports = inlineLocalizedTranslations
// The production SSG generator reads the same RU baseline as the web inliner.
// Exporting the existing catalog reader keeps static HTML and hydrated SEO copy
// on one source without teaching a second parser about TypeScript resources.
module.exports.loadCatalogs = loadCatalogs
module.exports.loadSsgCatalogs = loadSsgCatalogs
module.exports.isSsgOnlyNamespace = isSsgOnlyNamespace
module.exports.getCatalogRevision = getCatalogRevision
module.exports.loadRuntimeResources = loadRuntimeResources
