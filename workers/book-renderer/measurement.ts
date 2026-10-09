import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { open } from 'node:fs/promises'
import { resolve } from 'node:path'
import { imageSize } from 'image-size'
import { BOOK_SEGMENT_LIMITS } from '@/services/pdf-export/segments/types'
import type { BookMediaChunk } from '@/types/bookDocument'
import { privatePath, readBoundedBytes, sha256, verifyFile } from './filesystem'
import type { PreparedPrintResources, PrintEncoderIdentity, PrintResourceBinding } from '@/services/pdf-export/segments/printAssetsTypes'
import type { BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import { PrintAssetCache, printImageHeader } from './printAssets'
import { loadAssetDescriptor, SNAPSHOT_ASSET_ORIGIN } from './snapshot'

export interface PageMeasurement { pages: number; fits: boolean }
export type MeasurePage = (html: string) => Promise<PageMeasurement>
export interface PhysicalMeasurer {
  prepareHtml: (html: string, pinned?: BookSegmentSource) => Promise<PreparedPrintResources>
  encoder_identity: PrintEncoderIdentity
  resource_policy_hash: string
  assertResourceServing: () => void
  servedResources: () => Array<{ original_checksum: string; served_checksum: string }>
  measure: MeasurePage
  fit: MeasurePage
  close: () => Promise<void>
  brightness: (url: string) => Promise<number>
  composition: (url: string) => Promise<{ topBusy: number; centerBusy: number; bottomBusy: number }>
}
export const ASSET_BUDGET = { bytes: 8 * 1024 * 1024, pixels: 24_000_000, header_bytes: 65_536 } as const
export const PAGE_ASSET_BUDGET = { bytes: 24 * 1024 * 1024, pixels: 72_000_000, resources: 64 } as const
export interface RendererResourceProfile {
  encoded_resource_bytes: number
  encoded_portion_bytes: number
  decoded_resource_pixels: number
  decoded_portion_pixels: number
  dom_nodes: number
}
export const DEFAULT_RENDERER_RESOURCE_PROFILE: RendererResourceProfile = {
  encoded_resource_bytes: ASSET_BUDGET.bytes, encoded_portion_bytes: PAGE_ASSET_BUDGET.bytes,
  decoded_resource_pixels: ASSET_BUDGET.pixels, decoded_portion_pixels: PAGE_ASSET_BUDGET.pixels, dom_nodes: 10_000,
}
export function validateRendererResourceProfile(value: RendererResourceProfile): void {
  for (const key of Object.keys(DEFAULT_RENDERER_RESOURCE_PROFILE) as Array<keyof RendererResourceProfile>) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 1) throw new Error('WORKER_RESOURCE_PROFILE_INVALID')
  }
}

async function readFontFile(file: string, maxBytes: number, budgetError: string): Promise<Buffer> {
  try { return await readBoundedBytes(file, maxBytes) }
  catch (error) {
    if (error instanceof Error && error.message === 'WORKER_RECORD_BUDGET_EXCEEDED') throw new Error(budgetError)
    throw error
  }
}

