import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { access, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import type { Browser, BrowserContext, Page } from 'playwright'
import { imageSize } from 'image-size'
import { Parser } from 'htmlparser2'
import { BOOK_SEGMENT_LIMITS } from '@/services/pdf-export/segments/types'
import { PRINT_ASSET_RECIPE, assertPrintResourceBinding, type PreparedPrintResources, type PrintEncoderIdentity, type PrintResourceBinding } from '@/services/pdf-export/segments/printAssetsTypes'
import type { BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import { canonicalJson, makePrivateDirectory, privatePath, readBoundedBytes, sha256, verifyFile } from './filesystem'
import { loadAssetDescriptor, SNAPSHOT_ASSET_ORIGIN } from './snapshot'
import type { RendererResourceProfile } from './measurement'

const SOURCE_URL = /https:\/\/book-snapshot\.invalid\/assets\/([a-f0-9]{64})/g
export const PRINT_RESOURCE_POLICY_HASH = sha256(canonicalJson(PRINT_ASSET_RECIPE))
const requireRuntime = createRequire(__filename)
// Native filesystem errors may cross a VM realm; instanceof Error is not a reliable errno test.
const hasErrno = (error: unknown, code: string): boolean => typeof error === 'object' && error !== null &&
  'code' in error && error.code === code && 'message' in error && typeof error.message === 'string'
interface VendorBrowsers { browsers: Array<{ name: string; revision: string; browserVersion?: string }> }
export function printEncoderPin(): { browser_name: 'chromium'; playwright_version: string; chromium_revision: string; chromium_version: string } {
  const packageFile = requireRuntime.resolve('playwright-core/package.json')
  const packageInfo = requireRuntime(packageFile) as { version: string }
  const vendor = requireRuntime(resolve(dirname(packageFile), 'browsers.json')) as VendorBrowsers
  const chromium = vendor.browsers.find(value => value.name === 'chromium')
  if (!chromium?.browserVersion || !chromium.revision) throw new Error('PRINT_ENCODER_PIN_UNAVAILABLE')
  const pin = { browser_name: 'chromium' as const, playwright_version: packageInfo.version, chromium_revision: chromium.revision, chromium_version: chromium.browserVersion }
  const runtime = requireRuntime(resolve(__dirname, '../../renderer-runtime.json')) as { print_encoder_pin?: typeof pin }
  if (canonicalJson(runtime.print_encoder_pin) !== canonicalJson(pin)) throw new Error('PRINT_ENCODER_IDENTITY_MISMATCH')
  return pin
}
export async function actualPrintEncoderIdentity(browser: Browser, executable: string): Promise<PrintEncoderIdentity> {
  const pin = printEncoderPin()
  if (browser.version() !== pin.chromium_version) throw new Error('PRINT_ENCODER_IDENTITY_MISMATCH')
  const digest = createHash('sha256')
  for await (const part of createReadStream(executable, { highWaterMark: 65_536 })) digest.update(part)
  return { ...pin, executable_sha256: digest.digest('hex'), platform: process.platform, arch: process.arch }
}

/** Conservative classification: unknown alpha-capable formats never become flattened JPEG. */
export function encodedAlphaPolicy(bytes: Buffer): { alpha_possible: boolean; animated: boolean } {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { alpha_possible: false, animated: false }
  if (bytes.subarray(1, 4).toString('ascii') === 'PNG') {
    let alpha = bytes[25] === 4 || bytes[25] === 6
    let animated = false
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const size = bytes.readUInt32BE(offset), kind = bytes.toString('ascii', offset + 4, offset + 8)
      if (kind === 'tRNS') alpha = true
      if (kind === 'acTL') animated = true
      if (kind === 'IDAT') return { alpha_possible: alpha, animated }
      if (size > bytes.length - offset - 12) break
      offset += size + 12
    }
    return { alpha_possible: true, animated }
  }
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    const kind = bytes.toString('ascii', 12, 16)
    if (kind === 'VP8X' && bytes.length > 20) return { alpha_possible: !!(bytes[20] & 0x10), animated: !!(bytes[20] & 0x02) }
    if (kind === 'VP8 ') return { alpha_possible: false, animated: false }
    return { alpha_possible: true, animated: false }
  }
  return { alpha_possible: true, animated: bytes.toString('ascii', 0, 3) === 'GIF' }
}

