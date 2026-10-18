import fs from 'node:fs'
import path from 'node:path'
import { transformSync } from '@babel/core'
import ts from 'typescript'

import { compileLocaleCatalog, hashTranslationKey } from '@/i18n/catalogCompiler'
import { resources } from '@/i18n/resources'

const ROOT = path.resolve(__dirname, '../..')
const plugin = require('@/i18n/babel-inline-plugin') as {
  (api: unknown, options: unknown): unknown
  getCatalogRevision: (root: string) => string
  loadRuntimeResources: (root: string, locale: string, revision: string) => Record<string, Record<string, string>>
  loadCatalogs: (root: string, revision: string) => { catalogs: Map<string, Map<string, string>> }
}
const locales = ['be', 'uk', 'pl', 'en'] as const
const rootSource = (locale: string) => fs.readFileSync(path.join(ROOT, `i18n/deferred/locale-${locale}.ts`), 'utf8')
const revision = plugin.getCatalogRevision(ROOT)
const transformRoot = (locale: string, options: { root?: string; revision?: string; env?: string; platform?: string; source?: string } = {}) => {
  const projectRoot = options.root || ROOT
  return transformSync(options.source || rootSource(locale), {
    configFile: false,
    babelrc: false,
    filename: path.join(projectRoot, `i18n/deferred/locale-${locale}.ts`),
    envName: options.env || 'production',
    caller: { name: 'metro', platform: options.platform || 'web' },
    plugins: [[plugin, { projectRoot, precompileDeferredCatalogs: true, catalogRevision: options.revision || revision }]],
  })!.code!
}
const evaluateRoot = (code: string, locale: string): Map<number, { value: string; plurals?: Record<string, string> }> => {
  const result: Record<string, unknown> = {}
  const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('exports', 'require', js)(result, () => { throw new Error('Production catalog retained a runtime import') })
  return result[`${locale}Catalog`] as ReturnType<typeof evaluateRoot>
}

describe('production web locale catalog compilation', () => {
  it.each(locales)('ships every %s literal and plural in the exact runtime Map order', (locale) => {
    const actualResources = resources[locale] as unknown as Record<string, Record<string, string>>
    const ordered = plugin.loadRuntimeResources(ROOT, locale, revision)
    // Entry order matters for Map overwrite/collision semantics, not just values.
    expect(Object.entries(ordered).map(([namespace, entries]) => [namespace, Object.entries(entries)]))
      .toEqual(Object.entries(actualResources).map(([namespace, entries]) => [namespace, Object.entries(entries)]))
    const code = transformRoot(locale)
    const emittedAst = ts.createSourceFile('catalog.ts', code, ts.ScriptTarget.Latest, true)
    expect(emittedAst.statements.some(ts.isImportDeclaration)).toBe(false)
    expect(code).not.toContain('compileLocaleCatalog')
    const emitted = evaluateRoot(code, locale)
    expect([...emitted]).toEqual([...compileLocaleCatalog(actualResources)])
    for (const [namespace, entries] of Object.entries(actualResources)) {
      for (const [key, value] of Object.entries(entries)) {
        expect(emitted.get(hashTranslationKey(`${namespace}:${key}`))?.value).toBe(value)
        if (!/_(zero|one|two|few|many|other)$/.test(key)) {
          const pluralForms = Object.fromEntries(Object.entries(entries)
            .filter(([candidate]) => candidate.startsWith(`${key}_`) && /_(zero|one|two|few|many|other)$/.test(candidate) && candidate.slice(0, candidate.lastIndexOf('_')) === key)
            .map(([candidate, translation]) => [candidate.slice(candidate.lastIndexOf('_') + 1), translation]))
          if (Object.keys(pluralForms).length) expect(emitted.get(hashTranslationKey(`${namespace}:${key}`))?.plurals).toEqual(pluralForms)
        }
      }
    }
  })

  it.each([
    ['development', 'web'], ['test', 'web'], ['production', 'ios'], ['production', 'android'],
  ])('leaves the resource graph in %s/%s available to the ordinary compiler', (env, platform) => {
    const code = transformRoot('uk', { env, platform })
    expect(code).toContain('../locales/uk')
    expect(code).toContain('../catalogCompiler')
    expect(code).toContain('compileLocaleCatalog(ukResources)')
  })

  it('fails closed if a canonical deferred root gains executable work', () => {
    expect(() => transformRoot('uk', { source: rootSource('uk') + '\nperformUnexpectedWork();\n' }))
      .toThrow('Unexpected deferred catalog module shape')
  })

  it('preserves base-last plurals, explicit suffixes, missing bases and overwrite order', () => {
    const compiled = compileLocaleCatalog({
      first: { noun_other: 'many', noun_one: 'one', noun: 'base', orphan_few: 'orphan', 'second:shared': 'earlier' },
      'first:second': { shared: 'later' },
    })
    expect(compiled.get(hashTranslationKey('first:noun'))).toEqual({ value: 'base', plurals: { other: 'many', one: 'one' } })
    expect(compiled.get(hashTranslationKey('first:noun_one'))).toEqual({ value: 'one' })
    expect(compiled.get(hashTranslationKey('first:orphan_few'))).toEqual({ value: 'orphan' })
    expect(compiled.has(hashTranslationKey('first:orphan'))).toBe(false)
    expect(compiled.get(hashTranslationKey('first:second:shared'))).toEqual({ value: 'later' })
  })
})