/** Executed in the bounded print DOM; text in arbitrary containers must remain visible. */
export function hasPrintedPageOverflow(domBudget: number): boolean {
  const pages = Array.from(document.querySelectorAll<HTMLElement>('.pdf-page'))
  if (document.querySelectorAll('*').length > domBudget) throw new Error('WORKER_DOM_BUDGET_EXCEEDED')
  if (pages.length !== 1) return true
  const section = pages[0]
  const bounds = section.getBoundingClientRect()
  const height = 285 * 96 / 25.4
  const bottom = bounds.top + height
  if (bounds.height > height + 1) return true
  const elements = [section, ...Array.from(section.querySelectorAll<HTMLElement>('*'))]
  for (const element of elements) {
    if (/^(SCRIPT|STYLE)$/.test(element.tagName)) continue
    if (element.classList.contains('book-gallery-caption') && getComputedStyle(element).position === 'absolute' && element.parentElement) {
      const caption = element.getBoundingClientRect()
      const frame = element.parentElement.getBoundingClientRect()
      if (caption.height >= frame.height - 1 || caption.top < frame.top - 1 || caption.bottom > frame.bottom + 1
        || caption.left < frame.left - 1 || caption.right > frame.right + 1) return true
    }
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType !== 3 || !node.textContent?.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const textBounds of Array.from(range.getClientRects())) {
        if (!textBounds.height) continue
        if (textBounds.bottom > bottom + 1 || textBounds.top < bounds.top - 1
          || textBounds.left < bounds.left - 1 || textBounds.right > bounds.right + 1) return true
        for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor)
          const clip = ancestor.getBoundingClientRect()
          if (/^(hidden|clip|auto|scroll)$/.test(style.overflowY)
            && (textBounds.top < clip.top - 1 || textBounds.bottom > clip.bottom + 1)) return true
          if (/^(hidden|clip|auto|scroll)$/.test(style.overflowX)
            && (textBounds.left < clip.left - 1 || textBounds.right > clip.right + 1)) return true
          if (ancestor === section) break
        }
      }
    }
  }
  return Array.from(section.querySelectorAll<HTMLElement>('p,td,th,figure,figcaption,img,li,h1,h2,h3,h4,pre'))
    .some(element => {
      const rect = element.getBoundingClientRect()
      return rect.height > 0 && rect.bottom > bottom + 1
    })
}

export async function probeFrozenImage(root: string, chunk: BookMediaChunk, profile = DEFAULT_RENDERER_RESOURCE_PROFILE): Promise<{ width: number; height: number; aspect: number }> {
  if (chunk.size_bytes > profile.encoded_resource_bytes) throw new Error('SNAPSHOT_IMAGE_ENCODED_BUDGET_EXCEEDED')
  const file = await verifyFile(root, chunk)
  const handle = await open(file, 'r')
  try {
    const bytes = Buffer.alloc(Math.min(chunk.size_bytes, ASSET_BUDGET.header_bytes))
    await handle.read(bytes, 0, bytes.length, 0)
    const dimensions = imageSize(bytes)
    const width = dimensions.width || 0
    const height = dimensions.height || 0
    if (!width || !height || width * height > profile.decoded_resource_pixels) throw new Error('SNAPSHOT_IMAGE_DECODE_BUDGET_EXCEEDED')
    return { width, height, aspect: width / height }
  } finally { await handle.close() }
}

