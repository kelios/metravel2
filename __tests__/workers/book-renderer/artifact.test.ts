/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { PRINT_ASSET_RECIPE, PRINT_VARIANT_RECIPE, PRINT_ORIENTED_VARIANT_RECIPE } from '@/services/pdf-export/segments/printAssetsTypes'

const ROOT = path.resolve(__dirname, '../../..')
const { buildBookRenderer, moduleCalls } = require('../../../scripts/build-book-renderer')
const { canonicalFontsUrl, verifiedFontBundle, FONT_ORIGIN } = require('../../../scripts/prepare-book-renderer-fonts')
const COVER_KEY = 'export:services.pdf_export.generators.v2.runtime.coverPage.div_class_cover_footer_rail_style_margin_0_2_c8afe335.text01'
const hash = (content: string | Buffer) => crypto.createHash('sha256').update(content).digest('hex')
let scratch: string
let entry: string
let artifact: ReturnType<typeof buildBookRenderer>
let worker: any

beforeAll(() => {
  fs.mkdirSync(path.join(ROOT, '.codex-temp'), { recursive: true })
  scratch = fs.mkdtempSync(path.join(ROOT, '.codex-temp/book-artifact-test-'))
  entry = path.relative(ROOT, path.join(scratch, 'entry.ts'))
  fs.writeFileSync(path.join(ROOT, entry), `
    export * from '@/i18n'
    export * from '@/utils/imageAnalysis'
    export { getThemeConfig } from '@/services/pdf-export/themes/PdfThemeConfig'
    export { parseHtmlBody } from '@/services/pdf-export/parsers/contentParser/htmlTree'
    export { buildPrintImageUrl } from '@/utils/printImageUrl'
    export { resolveImageAspect, lookupDescriptionImageAspect } from '@/services/pdf-export/utils/imageAspects'
    export { incrementalContentStep } from '@/workers/book-renderer/htmlCheckpoint/incrementalStep'
    export { preparePlanningStep } from '@/workers/book-renderer/planningStep'
  `)
  artifact = buildBookRenderer({ root: ROOT, entry, outDir: path.join(scratch, 'artifact') })
  worker = require(path.join(artifact.outDir, artifact.manifest.entrypoint))
})

afterAll(() => { if (scratch) fs.rmSync(scratch, { recursive: true, force: true }) })

