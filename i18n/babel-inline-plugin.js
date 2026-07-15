/* global module, process, require */

const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const cache = new Map()
const TRANSLATE_IMPORTS = new Set(['translate', 'translatePlural'])
const PLURAL_SUFFIXES = ['one', 'few', 'many', 'other', 'zero', 'two']

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

const loadCatalogs = (projectRoot) => {
  const cached = cache.get(projectRoot)
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
        namespace: (name) => `${name.replace(/_static$/, '')}Static`,
      },
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

    for (const [key, value] of readObjectEntries(
      path.join(localeRoot, 'common.ts'),
    )) {
      catalog.set(`common:${key}`, value)
    }
    catalogs.set(locale, catalog)
  }

  const result = { localeCodes, catalogs }
  cache.set(projectRoot, result)
  return result
}

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

const hashTranslationKey = (key) => {
  let hash = 0x811c9dc5
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
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

module.exports = function inlineLocalizedTranslations({ types: t }) {
  return {
    name: 'metravel-inline-localized-translations',
    visitor: {
      Program(programPath, state) {
        const projectRoot = state.opts.projectRoot || process.cwd()
        const filename = state.filename || ''
        if (filename.includes(`${path.sep}i18n${path.sep}locales${path.sep}`)) return

        const { localeCodes, catalogs } = loadCatalogs(projectRoot)
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
