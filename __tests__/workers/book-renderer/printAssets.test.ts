/** @jest-environment node */
import { workerImageFilterStyle } from '@/services/pdf-export/segments/workerImageEffects'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Page, BrowserContext } from 'playwright'
import { assertPrintResourceBinding, assertPrintVariantBinding, PRINT_VARIANT_RECIPE, PRINT_ASSET_RECIPE, type PrintResourceBinding } from '@/services/pdf-export/segments/printAssetsTypes'
import { PrintAssetCache, PRINT_RESOURCE_POLICY_HASH, checkPrintWorkingBudget, encodePrintImage, printDimensions, transformPrintResourceUrls } from '@/workers/book-renderer/printAssets'
import { canonicalJson, readBoundedBytes, sha256 } from '@/workers/book-renderer/filesystem'
import { DEFAULT_RENDERER_RESOURCE_PROFILE } from '@/workers/book-renderer/measurement'
import { subdivideSource } from '@/services/pdf-export/segments/subdivideSource'
import type { BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'

const identity = { browser_name: 'chromium' as const, playwright_version: '1.61.1', chromium_revision: '1228', chromium_version: '149.0.7827.55', executable_sha256: 'c'.repeat(64), platform: 'fixture', arch: 'fixture' }
const original = 'a'.repeat(64), served = 'b'.repeat(64)
const binding = (): PrintResourceBinding => ({ original_checksum: original, served_checksum: served,
  descriptor_ref: `print-cache/${'d'.repeat(64)}.json`, descriptor_checksum: 'e'.repeat(64), served_file_ref: `print-assets/${served}`,
  mode: 'encoded', mime: 'image/jpeg', width: 100, height: 100, encoded_bytes: 300, original_encoded_bytes: 900,
  original_transfer_bytes: 1200, original_pixels: 20_000, alpha_canvas_pixels: 0, alpha_scratch_bytes: 0,
  canvas_pixels: 10_000, encoder_pixels: 10_000, served_pixels: 10_000, transfer_bytes: 400, pixel_scratch_bytes: 6400,
  recipe_hash: PRINT_RESOURCE_POLICY_HASH, encoder_identity_hash: sha256(canonicalJson(identity)) })

it('fails closed when a bounded file grows after fstat instead of returning a truncated prefix', async () => {
  const close = jest.fn()
  const handle = { stat: async () => ({ isFile: () => true, size: 2 }), close,
    read: async (buffer: Buffer) => { buffer.fill(1); return { bytesRead: buffer.length } } }
  const open = jest.spyOn(require('node:fs/promises'), 'open').mockResolvedValueOnce(handle)
  try {
    await expect(readBoundedBytes('mock-growing-file', 100)).rejects.toThrow('WORKER_SOURCE_CHANGED_DURING_READ')
    expect(close).toHaveBeenCalledTimes(1)
  } finally { open.mockRestore() }
})

it('rewrites only image resources and CSS url(), preserving literal authored URLs and href/proof attributes', () => {
  const url = `https://book-snapshot.invalid/assets/${original}`
  const html = `<style>.x{background:url('${url}')}</style><p>${url}</p><a href="${url}">${url}</a><div data-proof="${url}" style="background:url(${url})"><img src="${url}"></div>`
  const result = transformPrintResourceUrls(html, hash => `https://book-snapshot.invalid/print-assets/${hash}`)
  expect(result).toContain(`<p>${url}</p><a href="${url}">${url}</a>`)
  expect(result).toContain(`data-proof="${url}"`)
  expect(result.match(/\/print-assets\//g)).toHaveLength(3)
})

it('keeps a full frame, never upscales, and bounds both portrait/landscape and extreme aspect ratios', () => {
  expect(printDimensions(2500, 1875)).toEqual({ width: 2400, height: 1800 })
  expect(printDimensions(1875, 2500)).toEqual({ width: 1800, height: 2400 })
  expect(printDimensions(12, 7)).toEqual({ width: 12, height: 7 })
  expect(printDimensions(24_000_000, 1)).toEqual({ width: 2400, height: 1 })
})

it.each(['width', 'original_encoded_bytes', 'transfer_bytes', 'encoder_pixels', 'alpha_scratch_bytes'] as const)('rejects nonfinite %s before budget comparisons', field => {
  expect(() => assertPrintResourceBinding({ ...binding(), [field]: NaN })).toThrow('SEGMENT_RESOURCE_BINDING_INVALID')
})

it('charges original protocol transport, encoder pixels and alpha scratch instead of just compressed file sizes', () => {
  const item = binding()
  expect(() => checkPrintWorkingBudget([item], DEFAULT_RENDERER_RESOURCE_PROFILE)).not.toThrow()
  expect(() => checkPrintWorkingBudget([item], { ...DEFAULT_RENDERER_RESOURCE_PROFILE, encoded_portion_bytes: 2 * 900 + 2 * 300 + 4 * (1200 + 400) - 1 })).toThrow('WORKER_PAGE_IMAGE_BUDGET_EXCEEDED')
  expect(() => checkPrintWorkingBudget([item], { ...DEFAULT_RENDERER_RESOURCE_PROFILE, decoded_portion_pixels: 51_599 })).toThrow('WORKER_PAGE_IMAGE_BUDGET_EXCEEDED')
})

it('charges the color working buffer and every retained variant before accepting a portion', () => {
  const unfiltered = { ...binding(), variant_hash: 'f'.repeat(64), effect: { theme_id: 'unfiltered', filter: 'none' as const }, filter_working_pixels: 0 }
  const colored = { ...binding(), variant_hash: '9'.repeat(64), effect: { theme_id: 'sepia', filter: 'sepia(1)' as const }, filter_working_pixels: 10_000 }
  expect(() => checkPrintWorkingBudget([colored], { ...DEFAULT_RENDERER_RESOURCE_PROFILE, decoded_portion_pixels: 61_600 })).not.toThrow()
  expect(() => checkPrintWorkingBudget([colored], { ...DEFAULT_RENDERER_RESOURCE_PROFILE, decoded_portion_pixels: 61_599 })).toThrow('WORKER_PAGE_IMAGE_BUDGET_EXCEEDED')
  expect(() => checkPrintWorkingBudget([unfiltered, colored], { ...DEFAULT_RENDERER_RESOURCE_PROFILE, decoded_portion_pixels: 113_199 })).toThrow('WORKER_PAGE_IMAGE_BUDGET_EXCEEDED')
  expect(() => checkPrintWorkingBudget([{ ...colored, filter_working_pixels: 0 }], DEFAULT_RENDERER_RESOURCE_PROFILE)).toThrow('SEGMENT_RESOURCE_BINDING_INVALID')
})

it('clears parent bindings on subdivision so no-image text and child gallery sources must be rematerialized', async () => {
  const source: BookSegmentSource = { source_schema_version: 3, resource_bindings: [binding()], resource_bindings_hash: 'f'.repeat(64),
    resource_policy_hash: PRINT_RESOURCE_POLICY_HASH, encoder_identity_hash: sha256(canonicalJson(identity)),
    page: { type: 'gallery', aspects: {}, travel: { id: 1, name: 'Pinned', gallery: [{ id: 1, url: 'first' }, { id: 2, url: 'second' }] } }, blocks: ['a', 'b'], occurrences: ['one', 'two'] }
  const children = []
  for await (const child of subdivideSource(source)) children.push(child)
  expect(children).toHaveLength(2)
  expect(children.flatMap(child => child.occurrences)).toEqual(['one', 'two'])
  for (const child of children) {
    expect(child.source_schema_version).toBe(2)
    expect(child.resource_bindings).toBeUndefined()
    expect(child.resource_bindings_hash).toBeUndefined()
    expect(child.encoder_identity_hash).toBeUndefined()
  }
})

describe('alpha decision with a mocked native pixel port, not physical decoder evidence', () => {
  it.each([
    [false, 'none'], [true, 'none'], [false, 'sepia(1)'], [true, 'sepia(1)'], [false, 'grayscale(1)'], [true, 'grayscale(1)'],
  ] as const)('native tiles detect source transparency=%s before color filter %s', async (transparent, colorFilter) => {
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
    const originalReader = Object.getOwnPropertyDescriptor(globalThis, 'FileReader')
    const calls: number[][] = []
    const filters: string[] = []
    let draw: number[] = [], requestedMime = ''
    const ctx = { filter: 'none', clearRect: jest.fn(), drawImage: (_image: unknown, ...args: number[]) => { draw = args; calls.push(args); filters.push(ctx.filter) },
      getImageData: () => ({ data: new Uint8ClampedArray([1, 2, 3, transparent && draw.length === 8 && draw[0] === 2400 ? 0 : 255]) }) }
    const canvas = { width: 0, height: 0, getContext: () => ctx,
      toBlob: (callback: (value: { type: string; size: number }) => void, mime: string) => { requestedMime = mime; callback({ type: mime, size: 3 }) } }
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { querySelector: () => ({ naturalWidth: 2401, naturalHeight: 1 }), createElement: () => canvas } })
    Object.defineProperty(globalThis, 'FileReader', { configurable: true, value: class {
      result = 'data:image/jpeg;base64,AQID'; onload?: () => void
      readAsDataURL() { this.onload?.() }
    } })
    try {
      const result = await encodePrintImage({ width: 2400, height: 1, alphaPossible: true, quality: .92, maxBytes: 100, colorFilter })
      expect(result.sourceHasAlpha).toBe(transparent)
      expect(requestedMime).toBe(transparent ? 'image/png' : 'image/jpeg')
      expect(calls.slice(0, 2)).toEqual([[0, 0, 2400, 1, 0, 0, 2400, 1], [2400, 0, 1, 1, 0, 0, 1, 1]])
      expect(filters).toEqual(['none', 'none', colorFilter])
      expect(ctx.clearRect).toHaveBeenCalledTimes(2)
      expect(canvas.width).toBeLessThanOrEqual(PRINT_ASSET_RECIPE.max_long_edge)
    } finally {
      if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document')
      if (originalReader) Object.defineProperty(globalThis, 'FileReader', originalReader); else Reflect.deleteProperty(globalThis, 'FileReader')
    }
  })
})

describe('print cache integrity with a mocked codec port', () => {
  let scratch: string, root: string, index: string, cache: PrintAssetCache
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWOYNm3afwAGSgLC3tfsoQAAAABJRU5ErkJggg==', 'base64')
  const checksum = sha256(png)
  const page = { setContent: jest.fn(), evaluate: jest.fn(), goto: jest.fn(), requestGC: jest.fn() }
  beforeEach(async () => {
    await mkdir(path.resolve(__dirname, '../../../.codex-temp/tests'), { recursive: true })
    scratch = await mkdtemp(path.resolve(__dirname, '../../../.codex-temp/tests/print-cache-'))
    root = path.join(scratch, 'job'); index = path.join(scratch, 'index')
    for (const dir of [root, index, path.join(index, 'assets'), path.join(index, 'print-assets'), path.join(index, 'print-cache')]) await mkdir(dir)
    await writeFile(path.join(root, checksum), png)
    await writeFile(path.join(index, 'assets', `${checksum}.json`), canonicalJson({ checksum, file_ref: checksum, size_bytes: png.length }))
    page.setContent.mockClear()
    page.evaluate.mockReset().mockResolvedValueOnce({ width: 1, height: 1 }).mockResolvedValueOnce({ data: `data:image/png;base64,${png.toString('base64')}`, mime: 'image/png', hasAlpha: true, sourceHasAlpha: true })
    cache = Reflect.construct(PrintAssetCache, [root, index, {} as BrowserContext, page as unknown as Page, identity, DEFAULT_RENDERER_RESOURCE_PROFILE]) as PrintAssetCache
  })
  afterEach(async () => { await rm(scratch, { recursive: true, force: true }) })
  const html = () => `<img src="https://book-snapshot.invalid/assets/${checksum}">`
  it('pins actual served bytes to unchanged original and reuses only reverified cache bytes', async () => {
    const first = await cache.prepareHtml(html())
    expect(first.resource_bindings[0].original_checksum).toBe(checksum)
    expect(first.resource_bindings[0].served_checksum).toBe(checksum)
    expect(first.html).toContain(`/print-assets/${checksum}/${checksum}`)
    expect(await readFile(path.join(root, checksum))).toEqual(png)
    expect(await cache.prepareHtml(html())).toEqual(first)
    expect(page.evaluate).toHaveBeenCalledTimes(2)
  })
  it.each(['corrupt', 'missing', 'symlink', 'substitute'])('rejects %s cached bytes before rendering rather than regenerating', async kind => {
    const prepared = await cache.prepareHtml(html())
    const bound = prepared.resource_bindings[0]
    const file = path.join(index, bound.served_file_ref)
    if (kind === 'corrupt') await writeFile(file, Buffer.from('corruption'))
    if (kind === 'missing' || kind === 'symlink') {
      await rm(file)
      if (kind === 'symlink') await symlink(path.join(root, checksum), file)
    }
    if (kind === 'substitute') {
      const descriptor = JSON.parse(await readFile(path.join(index, bound.descriptor_ref), 'utf8'))
      descriptor.original_checksum = 'f'.repeat(64)
      await writeFile(path.join(index, bound.descriptor_ref), canonicalJson(descriptor))
    }
    await expect(cache.prepareHtml(html())).rejects.toThrow()
    expect(page.evaluate).toHaveBeenCalledTimes(2)
  })
  it.each(['print-assets', 'print-cache'])('rejects a symlinked %s directory before codec or external file creation', async directory => {
    const outside = path.join(scratch, 'outside'); await mkdir(outside)
    await rm(path.join(index, directory), { recursive: true })
    await symlink(outside, path.join(index, directory))
    await expect(cache.prepareHtml(html())).rejects.toThrow('SNAPSHOT_PRIVATE_PATH_INVALID')
    expect(page.setContent).not.toHaveBeenCalled()
    expect(page.evaluate).not.toHaveBeenCalled()
    expect(await import('node:fs/promises').then(fs => fs.readdir(outside))).toEqual([])
  })
  it('keeps two original identities when their codec output bytes are identical', async () => {
    const first = await cache.prepareHtml(html())
    const alternate = Buffer.concat([png, Buffer.from('mock-port metadata variant')]), other = sha256(alternate)
    await writeFile(path.join(root, other), alternate)
    await writeFile(path.join(index, 'assets', `${other}.json`), canonicalJson({ checksum: other, file_ref: other, size_bytes: alternate.length }))
    page.evaluate.mockResolvedValueOnce({ width: 1, height: 1 }).mockResolvedValueOnce({ data: `data:image/png;base64,${png.toString('base64')}`, mime: 'image/png', hasAlpha: true, sourceHasAlpha: true })
    const both = await cache.prepareHtml(html() + `<img src="https://book-snapshot.invalid/assets/${other}">`)
    expect(both.resource_bindings).toHaveLength(2)
    expect(new Set(both.resource_bindings.map(value => value.served_checksum)).size).toBe(1)
    expect(both.html).toContain(`/print-assets/${checksum}/${first.resource_bindings[0].served_checksum}`)
    expect(both.html).toContain(`/print-assets/${other}/${first.resource_bindings[0].served_checksum}`)
  })
  it('reuses a rotated JPEG passthrough using oriented dimensions rather than raw header dimensions', async () => {
    // Synthetic JPEG dimension/EXIF header, only the mocked decoder contract is exercised.
    const exif = Buffer.from('4578696600004d4d002a00000008000101120003000000010006000000000000', 'hex')
    const length = Buffer.alloc(2); length.writeUInt16BE(exif.length + 2)
    const jpeg = Buffer.concat([Buffer.from('ffd8ffe1', 'hex'), length, exif, Buffer.from('ffc00011080002000303011100021101031101ffd9', 'hex')])
    const key = sha256(jpeg)
    await writeFile(path.join(root, key), jpeg)
    await writeFile(path.join(index, 'assets', `${key}.json`), canonicalJson({ checksum: key, file_ref: key, size_bytes: jpeg.length }))
    page.evaluate.mockReset().mockResolvedValueOnce({ width: 2, height: 3 })
    const sourceHtml = `<img src="https://book-snapshot.invalid/assets/${key}">`
    const prepared = await cache.prepareHtml(sourceHtml)
    expect(prepared.resource_bindings[0]).toMatchObject({ mode: 'passthrough', width: 2, height: 3, original_pixels: 6 })
    expect(await cache.prepareHtml(sourceHtml)).toEqual(prepared)
    expect(page.evaluate).toHaveBeenCalledTimes(1)
    expect(page.setContent.mock.calls.at(-1)?.[0]).toContain('crossorigin="anonymous"')
  })
  it('rejects unsupported vector containers before any decoder call', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><image href="data:image/png;base64,giant"/></svg>'), key = sha256(svg)
    await writeFile(path.join(root, key), svg)
    await writeFile(path.join(index, 'assets', `${key}.json`), canonicalJson({ checksum: key, file_ref: key, size_bytes: svg.length }))
    await expect(cache.prepareHtml(`<img src="https://book-snapshot.invalid/assets/${key}">`)).rejects.toThrow('PRINT_IMAGE_FORMAT_UNSUPPORTED')
    expect(page.evaluate).not.toHaveBeenCalled()
  })
  it.each([true, false])('bounds unknown WebP orientation to raw or swapped pixels (valid=%s) and revalidates cache witness', async valid => {
    const webp = Buffer.alloc(30)
    webp.write('RIFF'); webp.writeUInt32LE(22, 4); webp.write('WEBPVP8X', 8); webp.writeUInt32LE(10, 16)
    webp.writeUIntLE(1, 24, 3); webp.writeUIntLE(2, 27, 3)
    const key = sha256(webp)
    // image-size traverses an APP block before SOF; this is a header-only mocked-codec fixture.
    const jpeg = Buffer.from('ffd8ffe00002ffc00011080002000303011100021101031101ffd9', 'hex')
    await writeFile(path.join(root, key), webp)
    await writeFile(path.join(index, 'assets', `${key}.json`), canonicalJson({ checksum: key, file_ref: key, size_bytes: webp.length }))
    page.evaluate.mockReset().mockResolvedValueOnce({ width: valid ? 3 : 4, height: 2 })
      .mockResolvedValueOnce({ data: `data:image/jpeg;base64,${jpeg.toString('base64')}`, mime: 'image/jpeg', hasAlpha: false, sourceHasAlpha: false })
    const sourceHtml = `<img src="https://book-snapshot.invalid/assets/${key}">`
    if (!valid) {
      await expect(cache.prepareHtml(sourceHtml)).rejects.toThrow('PRINT_IMAGE_DIMENSIONS_INVALID')
      expect(page.evaluate).toHaveBeenCalledTimes(1)
    } else {
      const prepared = await cache.prepareHtml(sourceHtml)
      expect(prepared.resource_bindings[0]).toMatchObject({ mode: 'encoded', width: 3, height: 2, original_pixels: 6 })
      expect(await cache.prepareHtml(sourceHtml)).toEqual(prepared)
      expect(page.evaluate).toHaveBeenCalledTimes(2)
      const bound = prepared.resource_bindings[0], file = path.join(index, bound.descriptor_ref)
      const descriptor = JSON.parse(await readFile(file, 'utf8')); descriptor.oriented_width = 4
      await writeFile(file, canonicalJson(descriptor))
      await expect(cache.prepareHtml(sourceHtml)).rejects.toThrow('PRINT_IMAGE_DIMENSIONS_INVALID')
    }
  })
  it('keeps unfiltered and baked occurrences distinct even when codec produces identical bytes', async () => {
    page.evaluate.mockResolvedValueOnce({ width: 1, height: 1 }).mockResolvedValueOnce({ data: `data:image/png;base64,${png.toString('base64')}`, mime: 'image/png', hasAlpha: true, sourceHasAlpha: true })
    const mixed = html() + `<img src="https://book-snapshot.invalid/assets/${checksum}" style="filter: blur(28px); ${workerImageFilterStyle('sepia(100%)', 'sepia')}">`
    const first = await cache.prepareHtml(mixed, undefined, true)
    expect(first.resource_bindings).toHaveLength(2)
    expect(new Set(first.resource_bindings.map(item => item.variant_hash)).size).toBe(2)
    expect(new Set(first.resource_bindings.map(item => item.served_checksum)).size).toBe(1)
    for (const item of first.resource_bindings) {
      expect(() => assertPrintVariantBinding(item)).not.toThrow()
      expect(first.html).toContain(`/print-assets/${checksum}/${item.variant_hash}/${item.served_checksum}`)
      const descriptor = JSON.parse(await readFile(path.join(index, item.descriptor_ref), 'utf8'))
      expect(descriptor.recipe).toEqual(PRINT_VARIANT_RECIPE)
      expect(descriptor.binding.effect).toEqual(item.effect)
    }
    expect(page.evaluate.mock.calls.filter(call => call[0] === encodePrintImage).map(call => call[1].colorFilter).sort()).toEqual(['none', 'sepia(1)'])
    expect(await cache.prepareHtml(mixed, undefined, true)).toEqual(first)
    expect(page.evaluate).toHaveBeenCalledTimes(4)
    const source: BookSegmentSource = { ...first, source_schema_version: 4, page: { type: 'checklists' }, blocks: [], occurrences: [] }
    await expect(cache.prepareHtml(mixed, source)).resolves.toEqual(first)
    await expect(cache.prepareHtml(html(), source)).rejects.toThrow('PRINT_RESOURCE_BINDING_MISMATCH')
    const colored = first.resource_bindings.find(item => item.effect?.filter === 'sepia(1)')!
    const descriptorPath = path.join(index, colored.descriptor_ref)
    const descriptor = JSON.parse(await readFile(descriptorPath, 'utf8')); descriptor.binding.effect.filter = 'grayscale(1)'
    await writeFile(descriptorPath, canonicalJson(descriptor))
    await expect(cache.prepareHtml(mixed, undefined, true)).rejects.toThrow('PRINT_IMAGE_EFFECT_UNSUPPORTED')
    descriptor.binding.effect.theme_id = 'black-white'
    await writeFile(descriptorPath, canonicalJson(descriptor))
    await expect(cache.prepareHtml(mixed, undefined, true)).rejects.toThrow('PRINT_RESOURCE_BINDING_MISMATCH')
  })
  it('forces an otherwise safe JPEG through the encoder when its occurrence needs color transformation', async () => {
    const jpeg = Buffer.from('ffd8ffe00002ffc00011080002000303011100021101031101ffd9', 'hex'), key = sha256(jpeg)
    await writeFile(path.join(root, key), jpeg)
    await writeFile(path.join(index, 'assets', `${key}.json`), canonicalJson({ checksum: key, file_ref: key, size_bytes: jpeg.length }))
    page.evaluate.mockReset().mockResolvedValueOnce({ width: 3, height: 2 })
      .mockResolvedValueOnce({ data: `data:image/jpeg;base64,${jpeg.toString('base64')}`, mime: 'image/jpeg', hasAlpha: false, sourceHasAlpha: false })
    const coloredHtml = `<img src="https://book-snapshot.invalid/assets/${key}" style="${workerImageFilterStyle('sepia(100%)', 'sepia')}">`
    const prepared = await cache.prepareHtml(coloredHtml, undefined, true)
    expect(prepared.resource_bindings[0]).toMatchObject({ mode: 'encoded', effect: { theme_id: 'sepia', filter: 'sepia(1)' }, filter_working_pixels: 6 })
    expect(() => assertPrintVariantBinding({ ...prepared.resource_bindings[0], mode: 'passthrough' })).toThrow('SEGMENT_RESOURCE_BINDING_INVALID')
    expect(page.evaluate.mock.calls[1][1].colorFilter).toBe('sepia(1)')
  })
  it('rejects changed policy, actual encoder identity, binding digest and nonnumeric fields', async () => {
    const prepared = await cache.prepareHtml(html())
    const source: BookSegmentSource = { ...prepared, source_schema_version: 3, page: { type: 'checklists' }, blocks: [], occurrences: [] }
    for (const field of ['resource_policy_hash', 'encoder_identity_hash', 'resource_bindings_hash'] as const) {
      await expect(cache.prepareHtml(html(), { ...source, [field]: 'f'.repeat(64) })).rejects.toThrow('PRINT_RESOURCE_BINDING_MISMATCH')
    }
  })
})