export function printDimensions(width: number, height: number): { width: number; height: number } {
  if (!Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1) throw new Error('PRINT_IMAGE_DIMENSIONS_INVALID')
  const scale = Math.min(1, PRINT_ASSET_RECIPE.max_long_edge / Math.max(width, height), Math.sqrt(PRINT_ASSET_RECIPE.max_pixels / (width * height)))
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)) }
}

/** Reject active/animated containers before any worker page (including cover analysis) decodes them. */
export function printImageHeader(bytes: Buffer, profile: RendererResourceProfile) {
  if (bytes.length > profile.encoded_resource_bytes) throw new Error('SNAPSHOT_IMAGE_ENCODED_BUDGET_EXCEEDED')
  const dimensions = imageSize(bytes.subarray(0, 65_536))
  if (!['jpg', 'png', 'webp'].includes(dimensions.type || '')) throw new Error('PRINT_IMAGE_FORMAT_UNSUPPORTED')
  const width = dimensions.width || 0, height = dimensions.height || 0
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > profile.decoded_resource_pixels) throw new Error('SNAPSHOT_IMAGE_DECODE_BUDGET_EXCEEDED')
  const alpha = encodedAlphaPolicy(bytes)
  if (alpha.animated) throw new Error('PRINT_IMAGE_ANIMATION_UNSUPPORTED')
  const rotated = dimensions.orientation !== undefined && dimensions.orientation >= 5 && dimensions.orientation <= 8
  return { ...alpha, width, height, orientedWidth: rotated ? height : width, orientedHeight: rotated ? width : height,
    decoderOrientation: dimensions.type !== 'jpg' && dimensions.orientation === undefined }
}

export function assertPrintOrientation(header: ReturnType<typeof printImageHeader>, width: number, height: number): void {
  const expected = width === header.orientedWidth && height === header.orientedHeight
  const swapped = header.decoderOrientation && width === header.height && height === header.width
  if (!expected && !swapped) throw new Error('PRINT_IMAGE_DIMENSIONS_INVALID')
}
interface PrintDescriptor {
  schema_version: 1
  original_checksum: string
  original_file_ref: string
  original_width: number
  original_height: number
  oriented_width: number
  oriented_height: number
  alpha_possible: boolean
  has_source_alpha: boolean
  has_output_alpha: boolean
  recipe: typeof PRINT_ASSET_RECIPE
  encoder_identity: PrintEncoderIdentity
  binding: Omit<PrintResourceBinding, 'descriptor_ref' | 'descriptor_checksum'>
}

/** Charge retained compressed copies/Blob, UTF-16 transport, canvas, encoder RGBA and alpha tile. */
export function checkPrintWorkingBudget(bindings: PrintResourceBinding[], profile: RendererResourceProfile): void {
  if (bindings.length > 64) throw new Error('WORKER_PAGE_IMAGE_BUDGET_EXCEEDED')
  let encoded = 0, pixels = 0
  for (const item of bindings) {
    assertPrintResourceBinding(item)
    if (item.original_encoded_bytes > profile.encoded_resource_bytes || item.encoded_bytes > profile.encoded_resource_bytes) throw new Error('PRINT_IMAGE_ENCODED_BUDGET_EXCEEDED')
    if (item.original_pixels > profile.decoded_resource_pixels || item.served_pixels > profile.decoded_resource_pixels || item.canvas_pixels > profile.decoded_resource_pixels) throw new Error('PRINT_IMAGE_DECODE_BUDGET_EXCEEDED')
    encoded += 2 * item.original_encoded_bytes + 2 * item.encoded_bytes + 4 * (item.original_transfer_bytes + item.transfer_bytes)
    pixels += item.original_pixels + item.alpha_canvas_pixels + Math.ceil(item.alpha_scratch_bytes / 4) + item.canvas_pixels + item.encoder_pixels + item.served_pixels + Math.ceil(item.pixel_scratch_bytes / 4)
  }
  if (encoded > profile.encoded_portion_bytes || pixels > profile.decoded_portion_pixels) throw new Error('WORKER_PAGE_IMAGE_BUDGET_EXCEEDED')
}

