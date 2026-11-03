/**
 * #2982: the deploy export runs on a warm Metro cache. Metro keys a transform
 * on the module, transform options, transformer files and babel.config.js only,
 * so every other input of the prod web transform must move `cacheVersion`
 * (scripts/lib/metroCacheInputs.js) — otherwise a warm deploy ships a module
 * built from a stale input. Each declared input gets a real edit below, and a
 * new input cannot be declared without one.
 */
import fs from 'fs'
import path from 'path'
import { makeTempDir, removeDir } from './cli-test-utils'

const ROOT = path.resolve(__dirname, '..', '..')
const inputs = require('@/scripts/lib/metroCacheInputs') as {
  TRANSFORM_CACHE_INPUTS: [string, (root: string) => string][]
  getTransformCacheRevision: (root: string) => string
  getReactiveLocaleRevision: (root: string, options?: { memoFile?: string | null }) => string
}

const LOCALES = ['ru', 'be', 'uk', 'pl', 'en']

const write = (root: string, relative: string, content: string) => {
  const file = path.join(root, relative)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

const makeFixture = (): string => {
  // Inside the repository so the copied plugins resolve typescript and Babel.
  const root = makeTempDir('metro-cache-inputs-', { root: path.join(ROOT, '.codex-temp') })
  fs.mkdirSync(path.join(root, 'i18n'))
  for (const file of ['babel-inline-plugin.js', 'catalogCompiler.js', 'babel-reactive-locale-plugin.js']) {
    fs.copyFileSync(path.join(ROOT, 'i18n', file), path.join(root, 'i18n', file))
  }
  for (const locale of LOCALES) {
    write(root, `i18n/locales/${locale}/index.ts`, `import { common } from './common'; export const ${locale}Resources = { common } as const;`)
    write(root, `i18n/locales/${locale}/common.ts`, "import data from './common.json'; export const common = { ...data } as const;")
    write(root, `i18n/locales/${locale}/common.json`, JSON.stringify({ value: 'old' }))
    fs.mkdirSync(path.join(root, `i18n/locales/${locale}/generated`), { recursive: true })
    fs.mkdirSync(path.join(root, `i18n/locales/${locale}/static`), { recursive: true })
  }
  write(root, 'package.json', JSON.stringify({
    name: 'metro-cache-inputs-fixture',
    version: '1.0.0',
    scripts: { postinstall: 'node scripts/fix-tool.js && node ./node_modules/patch-package/dist/index.js' },
  }))
  write(root, 'app.json', JSON.stringify({ expo: { name: 'Fixture', slug: 'fixture' } }))
  write(root, 'yarn.lock', 'lock v1\n')
  write(root, 'node_modules/.yarn-integrity', '{"lockfileEntries":{}}')
  write(root, 'patches/tool+1.0.0.patch', 'patch v1\n')
  write(root, 'scripts/fix-tool.js', '// fix v1\n')
  write(root, 'metro.config.js', '// metro v1\n')
  write(root, 'assets/images/pin@2x.png', 'pixels v1')
  write(root, 'utils/labels.ts', "export const statusLabel = () => 'Open'\nexport const plainLabel = () => 'Plain'\n")
  write(root, 'components/Status.tsx', [
    "import { useMemo } from 'react'",
    "import { statusLabel } from '@/utils/labels'",
    'export function Status() { const value = useMemo(() => statusLabel(), []); return <span>{value}</span> }',
    '',
  ].join('\n'))
  return root
}

const LOCALIZED_LABELS = "import { t } from '@/i18n'\nexport const statusLabel = () => t('status.open')\nexport const plainLabel = () => 'Plain'\n"

// One real edit per declared input. The keys must match TRANSFORM_CACHE_INPUTS.
const EDITS: Record<string, (root: string) => void> = {
  'locale-catalog': (root) => write(root, 'i18n/locales/uk/common.json', JSON.stringify({ value: 'new' })),
  'reactive-locale': (root) => write(root, 'utils/labels.ts', LOCALIZED_LABELS),
  'public-env': () => { process.env.EXPO_PUBLIC_METRO_CACHE_INPUTS_TEST = 'changed' },
  'expo-public-config': (root) => write(root, 'app.json', JSON.stringify({ expo: { name: 'Renamed', slug: 'fixture' } })),
  toolchain: (root) => write(root, 'yarn.lock', 'lock v2\n'),
  'scaled-assets': (root) => write(root, 'assets/images/pin@2x.png', 'pixels v2'),
  'metro-config': (root) => write(root, 'metro.config.js', '// metro v2\n'),
}

const parts = (root: string) => Object.fromEntries(inputs.TRANSFORM_CACHE_INPUTS.map(([name, revision]) => [name, revision(root)]))

describe('Metro transform cache inputs', () => {
  let root: string
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_METRO_CACHE_INPUTS_TEST
    root = makeFixture()
  })
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_METRO_CACHE_INPUTS_TEST
    removeDir(root)
  })

  it('has an edit for every declared input', () => {
    expect(Object.keys(EDITS).sort()).toEqual(inputs.TRANSFORM_CACHE_INPUTS.map(([name]) => name).sort())
  })

  it.each(Object.keys(EDITS))('moves the cache version when %s changes, and only that part', (name) => {
    const before = parts(root)
    expect(parts(root)).toEqual(before)
    const revision = inputs.getTransformCacheRevision(root)
    EDITS[name](root)
    const after = parts(root)
    expect(Object.keys(after).filter((key) => after[key] !== before[key])).toEqual([name])
    expect(inputs.getTransformCacheRevision(root)).not.toBe(revision)
  })

  // The inline plugin compiles every directory under i18n/locales, not only the
  // five runtime locales, so a new locale must move the catalog revision too.
  it('moves the catalog revision when a new locale directory appears', () => {
    const before = parts(root)
    write(root, 'i18n/locales/de/common.ts', "export const common = { value: 'neu' } as const;")
    const after = parts(root)
    expect(Object.keys(after).filter((key) => after[key] !== before[key])).toEqual(['locale-catalog'])
  })

  it('folds the module revision into metro.config.js cacheVersion for production', () => {
    const source = fs.readFileSync(path.join(ROOT, 'metro.config.js'), 'utf8')
    const branch = source.slice(source.indexOf("if (process.env.NODE_ENV === 'production') {"))
    expect(branch.slice(0, branch.indexOf('\n}\n'))).toContain(
      "config.cacheVersion = `${config.cacheVersion || ''}:${getTransformCacheRevision(__dirname)}`",
    )
  })

  // Metro picks `foo.web.png` and every scale next to `foo.png` while keying the
  // asset module by `foo.png` alone, wherever the asset lives in the project.
  it.each([
    'screens/icons/pin@3x.png',
    'ui/badge.web.png',
    'assets/images/pin@2x.web.png',
  ])('moves scaled-assets when the variant %s appears', (variant) => {
    const before = parts(root)['scaled-assets']
    write(root, variant, 'pixels')
    expect(parts(root)['scaled-assets']).not.toBe(before)
  })

  it('ignores platform source files and native or built directories', () => {
    const before = parts(root)['scaled-assets']
    write(root, 'components/Status.web.tsx', 'export const Status = () => null\n')
    write(root, 'ios/App/Images.xcassets/icon@2x.png', 'pixels')
    write(root, 'dist/assets/pin@2x.png', 'pixels')
    expect(parts(root)['scaled-assets']).toBe(before)
  })

  describe('cross-module locale decisions', () => {
    const revision = (memoFile: string | null) => inputs.getReactiveLocaleRevision(root, { memoFile })

    it('ignores a new import of a plain helper, so ordinary edits keep the warm cache', () => {
      const before = revision(null)
      write(root, 'components/Plain.tsx', "import { plainLabel } from '@/utils/labels'\nexport const Plain = () => <span>{plainLabel()}</span>\n")
      expect(revision(null)).toBe(before)
    })

    it('changes when a platform file shadows the resolved helper', () => {
      write(root, 'utils/labels.ts', LOCALIZED_LABELS)
      const before = revision(null)
      write(root, 'utils/labels.web.ts', "export const statusLabel = () => 'Open'\n")
      expect(revision(null)).not.toBe(before)
    })

    it('reuses remembered decisions only while every observed file is unchanged', () => {
      const memoFile = path.join(root, 'memo.json')
      const cold = revision(memoFile)
      expect(fs.existsSync(memoFile)).toBe(true)
      expect(revision(memoFile)).toBe(cold)
      write(root, 'utils/labels.ts', LOCALIZED_LABELS)
      const edited = revision(memoFile)
      expect(edited).toBe(revision(null))
      expect(edited).not.toBe(cold)
      write(root, 'utils/labels.web.ts', "export const statusLabel = () => 'Open'\n")
      expect(revision(memoFile)).toBe(revision(null))
      expect(revision(memoFile)).toBe(cold)
    })
  })
})
