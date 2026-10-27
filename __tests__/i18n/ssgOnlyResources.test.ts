import fs from 'node:fs'
import path from 'node:path'

import { ssgOnlyResources } from '@/i18n/ssgResources'
import { resources } from '@/i18n/resources'

/**
 * #2399 (ROUTE-BUNDLE-001): строки, которые печатает только серверная сторона
 * публикации (SSR-проекция квестов, постобработка оболочек маршрутов), живут
 * в `i18n/locales/<locale>/ssg/*_ssg.ts` под namespace `…Ssg`. Рантайм-ресурсы
 * их не импортируют, поэтому они не попадают ни в клиентские locale-чанки
 * BE/UK/PL/EN, ни в native-бандл. Гейт держит обе стороны границы: каталог
 * сборки читает ровно эти ресурсы, а код приложения к ним не обращается.
 */
const ROOT = path.resolve(__dirname, '../..')
const LOCALES = ['ru', 'be', 'uk', 'pl', 'en'] as const
type Catalogs = Map<string, Map<string, string>>
const plugin = require('@/i18n/babel-inline-plugin') as {
  loadCatalogs: (root: string) => { catalogs: Catalogs }
  loadSsgCatalogs: (root: string) => { catalogs: Catalogs }
  isSsgOnlyNamespace: (namespace: string) => boolean
}

const SSG_NAMESPACES = Object.keys(ssgOnlyResources.ru)
const namespaceOf = (key: string) => key.slice(0, key.indexOf(':'))

// Исходники клиентского графа: web-бандл и native-бандл (тот же набор, что в
// `__tests__/scripts/bundle-composition.test.ts`). Сам контракт SSG-only
// ресурсов и ридер каталогов сюда не входят.
const CLIENT_DIRS = [
  'api', 'app', 'components', 'config', 'constants', 'context', 'hooks', 'i18n',
  'metro-stubs', 'screens', 'services', 'stores', 'styles', 'types', 'ui', 'utils',
]
const CONTRACT_FILES = new Set(['i18n/ssgResources.ts', 'i18n/babel-inline-plugin.js'])
const isSsgCatalogFile = (relative: string) => /^i18n\/locales\/[^/]+\/ssg\//.test(relative)

const clientSourceFiles = (): string[] => {
  const out: string[] = []
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) out.push(full)
    }
  }
  CLIENT_DIRS.forEach((dir) => walk(path.join(ROOT, dir)))
  return out
    .map((file) => path.relative(ROOT, file).split(path.sep).join('/'))
    .filter((relative) => !CONTRACT_FILES.has(relative) && !isSsgCatalogFile(relative))
}