/** Chromium is exclusively a worker adapter; no browser/Node import reaches app code. */
export async function physicalMeasurer(root: string, out: string, fontsDir: string, profile = DEFAULT_RENDERER_RESOURCE_PROFILE): Promise<PhysicalMeasurer> {
  validateRendererResourceProfile(profile)
  const fontCss = (await readFontFile(resolve(fontsDir, 'fonts.css'), 512 * 1024, 'WORKER_FONT_STYLESHEET_BUDGET_EXCEEDED')).toString('utf8')
  let browser: Browser | undefined
  let context: BrowserContext | undefined
  let page: Page | undefined
  let printCache: PrintAssetCache | undefined
  let bindings = new Map<string, PrintResourceBinding>()
  let served = new Map<string, { original_checksum: string; served_checksum: string }>()
  let preparedResources = false
  let denied = false
  let routeError: Error | undefined
  let decodedPixels = 0
  let encodedBytes = 0
  let resources = new Set<string>()
  try {
    browser = await chromium.launch({ executablePath: chromium.executablePath(), headless: true, args: ['--js-flags=--max-old-space-size=256'] })
    printCache = await PrintAssetCache.create(browser, chromium.executablePath(), root, out, profile)
    context = await browser.newContext({ viewport: { width: 794, height: 1123 }, serviceWorkers: 'block' })
    await context.route('**/*', async route => {
      try {
      const url = new URL(route.request().url())
      if (url.origin === SNAPSHOT_ASSET_ORIGIN && /^\/print-assets\/[0-9a-f]{64}\/[0-9a-f]{64}$/.test(url.pathname)) {
        const binding = bindings.get(url.pathname.split('/').at(-2)!)
        if (!binding || binding.served_checksum !== url.pathname.split('/').at(-1)) throw new Error('PRINT_RESOURCE_BINDING_MISMATCH')
        const bytes = await printCache!.load(binding)
        if (sha256(bytes) !== binding.served_checksum) throw new Error('PRINT_RESOURCE_INTEGRITY_FAILED')
        served.set(binding.original_checksum, { original_checksum: binding.original_checksum, served_checksum: binding.served_checksum })
        await route.fulfill({ body: bytes, contentType: binding.mime, headers: { 'Access-Control-Allow-Origin': '*' } })
      } else if (url.origin === SNAPSHOT_ASSET_ORIGIN && /^\/assets\/[0-9a-f]{64}$/.test(url.pathname)) {
        if (preparedResources) throw new Error('PRINT_RESOURCE_BINDING_MISMATCH')
        const chunk = await loadAssetDescriptor(out, url.pathname.split('/').at(-1)!)
        const dimensions = await probeFrozenImage(root, chunk, profile)
        if (!resources.has(chunk.checksum)) {
          decodedPixels += dimensions.width * dimensions.height
          encodedBytes += chunk.size_bytes
          resources.add(chunk.checksum)
          if (decodedPixels > profile.decoded_portion_pixels || encodedBytes > profile.encoded_portion_bytes || resources.size > PAGE_ASSET_BUDGET.resources) throw new Error('WORKER_PAGE_IMAGE_BUDGET_EXCEEDED')
        }
        await route.fulfill({ path: await privatePath(root, chunk.file_ref), headers: { 'Access-Control-Allow-Origin': '*' } })
      } else if (url.origin === SNAPSHOT_ASSET_ORIGIN && /^\/fonts\/[0-9a-f]{64}\.woff2$/.test(url.pathname)) {
        const name = url.pathname.split('/').at(-1)!
        const file = await privatePath(fontsDir, name)
        const bytes = await readFontFile(file, 2 * 1024 * 1024, 'WORKER_FONT_INTEGRITY_FAILED')
        if (sha256(bytes) !== name.slice(0, 64)) throw new Error('WORKER_FONT_INTEGRITY_FAILED')
        await route.fulfill({ body: bytes, contentType: 'font/woff2', headers: { 'Access-Control-Allow-Origin': '*' } })
      } else if (url.protocol === 'data:' || url.protocol === 'about:') await route.continue()
      else { denied = true; await route.abort() }
      } catch (error) {
        routeError = error instanceof Error ? error : new Error('WORKER_ASSET_FAILED')
        await route.abort()
      }
    })
    page = await context.newPage()
    page.setDefaultTimeout(30_000)
    await page.emulateMedia({ media: 'print' })
    const setHtml = async (html: string) => {
      if (Buffer.byteLength(html) > BOOK_SEGMENT_LIMITS.html_bytes) throw new Error('WORKER_HTML_BUDGET_EXCEEDED')
      denied = false
      routeError = undefined; served = new Map(); decodedPixels = 0; encodedBytes = 0; resources = new Set()
      // The artifact supplies the exact frozen font faces; never fetch Google/live assets here.
      const pinnedHtml = html.replace(/<link\b[^>]*https:\/\/fonts\.[^>]*>/g, '')
        .replace('</head>', `<style>${fontCss}</style></head>`)
      await page!.setContent(pinnedHtml, { waitUntil: 'load' })
      if (routeError) throw routeError
      await page!.evaluate(async () => {
        await document.fonts.ready
        for (const face of Array.from(document.fonts)) {
          if (face.status === 'error') throw new Error('SNAPSHOT_FONT_UNAVAILABLE')
        }
        for (const image of Array.from(document.images)) {
          if (!image.complete) await image.decode()
          if (!image.naturalWidth || !image.naturalHeight) throw new Error('SNAPSHOT_IMAGE_UNAVAILABLE')
        }
      })
      if (routeError) throw routeError
      if (denied) throw new Error('SNAPSHOT_MUTABLE_RESOURCE_REQUEST')
    }
    const geometryFits = async (html: string): Promise<boolean> => {
      await setHtml(html)
      const overflow = await page!.evaluate(hasPrintedPageOverflow, profile.dom_nodes)
      return !overflow
    }
    const measure: MeasurePage = async html => {
      try {
        const fits = await geometryFits(html)
        if (!fits) return { pages: 0, fits: false }
        const pdf = await page!.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
        if (pdf.byteLength > 4 * 1024 * 1024) throw new Error('WORKER_SEGMENT_PDF_BUDGET_EXCEEDED')
        const counts = Array.from(pdf.toString('latin1').matchAll(/\/Count\s+(\d+)/g), value => Number(value[1]))
        const pages = counts.length ? Math.max(...counts) : 0
        return { pages, fits: fits && pages === 1 }
      } finally {
        await page!.goto('about:blank')
        await page!.requestGC()
      }
    }

    const sample = async (url: string) => {
      const match = url.match(/^https:\/\/book-snapshot\.invalid\/assets\/([a-f0-9]{64})$/)
      if (!match) throw new Error('SNAPSHOT_MUTABLE_RESOURCE_REQUEST')
      const chunk = await loadAssetDescriptor(out, match[1])
      const bytes = await readBoundedBytes(await verifyFile(root, chunk), profile.encoded_resource_bytes)
      if (sha256(bytes) !== match[1]) throw new Error('SNAPSHOT_INTEGRITY_FAILED')
      const header = printImageHeader(bytes, profile)
      if (header.width * header.height + 2 * 64 * 64 > profile.decoded_portion_pixels ||
        2 * bytes.length + 4 * Math.ceil(bytes.length / 3) * 4 > profile.encoded_portion_bytes) throw new Error('WORKER_PAGE_IMAGE_BUDGET_EXCEEDED')
      preparedResources = false; bindings = new Map()
      try {
        await setHtml(`<!DOCTYPE html><html><head></head><body><img id="sample" crossorigin="anonymous" src="${url}"></body></html>`)
        return await page!.evaluate(() => {
          const image = document.querySelector<HTMLImageElement>('#sample')!
          const canvas = document.createElement('canvas')
          canvas.width = 64; canvas.height = 64
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(image, 0, 0, 64, 64)
          const pixels = ctx.getImageData(0, 0, 64, 64).data
          const sums = [0, 0, 0]; const squares = [0, 0, 0]; const counts = [0, 0, 0]
          let total = 0
          for (let index = 0; index < pixels.length; index += 4) {
            const value = .299 * pixels[index] + .587 * pixels[index + 1] + .114 * pixels[index + 2]
            const zone = Math.min(2, Math.floor(Math.floor(index / 4 / 64) / (64 / 3)))
            sums[zone] += value; squares[zone] += value * value; counts[zone]++; total += value
          }
          const busy = sums.map((sum, zone) => Math.min(1, Math.sqrt(Math.max(0, squares[zone] / counts[zone] - (sum / counts[zone]) ** 2)) / 128))
          return { brightness: Math.round(total / (64 * 64)), composition: { topBusy: busy[0], centerBusy: busy[1], bottomBusy: busy[2] } }
        })
      } finally { await page!.goto('about:blank'); await page!.requestGC() }
    }
    return { prepareHtml: async (html, pinned) => {
      const prepared = await printCache!.prepareHtml(html, pinned)
      preparedResources = true
      bindings = new Map(prepared.resource_bindings.map(value => [value.original_checksum, value]))
      return prepared
    }, encoder_identity: printCache.identity, resource_policy_hash: printCache.policyHash,
    assertResourceServing: () => {
      if (!preparedResources || served.size !== bindings.size) throw new Error('PRINT_RESOURCE_SERVING_INCOMPLETE')
      for (const [original, binding] of bindings) if (served.get(original)?.served_checksum !== binding.served_checksum) throw new Error('PRINT_RESOURCE_SERVING_INCOMPLETE')
    },
    servedResources: () => [...served.values()].sort((a, b) => a.original_checksum.localeCompare(b.original_checksum)),
    measure, fit: async html => {
      try { return await measure(html) } catch (error) {
        if (error instanceof Error && error.message === 'WORKER_SEGMENT_PDF_BUDGET_EXCEEDED') return { pages: 0, fits: false }
        throw error
      }
    }, close: () => browser!.close(),
      brightness: async url => (await sample(url)).brightness,
      composition: async url => (await sample(url)).composition }
  } catch (error) {
    await browser?.close()
    throw error
  }
}