describe('versioned Node book renderer artifact', () => {
  it('pins schemas, shared renderer sources and transitive runtime resolutions with reproducible hashes', () => {
    const rebuilt = buildBookRenderer({ root: ROOT, entry, outDir: path.join(scratch, 'rebuilt') })
    expect(rebuilt.manifest).toEqual(artifact.manifest)
    expect(artifact.manifest).toMatchObject({
      renderer_version: 'metravel-book-renderer/1.0.0',
      document_schema_version: 1,
      prepared_source_schema_version: 5,
      settings_schema_version: 1,
      planning_protocol_version: 2,
      html_checkpoint: { protocol_version: 1 },
    })
    expect(artifact.manifest.print_asset_recipe).toEqual(PRINT_ASSET_RECIPE)
    expect(artifact.manifest.print_variant_recipe).toEqual(PRINT_VARIANT_RECIPE)
    const canonicalRecipe = (recipe: typeof PRINT_ASSET_RECIPE | typeof PRINT_VARIANT_RECIPE | typeof PRINT_ORIENTED_VARIANT_RECIPE) =>
      JSON.stringify(Object.fromEntries(Object.entries(recipe).sort(([left], [right]) => left.localeCompare(right))))
    expect(artifact.manifest.legacy_print_resource_policy_hash).toBe(hash(canonicalRecipe(PRINT_ASSET_RECIPE)))
    expect(artifact.manifest.print_variant_resource_policy_hash).toBe(hash(canonicalRecipe(PRINT_VARIANT_RECIPE)))
    expect(artifact.manifest.print_oriented_variant_recipe).toEqual(PRINT_ORIENTED_VARIANT_RECIPE)
    expect(artifact.manifest.print_resource_policy_hash).toBe(hash(canonicalRecipe(PRINT_ORIENTED_VARIANT_RECIPE)))
    expect(artifact.manifest.print_encoder_pin.chromium_version).toMatch(/^\d+\.\d+\.\d+\.\d+$/)
    expect(artifact.manifest.content_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(artifact.manifest.source_hash).toMatch(/^[a-f0-9]{64}$/)
    const records = artifact.manifest.files as { path: string; sha256: string; size_bytes: number }[]
    const payload = records.map((record) => {
      const bytes = fs.readFileSync(path.join(artifact.outDir, record.path))
      expect(hash(bytes)).toBe(record.sha256)
      expect(bytes.byteLength).toBe(record.size_bytes)
      return `${record.path}\0${bytes.byteLength}\0${bytes.toString('utf8')}\0`
    }).join('')
    expect(hash(payload)).toBe(artifact.manifest.content_hash)
    expect(records.some((record) => record.path.endsWith('themes/configs/modern.js'))).toBe(true)
    expect(records.some((record) => record.path.endsWith('htmlTree.parse5.js'))).toBe(true)
    const packageJson = JSON.parse(fs.readFileSync(path.join(artifact.outDir, 'package.json'), 'utf8'))
    expect(packageJson.dependencies.parse5).toMatch(/^\d+\.\d+\.\d+$/)
    const lock = fs.readFileSync(path.join(artifact.outDir, 'yarn.lock'), 'utf8')
    expect(lock).toContain(`"parse5@${packageJson.dependencies.parse5}":`)
  })

  it('ships original license notices and binds the exact upstream parser sources independently of the modified port', () => {
    const metadata = artifact.manifest.html_checkpoint
    expect(metadata.upstream_pin).toMatch(/^[a-f0-9]{64}$/)
    for (const ref of [metadata.upstream, ...metadata.licenses]) {
      expect(fs.readFileSync(path.join(artifact.outDir, ref))).toEqual(fs.readFileSync(path.join(ROOT, ref)))
    }
    expect(fs.readFileSync(path.join(artifact.outDir, metadata.licenses[0]), 'utf8')).toContain('MIT')
    expect(fs.readFileSync(path.join(artifact.outDir, metadata.licenses[1]), 'utf8')).toContain('Redistribution')
    const originalRead = fs.readFileSync
    const parser = path.join(ROOT, 'node_modules/htmlparser2/src/Parser.ts')
    const spy = jest.spyOn(fs, 'readFileSync').mockImplementation(((file: fs.PathOrFileDescriptor, ...args: unknown[]) => {
      if (String(file) === parser) return Buffer.from('changed upstream source')
      return (originalRead as (...values: unknown[]) => unknown)(file, ...args)
    }) as typeof fs.readFileSync)
    try {
      expect(() => buildBookRenderer({ root: ROOT, entry, outDir: path.join(scratch, 'changed-upstream') }))
        .toThrow('HTML checkpoint upstream source changed')
      expect(fs.existsSync(path.join(scratch, 'changed-upstream/renderer-manifest.json'))).toBe(false)
    } finally { spy.mockRestore() }
  })

  it('has no unresolved app aliases, React, Expo or browser platform imports', () => {
    for (const record of artifact.manifest.files as { path: string }[]) {
      if (!record.path.endsWith('.js')) continue
      const code = fs.readFileSync(path.join(artifact.outDir, record.path), 'utf8')
      for (const { specifier } of moduleCalls(code, record.path)) {
        expect(specifier).not.toMatch(/^@\//)
        expect(specifier).not.toMatch(/^(?:react(?:-native|-dom)?|expo(?:-|\/|$))/)
        expect(specifier).not.toMatch(/\.web\./)
      }
    }
    const config = fs.readFileSync(path.join(artifact.outDir, 'i18n/config.js'), 'utf8')
    expect(config).not.toMatch(/expo-localization|\bdocument\b|\bnavigator\b/)
    const imagePolicy = fs.readFileSync(path.join(artifact.outDir, 'utils/imageAnalysis.js'), 'utf8')
    expect(imagePolicy).not.toMatch(/\bwindow\b|\bdocument\b|new Image/)
    expect(worker.parseHtmlBody('<p>shared parser</p>').childNodes.length).toBeGreaterThan(0)
    expect(worker.getThemeConfig('modern').name).toBe('modern')
  })

  it('reuses canonical print widths and aspect lookup without rewriting immutable worker asset identities', () => {
    const asset = 'https://book-snapshot.invalid/assets/' + 'a'.repeat(64)
    expect(worker.buildPrintImageUrl(asset, 2500)).toBe(asset)
    const printUrl = new URL(worker.buildPrintImageUrl('https://metravel.by/media-resize/legacy/photo.webp', 1700))
    expect(printUrl.searchParams.get('w')).toBe('1920')
    expect(printUrl.searchParams.get('q')).toBe('85')
    expect(worker.resolveImageAspect({ width: 1200, height: 600 })).toBe(2)
    expect(worker.lookupDescriptionImageAspect({ ['assets/' + 'a'.repeat(64)]: 2 }, asset)).toBe(2)
  })

  it.each([
    ['react-native', 'export { Platform } from "react-native"'],
    ['browser adapter', 'export * from "@/services/pdf-export/parsers/contentParser/htmlTree.web"'],
    ['dynamic dependency', 'const name = "react-native"; module.exports = require(name)'],
  ])('rejects a %s regression in the artifact entry', (_name, regression) => {
    const file = path.join(scratch, 'regressed.ts')
    fs.writeFileSync(file, regression)
    expect(() => buildBookRenderer({ root: ROOT, entry: path.relative(ROOT, file),
      outDir: path.join(scratch, 'invalid') })).toThrow(/Forbidden|static module references/)
    expect(fs.existsSync(path.join(scratch, 'invalid/renderer-manifest.json'))).toBe(false)
  })

  it('refuses outputs outside scratch and existing non-artifact directories', () => {
    expect(() => buildBookRenderer({ root: ROOT, entry, outDir: path.join(ROOT, 'workers') }))
      .toThrow('inside ignored .codex-temp/')
    const occupied = path.join(scratch, 'occupied')
    fs.mkdirSync(occupied)
    fs.writeFileSync(path.join(occupied, 'keep.txt'), 'keep')
    expect(() => buildBookRenderer({ root: ROOT, entry, outDir: occupied }))
      .toThrow('non-artifact output directory')
    expect(fs.readFileSync(path.join(occupied, 'keep.txt'), 'utf8')).toBe('keep')
  })
})

describe('worker locale and image ports', () => {
  it.each([
    ['RU', 'Книга путешествий'], ['BE', 'Кніга падарожжаў'], ['UK', 'Книга подорожей'],
    ['PL', 'Książka podróżnicza'], ['EN', 'Travel book'],
  ])('uses the canonical %s catalog, fixed dates and language metadata', (locale, expected) => {
    worker.withWorkerLocale(locale, () => {
      expect(worker.translate(COVER_KEY)).toBe(expected)
      expect(worker.i18n.resolvedLanguage).toBe(locale.toLowerCase())
      const options = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }
      expect(worker.formatDate('2024-12-20T12:00:00Z', options)).toBe(
        new Intl.DateTimeFormat(worker.getFormatLocale(), options as Intl.DateTimeFormatOptions)
          .format(new Date('2024-12-20T12:00:00Z')),
      )
    })
  })

  it('selects canonical plural forms and isolates simultaneous job locales', async () => {
    const key = 'errors:utils.pluralize.photosCount'
    expect(worker.withWorkerLocale('PL', () => worker.translatePlural(key, 1))).toBe('1 zdjęcie')
    expect(worker.withWorkerLocale('PL', () => worker.translate(key, { count: 2 }))).toBe('2 zdjęcia')
    expect(worker.withWorkerLocale('PL', () => worker.translatePlural(key, 5))).toBe('5 zdjęć')
    const result = await Promise.all(['PL', 'EN'].map((locale) => worker.withWorkerLocale(locale, async () => {
      await Promise.resolve()
      return worker.translate(COVER_KEY)
    })))
    expect(result).toEqual(['Książka podróżnicza', 'Travel book'])
    expect(worker.translate(COVER_KEY)).toBe('Книга путешествий')
    expect(worker.getFixedTranslator('be')(COVER_KEY)).toBe('Кніга падарожжаў')
    expect(() => worker.withWorkerLocale('DE', () => undefined)).toThrow('Unsupported worker locale')
  })

  it('reuses image policies while scoping the bounded analyzer per job', async () => {
    const analyzer = {
      brightness: async () => 190,
      composition: async () => ({ topBusy: 0.2, centerBusy: 0.6, bottomBusy: 0.9 }),
    }
    const result = await worker.withImageAnalysis(analyzer, async () => {
      const brightness = await worker.analyzeImageBrightness('frozen-asset')
      return { opacity: worker.getOptimalOverlayOpacity(brightness),
        position: worker.getOptimalTextPosition(await worker.analyzeImageComposition('frozen-asset')) }
    })
    expect(result).toEqual({ opacity: 0.7, position: 'top' })
    expect(await worker.analyzeImageBrightness('')).toBe(128)
    expect(await worker.analyzeImageComposition('')).toEqual({ topBusy: 0.5, centerBusy: 0.5, bottomBusy: 0.5 })
    await expect(worker.withImageAnalysis({ ...analyzer, brightness: async () => NaN },
      () => worker.analyzeImageBrightness('frozen-asset'))).rejects.toThrow('Invalid worker image brightness')
  })
})

describe('offline font bundle integrity', () => {
  it('tracks exactly the canonical family request and verifies every byte before accepting a bundle', () => {
    const liveLock = JSON.parse(fs.readFileSync(path.join(ROOT, 'workers/book-renderer/fonts.lock.json'), 'utf8'))
    expect(liveLock.source_url).toBe(canonicalFontsUrl(ROOT))
    expect(liveLock.files.length).toBeGreaterThan(0)
    expect(liveLock.files.every((record: { path: string; sha256: string }) => record.path === `${record.sha256}.woff2`)).toBe(true)

    const fixtureRoot = path.join(scratch, 'font-source')
    const fontDir = path.join(scratch, 'fixture-fonts')
    const sourcePath = 'services/pdf-export/generators/v2/runtime/pdfRuntimeMarkup/htmlDocument.ts'
    fs.mkdirSync(path.dirname(path.join(fixtureRoot, sourcePath)), { recursive: true })
    fs.mkdirSync(path.join(fixtureRoot, 'workers/book-renderer'), { recursive: true })
    fs.mkdirSync(fontDir)
    const sourceUrl = 'https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap'
    fs.writeFileSync(path.join(fixtureRoot, sourcePath), `const fontLink = "${sourceUrl}"`)
    const bytes = Buffer.from('wOF2fixture')
    const sha256 = hash(bytes)
    const filename = `${sha256}.woff2`
    const css = `@font-face { font-family: Inter; src: url(${FONT_ORIGIN}${filename}); }`
    const lock = { source_url: sourceUrl, stylesheet_sha256: hash(css), stylesheet_size_bytes: Buffer.byteLength(css),
      files: [{ path: filename, sha256, size_bytes: bytes.length }] }
    const lockText = JSON.stringify(lock)
    fs.writeFileSync(path.join(fixtureRoot, 'workers/book-renderer/fonts.lock.json'), lockText)
    fs.writeFileSync(path.join(fontDir, 'fonts.lock.json'), lockText)
    fs.writeFileSync(path.join(fontDir, 'fonts.css'), css)
    fs.writeFileSync(path.join(fontDir, filename), bytes)
    expect(verifiedFontBundle(fontDir, fixtureRoot).records).toHaveLength(3)
    fs.writeFileSync(path.join(fontDir, filename), Buffer.from('corruption'))
    expect(() => verifiedFontBundle(fontDir, fixtureRoot)).toThrow('checksum mismatch')
  })
})