const KEY_REFERENCE = new RegExp(`\\b(?:${SSG_NAMESPACES.join('|')}):[\\w.$\\{]`)
const MODULE_REFERENCE = /(?:from\s+|require\(\s*|import\(\s*)['"](?:[^'"]*\/)?(?:ssg(?:\/[^'"]*)?|ssgResources)['"]/

// Исходная утечка #2365: SSG-only ключ лёг в рантайм-namespace (`seoStatic`).
// Литеральный рантайм-ключ, который печатает серверная сторона публикации,
// обязан читаться и клиентом; иначе это SSG-only строка, и её место — `ssg/`.
// С #2766 статический генератор снят: ключи печатают SSR-проекция квестов и
// постобработка оболочек маршрутов.
const SSG_GENERATOR_FILES = [
  'scripts/lib/questWebProjection.js',
  'scripts/lib/questLocalePackage.js',
  'scripts/postprocess-route-shells.js',
]
const LITERAL_KEY = /['"`]([A-Za-z]\w*):([\w.]+)['"`]/g

const generatorOnlyRuntimeKeys = (runtime: Map<string, string>, clientSource: string) => {
  const runtimeNamespaces = new Set(Array.from(runtime.keys(), namespaceOf))
  const printed = new Set<string>()
  for (const file of SSG_GENERATOR_FILES) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
    for (const [, namespace, key] of source.matchAll(LITERAL_KEY)) {
      const full = `${namespace}:${key}`
      if (!runtimeNamespaces.has(namespace)) continue
      if (runtime.has(full) || runtime.has(`${full}_other`)) printed.add(full)
    }
  }
  return Array.from(printed).filter((full) => !clientSource.includes(full))
}

const offendersIn = (relative: string, source: string) =>
  [KEY_REFERENCE.test(source) ? `${relative}: SSG-only key` : '', MODULE_REFERENCE.test(source) ? `${relative}: SSG-only module` : '']
    .filter(Boolean)

describe('SSG-only translation resources (#2399)', () => {
  it('names every SSG-only namespace with the Ssg suffix', () => {
    expect(SSG_NAMESPACES.length).toBeGreaterThan(0)
    expect(SSG_NAMESPACES.filter((namespace) => !plugin.isSsgOnlyNamespace(namespace))).toEqual([])
  })

  it('keeps SSG-only namespaces out of runtime resources and the web inliner catalog', () => {
    const runtime = plugin.loadCatalogs(ROOT).catalogs
    const leaks = LOCALES.flatMap((locale) => [
      ...Object.keys(resources[locale]).filter(plugin.isSsgOnlyNamespace).map((ns) => `resources.${locale}.${ns}`),
      ...Array.from(runtime.get(locale)!.keys()).filter((key) => plugin.isSsgOnlyNamespace(namespaceOf(key))).map((key) => `inliner ${locale} ${key}`),
    ])
    expect(leaks).toEqual([])
  })

  it.each(LOCALES)('%s: the SSG catalog is the runtime catalog plus exactly the typed SSG-only resources', (locale) => {
    const runtime = plugin.loadCatalogs(ROOT).catalogs.get(locale)!
    const ssg = plugin.loadSsgCatalogs(ROOT).catalogs.get(locale)!
    const expected = new Map(runtime)
    for (const [namespace, entries] of Object.entries(ssgOnlyResources[locale])) {
      for (const [key, value] of Object.entries(entries)) expected.set(`${namespace}:${key}`, value as string)
    }
    expect(Object.fromEntries(ssg)).toEqual(Object.fromEntries(expected))
  })

  it('application source never references SSG-only keys or modules', () => {
    const offenders = clientSourceFiles().flatMap((relative) =>
      offendersIn(relative, fs.readFileSync(path.join(ROOT, relative), 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('every runtime key the server-side publication prints is also read by the client', () => {
    const runtime = plugin.loadCatalogs(ROOT).catalogs.get('ru')!
    const clientSource = clientSourceFiles()
      .filter((relative) => !relative.startsWith('i18n/locales/'))
      .map((relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8'))
      .join('\n')
    const printedKeys = generatorOnlyRuntimeKeys(runtime, '')
    expect(printedKeys.length).toBeGreaterThan(0)
    expect(generatorOnlyRuntimeKeys(runtime, clientSource)).toEqual([])
  })

  it('the detector catches a key, a template key and a module import', () => {
    expect(offendersIn('probe.tsx', "t('seoSsg:questDetail.kicker')")).toHaveLength(1)
    expect(offendersIn('probe.tsx', 't(`seoSsg:${key}`)')).toHaveLength(1)
    expect(offendersIn('probe.tsx', "import { ssgOnlyResources } from '@/i18n/locales/en/ssg'")).toHaveLength(1)
    expect(offendersIn('probe.tsx', "import { ssgOnlyResources } from '@/i18n/ssgResources'")).toHaveLength(1)
    expect(offendersIn('i18n/locales/en/index.ts', "import { ssgOnlyResources } from './ssg'")).toHaveLength(1)
    expect(offendersIn('probe.tsx', "t('seoStatic:root.home.title')")).toEqual([])
    expect(offendersIn('probe.tsx', "import { injectSkeletonShell } from './ssg-skeletons'")).toEqual([])
  })
})