describe('catalog external input revision', () => {
  let fixture: string
  beforeEach(() => {
    fs.mkdirSync(path.join(ROOT, '.codex-temp'), { recursive: true })
    fixture = fs.mkdtempSync(path.join(ROOT, '.codex-temp/i18n-catalog-inputs-'))
    for (const locale of ['ru', ...locales]) {
      const dir = path.join(fixture, 'i18n/locales', locale)
      fs.mkdirSync(path.join(dir, 'generated'), { recursive: true })
      fs.mkdirSync(path.join(dir, 'static'), { recursive: true })
      fs.writeFileSync(path.join(dir, 'index.ts'), `import { common } from './common'; export const ${locale}Resources = { common } as const;`)
      fs.writeFileSync(path.join(dir, 'common.ts'), "import data from './common.json'; export const common = { ...data } as const;")
      fs.writeFileSync(path.join(dir, 'common.json'), JSON.stringify({ value: 'oldvalue' }))
    }
  })
  afterEach(() => fs.rmSync(fixture, { recursive: true, force: true }))

  it('changes the warm-cache revision and both memoized readers for a same-size JSON edit', () => {
    const first = plugin.getCatalogRevision(fixture)
    const before = evaluateRoot(transformRoot('uk', { root: fixture, revision: first }), 'uk')
    expect(plugin.loadCatalogs(fixture, first).catalogs.get('uk')!.get('common:value')).toBe('oldvalue')
    const file = path.join(fixture, 'i18n/locales/uk/common.json')
    const stat = fs.statSync(file)
    fs.writeFileSync(file, JSON.stringify({ value: 'newvalue' }))
    fs.utimesSync(file, stat.atime, stat.mtime)
    const second = plugin.getCatalogRevision(fixture)
    expect(second).not.toBe(first)
    expect(plugin.getCatalogRevision(fixture)).toBe(second)
    const after = evaluateRoot(transformRoot('uk', { root: fixture, revision: second }), 'uk')
    expect(before.get(hashTranslationKey('common:value'))?.value).toBe('oldvalue')
    expect(after.get(hashTranslationKey('common:value'))?.value).toBe('newvalue')
    expect(plugin.loadCatalogs(fixture, second).catalogs.get('uk')!.get('common:value')).toBe('newvalue')
  })

  it('includes import graph wiring, not just leaf values, in the revision', () => {
    const first = plugin.getCatalogRevision(fixture)
    const file = path.join(fixture, 'i18n/locales/pl/index.ts')
    fs.appendFileSync(file, '\n// changed graph source\n')
    expect(plugin.getCatalogRevision(fixture)).not.toBe(first)
  })

  it('invalidates the catalog revision when either shared compiler or build plugin source changes', () => {
    const pluginFile = path.join(fixture, 'i18n/babel-inline-plugin.js')
    const compilerFile = path.join(fixture, 'i18n/catalogCompiler.js')
    fs.copyFileSync(path.join(ROOT, 'i18n/babel-inline-plugin.js'), pluginFile)
    fs.copyFileSync(path.join(ROOT, 'i18n/catalogCompiler.js'), compilerFile)
    const fixturePlugin = require(pluginFile) as typeof plugin
    const first = fixturePlugin.getCatalogRevision(fixture)
    fs.appendFileSync(compilerFile, '\n// compiler revision\n')
    const second = fixturePlugin.getCatalogRevision(fixture)
    expect(second).not.toBe(first)
    fs.appendFileSync(pluginFile, '\n// plugin revision\n')
    expect(fixturePlugin.getCatalogRevision(fixture)).not.toBe(second)
  })

  it('rejects an executable resource expression instead of shipping an incomplete catalog', () => {
    fs.writeFileSync(path.join(fixture, 'i18n/locales/uk/common.ts'), "export const common = { value: readTranslation() }")
    expect(() => plugin.getCatalogRevision(fixture)).toThrow('Unsupported catalog data expression')
  })

  it.each(['__proto__', '"__proto__"'])('rejects object-literal prototype setter syntax %s rather than inventing a translation', (key) => {
    fs.writeFileSync(path.join(fixture, 'i18n/locales/uk/common.ts'), `export const common = { value: 'ok', ${key}: 'not-an-own-key' }`)
    expect(() => plugin.getCatalogRevision(fixture)).toThrow('Unsupported catalog data expression')
  })

  it('preserves __proto__ as ordinary data when spread from JSON', () => {
    fs.writeFileSync(path.join(fixture, 'i18n/locales/uk/common.json'), '{"__proto__":"prototype-label","value":"ok"}')
    const current = plugin.getCatalogRevision(fixture)
    const emitted = evaluateRoot(transformRoot('uk', { root: fixture, revision: current }), 'uk')
    expect(emitted.get(hashTranslationKey('common:__proto__'))).toEqual({ value: 'prototype-label' })
  })

  it('rejects an import that escapes its locale tree', () => {
    fs.writeFileSync(path.join(fixture, 'i18n/locales/uk/index.ts'), "import { common } from '../ru/common'; export const ukResources = { common }")
    expect(() => plugin.getCatalogRevision(fixture)).toThrow('Catalog import escapes locale')
  })
})