/** Rewrite image resources only; editorial text, href and proof attributes remain untouched. */
export function transformPrintResourceUrls(html: string, transform: (hash: string) => string): string {
  const edits: Array<{ start: number; end: number; text: string }> = []
  const rewriteUrl = (value: string) => value.replace(SOURCE_URL, (_, hash: string) => transform(hash))
  const rewriteCss = (value: string) => value.replace(/url\(\s*(["']?)(https:\/\/book-snapshot\.invalid\/assets\/[a-f0-9]{64})\1\s*\)/g,
    (whole, quote: string, url: string) => whole.replace(url, rewriteUrl(url)))
  let styleStart: number | undefined
  const parser = new Parser({ onopentag(name) {
    const start = parser.startIndex, end = parser.endIndex + 1
    const tag = html.slice(start, end)
    const text = tag.replace(/(\s)([\w:-]+)(\s*=\s*)(["'])([\s\S]*?)\4/g, (whole, space: string, attribute: string, eq: string, quote: string, value: string) => {
      const lower = attribute.toLowerCase()
      const next = lower === 'style' ? rewriteCss(value) : ((name === 'img' || name === 'source') && lower === 'src') || (name === 'video' && lower === 'poster') ? rewriteUrl(value) : value
      return space + attribute + eq + quote + next + quote
    })
    if (text !== tag) edits.push({ start, end, text })
    if (name === 'style') styleStart = end
  }, onclosetag(name) {
    if (name === 'style' && styleStart !== undefined) {
      const end = parser.startIndex, original = html.slice(styleStart, end), text = rewriteCss(original)
      if (text !== original) edits.push({ start: styleStart, end, text })
      styleStart = undefined
    }
  } }, { decodeEntities: false })
  parser.end(html)
  for (const edit of edits.sort((a, b) => b.start - a.start)) html = html.slice(0, edit.start) + edit.text + html.slice(edit.end)
  return html
}

export async function encodePrintImage({ width, height, alphaPossible, quality, maxBytes }: { width: number; height: number; alphaPossible: boolean; quality: number; maxBytes: number }): Promise<{ data: string; mime: string; hasAlpha: boolean; sourceHasAlpha: boolean }> {
  const image = document.querySelector<HTMLImageElement>('#source')!
  const canvas = document.createElement('canvas')
  let sourceHasAlpha = false
  if (alphaPossible) {
    canvas.width = Math.min(2400, image.naturalWidth); canvas.height = Math.min(16, image.naturalHeight)
    const originalCtx = canvas.getContext('2d', { alpha: true, colorSpace: 'srgb' })!
    for (let row = 0; row < image.naturalHeight && !sourceHasAlpha; row += 16) {
      for (let column = 0; column < image.naturalWidth && !sourceHasAlpha; column += 2400) {
        const tileWidth = Math.min(2400, image.naturalWidth - column), tileHeight = Math.min(16, image.naturalHeight - row)
        originalCtx.clearRect(0, 0, canvas.width, canvas.height)
        originalCtx.drawImage(image, column, row, tileWidth, tileHeight, 0, 0, tileWidth, tileHeight)
        const tile = originalCtx.getImageData(0, 0, tileWidth, tileHeight).data
        for (let index = 3; index < tile.length; index += 4) if (tile[index] < 255) { sourceHasAlpha = true; break }
      }
    }
    canvas.width = 1; canvas.height = 1
  }
  canvas.width = width; canvas.height = height
  const ctx = canvas.getContext('2d', { alpha: true, colorSpace: 'srgb' })!
  ctx.drawImage(image, 0, 0, width, height)
  let hasAlpha = false
  for (let row = 0; row < height && !hasAlpha; row += 16) {
    const tile = ctx.getImageData(0, row, width, Math.min(16, height - row)).data
    for (let index = 3; index < tile.length; index += 4) if (tile[index] < 255) { hasAlpha = true; break }
  }
  const mime = sourceHasAlpha || hasAlpha ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PRINT_IMAGE_ENCODING_FAILED')), mime, quality))
  if (blob.type !== mime || blob.size > maxBytes) throw new Error('PRINT_IMAGE_ENCODED_BUDGET_EXCEEDED')
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('PRINT_IMAGE_ENCODING_FAILED')); reader.readAsDataURL(blob)
  })
  return { data, mime, hasAlpha, sourceHasAlpha }
}

export class PrintAssetCache {
  private constructor(private root: string, private indexRoot: string, private context: BrowserContext, private page: Page,
    readonly identity: PrintEncoderIdentity, private profile: RendererResourceProfile) {}
  private activeBytes?: Buffer
  private activeChecksum?: string
  private routeError?: Error
  readonly policyHash = PRINT_RESOURCE_POLICY_HASH
  get identityHash(): string { return sha256(canonicalJson(this.identity)) }

  static async create(browser: Browser, executable: string, root: string, indexRoot: string, profile: RendererResourceProfile): Promise<PrintAssetCache> {
    const identity = await actualPrintEncoderIdentity(browser, executable)
    await makePrivateDirectory(resolve(indexRoot, 'print-assets'))
    await makePrivateDirectory(resolve(indexRoot, 'print-cache'))
    await privatePath(indexRoot, 'print-assets')
    await privatePath(indexRoot, 'print-cache')
    const context = await browser.newContext({ serviceWorkers: 'block' })
    const page = await context.newPage()
    page.setDefaultTimeout(30_000)
    const cache = new PrintAssetCache(root, indexRoot, context, page, identity, profile)
    await context.route('**/*', async route => {
      const url = new URL(route.request().url())
      if (cache.activeBytes && url.href === `${SNAPSHOT_ASSET_ORIGIN}/assets/${cache.activeChecksum}`) {
        await route.fulfill({ body: cache.activeBytes, headers: { 'Access-Control-Allow-Origin': '*' } })
      } else if (url.protocol === 'about:' || url.protocol === 'data:') await route.continue()
      else { cache.routeError = new Error('SNAPSHOT_MUTABLE_RESOURCE_REQUEST'); await route.abort() }
    })
    return cache
  }

  async close(): Promise<void> { await this.context.close() }

  private async source(checksum: string) {
    const chunk = await loadAssetDescriptor(this.indexRoot, checksum)
    if (chunk.checksum !== checksum || chunk.size_bytes > this.profile.encoded_resource_bytes) throw new Error('SNAPSHOT_IMAGE_ENCODED_BUDGET_EXCEEDED')
    const file = await verifyFile(this.root, chunk)
    const bytes = await readBoundedBytes(file, this.profile.encoded_resource_bytes)
    if (sha256(bytes) !== checksum) throw new Error('SNAPSHOT_INTEGRITY_FAILED')
    return { chunk, bytes, ...printImageHeader(bytes, this.profile) }
  }

  async load(binding: PrintResourceBinding): Promise<Buffer> {
    assertPrintResourceBinding(binding)
    if (binding.descriptor_ref !== `print-cache/${sha256(canonicalJson([binding.original_checksum, this.policyHash, this.identityHash]))}.json`) throw new Error('PRINT_RESOURCE_BINDING_MISMATCH')
    if (binding.recipe_hash !== this.policyHash || binding.encoder_identity_hash !== this.identityHash) throw new Error('PRINT_RESOURCE_BINDING_MISMATCH')
    const descriptorBytes = await readBoundedBytes(await privatePath(this.indexRoot, binding.descriptor_ref))
    if (sha256(descriptorBytes) !== binding.descriptor_checksum) throw new Error('PRINT_RESOURCE_INTEGRITY_FAILED')
    const descriptor = JSON.parse(descriptorBytes.toString('utf8')) as PrintDescriptor
    const expected = { ...binding } as Partial<PrintResourceBinding>
    delete expected.descriptor_ref; delete expected.descriptor_checksum
    if (descriptor.schema_version !== 1 || canonicalJson(descriptor.binding) !== canonicalJson(expected) || descriptor.original_checksum !== binding.original_checksum ||
      canonicalJson(descriptor.recipe) !== canonicalJson(PRINT_ASSET_RECIPE) || canonicalJson(descriptor.encoder_identity) !== canonicalJson(this.identity)) throw new Error('PRINT_RESOURCE_BINDING_MISMATCH')
    const source = await this.source(binding.original_checksum)
    if (descriptor.original_file_ref !== source.chunk.file_ref || descriptor.original_width !== source.width || descriptor.original_height !== source.height || binding.original_encoded_bytes !== source.bytes.length || binding.original_pixels !== source.width * source.height) throw new Error('PRINT_RESOURCE_BINDING_MISMATCH')
    assertPrintOrientation(source, descriptor.oriented_width, descriptor.oriented_height)
    const target = printDimensions(descriptor.oriented_width, descriptor.oriented_height)
    const alpha = source
    if (descriptor.alpha_possible !== alpha.alpha_possible || typeof descriptor.has_output_alpha !== 'boolean' || typeof descriptor.has_source_alpha !== 'boolean' || (!alpha.alpha_possible && descriptor.has_source_alpha) || alpha.animated ||
      (binding.mode === 'passthrough' && (source.bytes[0] !== 0xff || source.bytes[1] !== 0xd8 || source.bytes.length > PRINT_ASSET_RECIPE.jpeg_passthrough_bytes || Math.max(source.orientedWidth, source.orientedHeight) > PRINT_ASSET_RECIPE.max_long_edge || binding.width !== source.orientedWidth || binding.height !== source.orientedHeight)) ||
      (binding.mode === 'encoded' && (binding.width !== target.width || binding.height !== target.height || binding.mime !== (descriptor.has_source_alpha || descriptor.has_output_alpha ? 'image/png' : 'image/jpeg') || binding.alpha_canvas_pixels !== (alpha.alpha_possible ? Math.min(2400, descriptor.oriented_width) * Math.min(16, descriptor.oriented_height) : 0) || binding.alpha_scratch_bytes !== (alpha.alpha_possible ? Math.min(2400, descriptor.oriented_width) * Math.min(16, descriptor.oriented_height) * 4 : 0)))) throw new Error('PRINT_RESOURCE_BINDING_MISMATCH')
    checkPrintWorkingBudget([binding], this.profile)
    const bytes = await readBoundedBytes(await privatePath(this.indexRoot, binding.served_file_ref), this.profile.encoded_resource_bytes)
    const dimensions = imageSize(bytes.subarray(0, 65_536))
    if (dimensions.type !== (binding.mime === 'image/jpeg' ? 'jpg' : 'png') || bytes.length !== binding.encoded_bytes || sha256(bytes) !== binding.served_checksum || dimensions.width !== (binding.mode === 'passthrough' ? source.width : binding.width) || dimensions.height !== (binding.mode === 'passthrough' ? source.height : binding.height) || binding.served_pixels !== binding.width * binding.height ||
      (binding.mode === 'passthrough' && binding.served_checksum !== binding.original_checksum)) throw new Error('PRINT_RESOURCE_INTEGRITY_FAILED')
    checkPrintWorkingBudget([binding], this.profile)
    return bytes
  }

  private async ensure(checksum: string): Promise<PrintResourceBinding> {
    // A new leaf does not exist yet; validate both cache ancestors before encoding.
    await privatePath(this.indexRoot, 'print-assets')
    await privatePath(this.indexRoot, 'print-cache')
    const key = sha256(canonicalJson([checksum, this.policyHash, this.identityHash]))
    const descriptorRef = `print-cache/${key}.json`
    let existing = false
    try { await access(await privatePath(this.indexRoot, descriptorRef)); existing = true }
    catch (error) { if (!hasErrno(error, 'ENOENT')) throw error }
    if (existing) {
      const bytes = await readBoundedBytes(await privatePath(this.indexRoot, descriptorRef))
      const descriptor = JSON.parse(bytes.toString('utf8')) as PrintDescriptor
      if (descriptor.original_checksum !== checksum || descriptor.binding.original_checksum !== checksum) throw new Error('PRINT_RESOURCE_BINDING_MISMATCH')
      const binding = { ...descriptor.binding, descriptor_ref: descriptorRef, descriptor_checksum: sha256(bytes) }
      await this.load(binding)
      return binding
    }
    const source = await this.source(checksum)
    const alpha = source
    const expectedTarget = printDimensions(source.orientedWidth, source.orientedHeight)
    const eligiblePassthrough = source.bytes[0] === 0xff && source.bytes[1] === 0xd8 && source.bytes.length <= PRINT_ASSET_RECIPE.jpeg_passthrough_bytes && Math.max(source.orientedWidth, source.orientedHeight) <= PRINT_ASSET_RECIPE.max_long_edge
    const predictedCanvas = eligiblePassthrough ? 0 : expectedTarget.width * expectedTarget.height
    const alphaCanvas = alpha.alpha_possible ? Math.max(Math.min(2400, source.orientedWidth) * Math.min(16, source.orientedHeight),
      source.decoderOrientation ? Math.min(2400, source.orientedHeight) * Math.min(16, source.orientedWidth) : 0) : 0
    const alphaScratch = alphaCanvas
    const scratchPixels = eligiblePassthrough ? 0 : Math.max(expectedTarget.width * Math.min(16, expectedTarget.height),
      source.decoderOrientation ? expectedTarget.height * Math.min(16, expectedTarget.width) : 0)
    if (source.width * source.height + alphaCanvas + alphaScratch + 3 * predictedCanvas + scratchPixels > this.profile.decoded_portion_pixels || 2 * source.bytes.length + 4 * Math.ceil(source.bytes.length / 3) * 4 > this.profile.encoded_portion_bytes) throw new Error('WORKER_PAGE_IMAGE_BUDGET_EXCEEDED')
    const maxBlobBytes = Math.min(this.profile.encoded_resource_bytes, Math.floor((this.profile.encoded_portion_bytes - 2 * source.bytes.length - 4 * Math.ceil(source.bytes.length / 3) * 4) / (2 + 16 / 3)))
    if (maxBlobBytes < 1) throw new Error('WORKER_PAGE_IMAGE_BUDGET_EXCEEDED')
    this.activeBytes = source.bytes; this.activeChecksum = checksum; this.routeError = undefined
    try {
      await this.page.setContent(`<img id="source" crossorigin="anonymous" src="${SNAPSHOT_ASSET_ORIGIN}/assets/${checksum}">`, { waitUntil: 'load' })
      if (this.routeError) throw this.routeError
      const dimensions = await this.page.evaluate(async () => {
        const image = document.querySelector<HTMLImageElement>('#source')!
        await image.decode()
        return { width: image.naturalWidth, height: image.naturalHeight }
      })
      assertPrintOrientation(source, dimensions.width, dimensions.height)
      const target = printDimensions(dimensions.width, dimensions.height)
      const passthrough = source.bytes[0] === 0xff && source.bytes[1] === 0xd8 && source.bytes.length <= PRINT_ASSET_RECIPE.jpeg_passthrough_bytes && Math.max(dimensions.width, dimensions.height) <= PRINT_ASSET_RECIPE.max_long_edge
      const canvasPixels = passthrough ? 0 : target.width * target.height
      const result = passthrough ? undefined : await this.page.evaluate(encodePrintImage, { ...target, alphaPossible: alpha.alpha_possible, quality: PRINT_ASSET_RECIPE.jpeg_quality, maxBytes: maxBlobBytes })
      const bytes = result ? Buffer.from(result.data.slice(result.data.indexOf(',') + 1), 'base64') : source.bytes
      const servedChecksum = sha256(bytes), servedRef = `print-assets/${servedChecksum}`
      const binding: PrintDescriptor['binding'] = { original_checksum: checksum, served_checksum: servedChecksum, served_file_ref: servedRef,
        mode: passthrough ? 'passthrough' : 'encoded', mime: result ? result.mime as 'image/jpeg' | 'image/png' : 'image/jpeg',
        width: passthrough ? dimensions.width : target.width, height: passthrough ? dimensions.height : target.height,
        encoded_bytes: bytes.length, original_encoded_bytes: source.bytes.length, original_transfer_bytes: Math.ceil(source.bytes.length / 3) * 4, original_pixels: source.width * source.height,
        alpha_canvas_pixels: alpha.alpha_possible ? Math.min(2400, dimensions.width) * Math.min(16, dimensions.height) : 0,
        alpha_scratch_bytes: alpha.alpha_possible ? Math.min(2400, dimensions.width) * Math.min(16, dimensions.height) * 4 : 0,
        canvas_pixels: canvasPixels, encoder_pixels: canvasPixels, served_pixels: passthrough ? dimensions.width * dimensions.height : canvasPixels,
        transfer_bytes: result ? Math.ceil(bytes.length / 3) * 4 : 0, pixel_scratch_bytes: passthrough ? 0 : target.width * Math.min(16, target.height) * 4,
        recipe_hash: this.policyHash, encoder_identity_hash: this.identityHash }
      checkPrintWorkingBudget([{ ...binding, descriptor_ref: descriptorRef, descriptor_checksum: '0'.repeat(64) }], this.profile)
      // Recheck the existing directory and any existing leaf immediately before exclusive creation.
      const servedPath = resolve(await privatePath(this.indexRoot, 'print-assets'), servedChecksum)
      try { await privatePath(this.indexRoot, servedRef) }
      catch (error) { if (!hasErrno(error, 'ENOENT')) throw error }
      try { await writeFile(servedPath, bytes, { flag: 'wx', mode: 0o600 }) }
      catch (error) {
        if (!hasErrno(error, 'EEXIST')) throw error
        const existing = await readBoundedBytes(await privatePath(this.indexRoot, servedRef), this.profile.encoded_resource_bytes)
        if (sha256(existing) !== servedChecksum) throw new Error('PRINT_RESOURCE_INTEGRITY_FAILED')
      }
      const descriptor: PrintDescriptor = { schema_version: 1, original_checksum: checksum, original_file_ref: source.chunk.file_ref,
        original_width: source.width, original_height: source.height, oriented_width: dimensions.width, oriented_height: dimensions.height,
        alpha_possible: alpha.alpha_possible, has_source_alpha: result?.sourceHasAlpha ?? false, has_output_alpha: result?.hasAlpha ?? false, recipe: PRINT_ASSET_RECIPE, encoder_identity: this.identity, binding }
      const descriptorBytes = canonicalJson(descriptor)
      await writeFile(resolve(await privatePath(this.indexRoot, 'print-cache'), `${key}.json`), descriptorBytes, { flag: 'wx', mode: 0o600 })
      return { ...binding, descriptor_ref: descriptorRef, descriptor_checksum: sha256(descriptorBytes) }
    } finally {
      await this.page.goto('about:blank'); await this.page.requestGC()
      this.activeBytes = undefined; this.activeChecksum = undefined
    }
  }

  async prepareHtml(html: string, pinned?: BookSegmentSource): Promise<PreparedPrintResources> {
    if (Buffer.byteLength(html) > BOOK_SEGMENT_LIMITS.html_bytes) throw new Error('WORKER_HTML_BUDGET_EXCEEDED')
    const discovered = new Set<string>()
    transformPrintResourceUrls(html, hash => { discovered.add(hash); return `${SNAPSHOT_ASSET_ORIGIN}/assets/${hash}` })
    const hashes = [...discovered].sort()
    if (hashes.length > 64) throw new Error('WORKER_PAGE_IMAGE_BUDGET_EXCEEDED')
    const bindings: PrintResourceBinding[] = []
    if (pinned) {
      if (pinned.resource_policy_hash !== this.policyHash || pinned.encoder_identity_hash !== this.identityHash || !pinned.resource_bindings ||
        pinned.resource_bindings_hash !== sha256(canonicalJson(pinned.resource_bindings)) || canonicalJson(pinned.resource_bindings.map(value => value.original_checksum)) !== canonicalJson(hashes)) throw new Error('PRINT_RESOURCE_BINDING_MISMATCH')
      for (const item of pinned.resource_bindings) { await this.load(item); bindings.push(item) }
    } else for (const hash of hashes) bindings.push(await this.ensure(hash))
    checkPrintWorkingBudget(bindings, this.profile)
    const bySource = new Map(bindings.map(value => [value.original_checksum, value.served_checksum]))
    return { html: transformPrintResourceUrls(html, hash => {
      const served = bySource.get(hash)
      if (!served) throw new Error('PRINT_RESOURCE_BINDING_MISMATCH')
      return `${SNAPSHOT_ASSET_ORIGIN}/print-assets/${hash}/${served}`
    }),
      resource_bindings: bindings, resource_bindings_hash: sha256(canonicalJson(bindings)), resource_policy_hash: this.policyHash, encoder_identity_hash: this.identityHash }
  }
}
