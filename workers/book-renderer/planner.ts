import { readFileSync } from 'node:fs'
import { access, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Parser } from 'htmlparser2'
import QRCode from 'qrcode'
import type { BookDocument, BookMediaChunk, BookSnapshotChunk, BookTextField } from '@/types/bookDocument'
import type { TravelForBook } from '@/types/pdf-export'
import type { NormalizedLocation, TravelSectionMeta } from '@/services/pdf-export/generators/v2/runtime/types'
import { CanonicalPageRenderer } from '@/services/pdf-export/segments/CanonicalPageRenderer'
import { incrementalContent, type SafeContentFragment } from '@/services/pdf-export/parsers/incrementalContent'
import { continueContentOnPage, mergeContentContinuation } from '@/services/pdf-export/segments/contentContinuation'
import { subdivideSource } from '@/services/pdf-export/segments/subdivideSource'
import { BOOK_SEGMENT_LIMITS } from '@/services/pdf-export/segments/types'
import type { BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import { TRAVEL_QUOTES, type TravelQuote } from '@/services/pdf-export/quotes/travelQuotes'
import { parseCoordinates } from '@/services/pdf-export/generators/v2/runtime/bookData'
import { appendRecord, canonicalJson, jsonLines, makePrivateDirectory, readBoundedJson, sha256 } from './filesystem'
import { appendMetadataLabel, assetUrl, firstMedia, sourceImageKey, textSource, travelDirectory, travelMetadata, type IndexedBookSummary } from './snapshot'
import { DEFAULT_RENDERER_RESOURCE_PROFILE, probeFrozenImage, type MeasurePage, type RendererResourceProfile, type PhysicalMeasurer } from './measurement'

const FIELDS: BookTextField[] = ['description', 'plus', 'minus', 'recommendation']
export interface BodyRecord { ref: string; travel_id: number; ordinal: number }
export interface ChapterRecord { travel_id: number; start: number; pages: number; map_start?: number }
export interface BodyPlan { pages: number; atlas_pages: number; toc_pages: number; blocks: number; occurrences: number }

function quote(seed: string, offset: number): TravelQuote {
  const index = (parseInt(sha256(seed).slice(0, 8), 16) + offset) % TRAVEL_QUOTES.length
  return { text: TRAVEL_QUOTES[index].text, author: TRAVEL_QUOTES[index].author }
}
export const bookQuotes = (seed: string): { cover: TravelQuote; final: TravelQuote } => ({ cover: quote(seed, 0), final: quote(seed, 1) })

export async function pinnedTravel(out: string, id: number): Promise<TravelForBook> {
  const travel = await travelMetadata(out, id)
  const image = await firstMedia(out, id, 'cover')
  if (image) travel.travel_image_url = assetUrl(image)
  return travel
}

/** Resolve forward numbered heading links with a disk index, not a whole-field tree/map. */
async function anchorResolver(root: string, out: string, pinned: BookDocument, id: number, field: BookTextField, readBytes: number): Promise<(ordinal: number) => string | undefined> {
  const dir = resolve(travelDirectory(out, id), `anchors-${field}`)
  await makePrivateDirectory(dir)
  let number = 0
  const pending: string[] = []
  const flush = async () => {
    for (const value of pending.splice(0)) {
      if (value.length > 4096) throw new Error('WORKER_ANCHOR_BUDGET_EXCEEDED')
      const seen = resolve(dir, `seen-${sha256(value)}`)
      try { await access(seen) } catch {
        number++
        await writeFile(seen, '', { flag: 'wx', mode: 0o600 })
        await writeFile(resolve(dir, String(number)), value, { mode: 0o600 })
      }
    }
  }
  for await (const fragment of incrementalContent(textSource(root, out, pinned, id, field, readBytes))) {
    const parser = new Parser({ onopentag(name, attributes) {
      if (name === 'a' && /^#[^#?]+$/.test(attributes.href || '')) pending.push(attributes.href.slice(1))
    } })
    parser.end(fragment.html)
    await flush()
  }
  return ordinal => {
    try { return readFileSync(resolve(dir, String(ordinal)), 'utf8') } catch { return undefined }
  }
}

async function rewriteFragment(root: string, fragment: SafeContentFragment, inline: AsyncIterator<BookMediaChunk>, profile: RendererResourceProfile): Promise<{ html: string; occurrences: string[] }> {
  const images = Array.from(fragment.html.matchAll(/<img\b[^>]*>/gi))
  if (images.length !== fragment.imageOccurrences.length) throw new Error('SNAPSHOT_INLINE_MEDIA_COVERAGE_MISMATCH')
  let html = fragment.html
  const occurrences: string[] = []
  if (images.length) {
    const resolved: Array<{ tag: string; key: string }> = []
    for (const occurrence of fragment.imageOccurrences) {
      const next = await inline.next()
      if (next.done || next.value.metadata.resource_key !== await sourceImageKey(occurrence.source)) throw new Error('SNAPSHOT_INLINE_MEDIA_ORDER_MISMATCH')
      const dimensions = await probeFrozenImage(root, next.value, profile)
      const originalTag = images[resolved.length][0]
      const tag = originalTag.replace(/\s(?:src|srcset|data-src|data-original|data-lazy-src|width|height)=(["']).*?\1/gi, '')
        .replace(/\/?\s*>$/, ` src="${assetUrl(next.value)}" width="${dimensions.width}" height="${dimensions.height}">`)
      resolved.push({ tag, key: next.value.occurrence_key })
    }
    for (let position = images.length - 1; position >= 0; position--) {
      const at = images[position].index!
      html = html.slice(0, at) + resolved[position].tag + html.slice(at + images[position][0].length)
    }
    occurrences.push(...resolved.map(image => image.key))
  }
  // Video has no printable frozen frame: preserve the authored destination as a link.
  html = html.replace(/<iframe\b[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/iframe>/gi, '<a href="$1">$1</a>')
  return { html, occurrences }
}

async function smallContent(root: string, out: string, pinned: BookDocument, id: number, travel: TravelForBook, qr: string, readBytes: number): Promise<BookSegmentSource | undefined> {
  const fields: Partial<Record<BookTextField, string>> = {}
  let total = 0
  for (const field of FIELDS) {
    let text = ''
    for await (const part of textSource(root, out, pinned, id, field, readBytes)) {
      total += part.length
      if (total > 8192) return undefined
      text += part
    }
    // The continuation path preserves table links/cells and inline media placements.
    if (/<(?:table|img)\b/i.test(text)) return undefined
    fields[field] = text
  }
  return { page: { type: 'legacy-content', travel: { ...travel, ...fields }, qr },
    blocks: [...FIELDS.filter(field => fields[field]).map(field => `${id}:${field}:small`), `${id}:online`], occurrences: [] }
}

export async function planBody(root: string, out: string, pinned: BookDocument, summary: IndexedBookSummary, measure: MeasurePage, readBytes: number, profile = DEFAULT_RENDERER_RESOURCE_PROFILE, prepare?: PhysicalMeasurer['prepareHtml'], verifyResources?: PhysicalMeasurer['assertResourceServing']): Promise<BodyPlan> {
  await makePrivateDirectory(resolve(out, 'body'))
  const renderer = new CanonicalPageRenderer(pinned.settings.template)
  const plan: BodyPlan = { pages: 0, atlas_pages: 0, toc_pages: 0, blocks: 0, occurrences: 0 }
  const fitHtml: MeasurePage = async html => {
    try { return await measure(prepare ? (await prepare(html)).html : html) } catch (error) {
      if (error instanceof Error && ['WORKER_PAGE_IMAGE_BUDGET_EXCEEDED', 'WORKER_DOM_BUDGET_EXCEEDED', 'WORKER_HTML_BUDGET_EXCEEDED', 'WORKER_SEGMENT_PDF_BUDGET_EXCEEDED'].includes(error.message)) return { pages: 0, fits: false }
      throw error
    }
  }
  const add = async (source: BookSegmentSource, id: number, contentBudget = 1024): Promise<void> => {
    source = { ...source, source_schema_version: 2 }
    let html = await renderer.renderBoundedPage(source.page, { start_page: plan.pages + 1, folio_area_mm: 12 }, pinned)
    let result
    try {
      if (prepare) {
        const prepared = await prepare(html)
        source = { ...source, resource_bindings: prepared.resource_bindings, resource_bindings_hash: prepared.resource_bindings_hash,
          resource_policy_hash: prepared.resource_policy_hash, encoder_identity_hash: prepared.encoder_identity_hash, source_schema_version: 3 }
        html = prepared.html
      }
      result = await measure(html)
    } catch (error) {
      if (!(error instanceof Error && ['WORKER_PAGE_IMAGE_BUDGET_EXCEEDED', 'WORKER_DOM_BUDGET_EXCEEDED', 'WORKER_HTML_BUDGET_EXCEEDED', 'WORKER_SEGMENT_PDF_BUDGET_EXCEEDED'].includes(error.message))) throw error
      result = { pages: 0, fits: false }
    }
    if (result.pages !== 1 || !result.fits) {
      if ((source.page.type === 'content' || source.page.type === 'gallery-caption' || source.page.type === 'map-text') && contentBudget < 256) throw new Error('SEGMENT_REQUIRES_SINGLE_SOURCE_LAYOUT')
      const nextContentBudget = source.page.type === 'content' || source.page.type === 'gallery-caption' || source.page.type === 'map-text'
        ? Math.floor(contentBudget / 2) : contentBudget
      for await (const portion of subdivideSource(source, contentBudget)) await add(portion, id, nextContentBudget)
      return
    }
    if (prepare) {
      if (!verifyResources) throw new Error('SEGMENT_RESOURCE_PORT_REQUIRED')
      verifyResources()
    }
    const ref = `body/${plan.pages}.json`
    const serialized = canonicalJson(source)
    if (Buffer.byteLength(serialized) > BOOK_SEGMENT_LIMITS.source_bytes) throw new Error('WORKER_SOURCE_ENVELOPE_BUDGET_EXCEEDED')
    await writeFile(resolve(out, ref), serialized, { mode: 0o600 })
    await appendRecord(resolve(out, 'body.ndjson'), { ref, travel_id: id, ordinal: plan.pages } satisfies BodyRecord)
    plan.pages++; plan.blocks += source.blocks.length; plan.occurrences += source.occurrences.length
    if (source.page.type === 'map') await appendRecord(resolve(out, 'atlas-sources.ndjson'), { id, locations: source.page.locations, map_start: plan.pages - 1 })
  }
  let ordinal = 0
  for await (const id of jsonLines<number>(resolve(out, 'travels.ndjson'))) {
    ordinal++
    const travel = await pinnedTravel(out, id)
    if (summary.travels >= 3 && ordinal > 1) await add({ page: { type: 'separator', travel, ordinal, total: summary.travels }, blocks: [`${id}:separator`], occurrences: [] }, id)
    const start = plan.pages
    const cover = await firstMedia(out, id, 'cover')
    await add({ page: { type: 'photo', travel }, blocks: [`${id}:photo`], occurrences: cover ? [cover.occurrence_key] : [] }, id)
    const qr = await QRCode.toDataURL(travel.url || '', { width: 110, margin: 0 })
    const small = await smallContent(root, out, pinned, id, travel, qr, readBytes)
    const smallMeasurement = small ? await fitHtml(await renderer.renderBoundedPage(small.page, { start_page: plan.pages + 1, folio_area_mm: 12 }, pinned)) : undefined
    if (small && smallMeasurement?.fits && smallMeasurement.pages === 1) {
      await add(small, id)
    } else {
    const inline = jsonLines<BookMediaChunk>(resolve(travelDirectory(out, id), 'inline.media.ndjson'))[Symbol.asyncIterator]()
    let first = true
    let emittedContent = false
    for (const field of FIELDS) {
      const resolver = await anchorResolver(root, out, pinned, id, field, readBytes)
      let pageHtml = ''
      let blocks: string[] = []
      let occurrences: string[] = []
      const flush = async () => {
        if (!pageHtml) return
        await add({ page: { type: 'content', travel: { ...travel, url: undefined }, field, html: pageHtml, first, last: false, qr: '' }, blocks, occurrences }, id)
        first = false; emittedContent = true; pageHtml = ''; blocks = []; occurrences = []
      }
      for await (const fragment of incrementalContent(textSource(root, out, pinned, id, field, readBytes), { headingAnchorResolver: resolver })) {
        const rewritten = await rewriteFragment(root, fragment, inline, profile)
        const candidate = mergeContentContinuation(pageHtml, { ...fragment, html: rewritten.html })
        const candidateSource = { type: 'content' as const, travel: { ...travel, url: undefined }, field, html: candidate, first, last: false, qr: '' }
        const fits = candidate.length <= 24_000 && blocks.length < 128 && occurrences.length + rewritten.occurrences.length <= 32
          ? await fitHtml(await renderer.renderBoundedPage(candidateSource, { start_page: plan.pages + 1, folio_area_mm: 12 }, pinned)) : { fits: false, pages: 0 }
        if (!fits.fits || fits.pages !== 1) await flush()
        const next = { ...fragment, html: rewritten.html }
        pageHtml = pageHtml ? mergeContentContinuation(pageHtml, next) : continueContentOnPage(next).html
        blocks.push(`${id}:${field}:fragment:${fragment.index}`)
        occurrences.push(...rewritten.occurrences)
      }
      await flush()
    }
    if (!(await inline.next()).done) throw new Error('SNAPSHOT_INLINE_MEDIA_COVERAGE_MISMATCH')
    // The final online card is measured too; it cannot silently spill past the last text page.
    await add({ page: { type: 'content', travel, field: 'description', html: '', first: !emittedContent, last: true, qr }, blocks: [`${id}:online`], occurrences: [] }, id)
    }
    if (pinned.settings.includeGallery) {
      const rows = jsonLines<BookSnapshotChunk>(resolve(travelDirectory(out, id), 'gallery.ndjson'))[Symbol.asyncIterator]()
      const media = jsonLines<BookMediaChunk>(resolve(travelDirectory(out, id), 'gallery.media.ndjson'))[Symbol.asyncIterator]()
      const configured = pinned.settings.galleryPhotosPerPage
      const capacity = pinned.settings.galleryLayout === 'slideshow' ? 1 : configured === 0 ? 6 : Math.min(14, Math.max(1, configured))
      let photos: NonNullable<TravelForBook['gallery']> = []; let keys: string[] = []; let photoBlocks: string[] = []
      let pixels = 0
      let galleryIndex = 0
      const flushGallery = async () => {
        if (!photos.length) return
        await add({ page: { type: 'gallery', travel: { ...travel, gallery: photos },
          start_index: galleryIndex - photos.length, total_photos: travel.sourceCounts?.photos,
          caption_policy: pinned.settings.showCaptions && pinned.settings.captionPosition !== 'none' ? 'inline' : 'detached',
          aspects: Object.fromEntries(photos.map(photo => [photo.url, photo.aspect || 1])) }, blocks: photoBlocks, occurrences: keys }, id)
        photos = []; keys = []; photoBlocks = []; pixels = 0
      }
      while (true) {
        const row = await rows.next()
        if (row.done) break
        if (row.value.kind !== 'gallery' || !row.value.metadata.image) continue
        const image = await media.next()
        if (image.done || image.value.metadata.resource_key !== row.value.metadata.image) throw new Error('SNAPSHOT_GALLERY_MEDIA_ORDER_MISMATCH')
        const dimensions = await probeFrozenImage(root, image.value, profile)
        if (photos.length && pixels + dimensions.width * dimensions.height > profile.decoded_portion_pixels) await flushGallery()
        pixels += dimensions.width * dimensions.height
        photos.push({ id: row.value.metadata.id, url: assetUrl(image.value), caption: row.value.metadata.caption || undefined, aspect: dimensions.aspect })
        galleryIndex++
        keys.push(image.value.occurrence_key); photoBlocks.push(`${id}:gallery:${row.value.metadata.id}`)
        if (photos.length >= capacity) await flushGallery()
      }
      await flushGallery()
      if (!(await media.next()).done) throw new Error('SNAPSHOT_GALLERY_MEDIA_COVERAGE_MISMATCH')
    }
    let mapStart: number | undefined
    if (pinned.settings.includeMap) {
      let locations: NormalizedLocation[] = []; let mapBlocks: string[] = []; let mapOccurrences: string[] = []
      const images = jsonLines<BookMediaChunk>(resolve(travelDirectory(out, id), 'route-image.media.ndjson'))[Symbol.asyncIterator]()
      let pointOrdinal = 0
      const flushMap = async () => {
        if (!locations.length) return
        mapStart ??= plan.pages
        await add({ page: { type: 'map', travel, locations, point_start: pointOrdinal - locations.length, show_coordinates: pinned.settings.showCoordinatesOnMapPage }, blocks: mapBlocks, occurrences: mapOccurrences }, id)
        locations = []; mapBlocks = []; mapOccurrences = []
      }
      for await (const row of jsonLines<BookSnapshotChunk>(resolve(travelDirectory(out, id), 'route.ndjson'))) {
        if (row.kind !== 'route') continue
        const route = row.metadata
        pointOrdinal++
        const location: NormalizedLocation = { id: String(route.id), address: route.address, coord: route.coord || `${route.lat},${route.lng}` }
        const coordinates = parseCoordinates(location.coord)
        if (coordinates) { location.lat = coordinates.lat; location.lng = coordinates.lng }
        // Related categories stay in the pinned source; only this row's bounded labels are read.
        for await (const category of jsonLines<BookSnapshotChunk>(resolve(travelDirectory(out, id), 'route-categories', `${route.id}.ndjson`))) {
          if (category.kind === 'route-category' && category.metadata.route_id === route.id) location.categoryName = appendMetadataLabel(location.categoryName, category.metadata.name)
        }
        if (route.image) {
          const image = await images.next()
          if (image.done || image.value.metadata.resource_key !== route.image) throw new Error('SNAPSHOT_ROUTE_MEDIA_ORDER_MISMATCH')
          await probeFrozenImage(root, image.value, profile)
          location.thumbnailUrl = assetUrl(image.value); mapOccurrences.push(image.value.occurrence_key)
        }
        locations.push(location); mapBlocks.push(`${id}:route:${route.id}`)
        if (locations.length === 6) await flushMap()
      }
      await flushMap()
      if (!(await images.next()).done) throw new Error('SNAPSHOT_ROUTE_MEDIA_COVERAGE_MISMATCH')
    }
    await appendRecord(resolve(out, 'chapters.ndjson'), { travel_id: id, start, pages: plan.pages - start, map_start: mapStart } satisfies ChapterRecord)
  }
  if (pinned.settings.includeChecklists && pinned.settings.checklistSections.length) await add({ page: { type: 'checklists' }, blocks: ['book:checklists'], occurrences: [] }, 0)
  await add({ page: { type: 'final', summary, quote: bookQuotes(pinned.seed).final }, blocks: ['book:final'], occurrences: [] }, 0)
  if (pinned.settings.includeMap && summary.mapped_travels >= 2) {
    // Each map portion is also indexed; a giant one-travel group is split instead of clipped.
    for await (const _entry of jsonLines(resolve(out, 'atlas-sources.ndjson'))) plan.atlas_pages += 2
  }
  if (pinned.settings.includeToc) {
    const addToc = async (source: BookSegmentSource): Promise<void> => {
      const fit = await fitHtml(await renderer.renderBoundedPage(source.page, { start_page: 1, folio_area_mm: 12 }, pinned))
      if (!fit.fits || fit.pages !== 1) {
        for await (const portion of subdivideSource(source)) await addToc(portion)
        return
      }
      if (Buffer.byteLength(canonicalJson(source)) > BOOK_SEGMENT_LIMITS.source_bytes) throw new Error('WORKER_SOURCE_ENVELOPE_BUDGET_EXCEEDED')
      await appendRecord(resolve(out, 'toc-plan.ndjson'), source)
      plan.toc_pages++
    }
    let entries: TravelSectionMeta[] = []; let keys: string[] = []; let start = 0
    const flushToc = async () => {
      if (!entries.length) return
      await addToc({ page: { type: 'toc', entries, total: summary.travels, start }, blocks: entries.map(entry => `${entry.travel.id}:toc`), occurrences: keys })
      start += entries.length; entries = []; keys = []
    }
    for await (const chapter of jsonLines<ChapterRecord>(resolve(out, 'chapters.ndjson'))) {
      const travel = await pinnedTravel(out, chapter.travel_id)
      entries.push({ travel, startPage: chapter.start + 1, hasGallery: pinned.settings.includeGallery,
        hasMap: chapter.map_start !== undefined, locations: [], mapPage: chapter.map_start === undefined ? undefined : chapter.map_start + 1 })
      const cover = await firstMedia(out, chapter.travel_id, 'cover')
      if (cover) keys.push(`${cover.occurrence_key}:toc`)
      if (entries.length === 7) await flushToc()
    }
    await flushToc()
  }
  return plan
}

export async function* frontmatter(out: string, pinned: BookDocument, summary: IndexedBookSummary, body: BodyPlan): AsyncGenerator<BookSegmentSource> {
  const first = await pinnedTravel(out, summary.first_travel!)
  const quotes = bookQuotes(pinned.seed)
  let bookCover = pinned.settings.coverType === 'gradient' ? undefined : first.travel_image_url
  let coverOccurrences: string[] = []
  const firstCover = await firstMedia(out, summary.first_travel!, 'cover')
  if (bookCover && firstCover) coverOccurrences = [`${firstCover.occurrence_key}:book-cover`]
  if (pinned.settings.coverType === 'auto' && !pinned.settings.coverImage) {
    try {
      const firstImage = await readBoundedJson<BookMediaChunk>(resolve(out, 'first-cover.json'))
      bookCover = assetUrl(firstImage); coverOccurrences = [`${firstImage.occurrence_key}:book-cover`]
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  if (pinned.settings.coverImage && pinned.settings.coverType !== 'gradient' && pinned.settings.coverType !== 'first-photo') {
    const custom = await readBoundedJson<BookMediaChunk>(resolve(out, 'book-cover.json'))
    bookCover = assetUrl(custom); coverOccurrences = [custom.occurrence_key]
  }
  yield { page: { type: 'cover', data: { title: pinned.settings.title, subtitle: pinned.settings.subtitle,
    userName: first.userName || '', travelCount: summary.travels,
    yearRange: summary.min_year ? `${summary.min_year}${summary.min_year !== summary.max_year ? ` - ${summary.max_year}` : ''}` : undefined,
    coverImage: bookCover, quote: quotes.cover.author ? { text: quotes.cover.text, author: quotes.cover.author } : undefined,
    textPosition: 'auto', showDecorations: true } }, blocks: ['book:cover'], occurrences: coverOccurrences }
  const tocPages = body.toc_pages
  const offset = 1 + tocPages + body.atlas_pages
  if (pinned.settings.includeToc) {
    for await (const source of jsonLines<BookSegmentSource>(resolve(out, 'toc-plan.ndjson'), BOOK_SEGMENT_LIMITS.source_bytes)) {
      if (source.page.type !== 'toc') throw new Error('WORKER_TOC_PLAN_INVALID')
      for (const entry of source.page.entries) { entry.startPage += offset; if (entry.mapPage !== undefined) entry.mapPage += offset }
      yield source
    }
  }
  if (body.atlas_pages) {
    let index = 0
    for await (const source of jsonLines<{ id: number; locations: NormalizedLocation[]; map_start: number }>(resolve(out, 'atlas-sources.ndjson'))) {
      const travel = await pinnedTravel(out, source.id)
      const entries: TravelSectionMeta[] = [{ travel, locations: source.locations, startPage: offset + source.map_start + 1, mapPage: offset + source.map_start + 1, hasMap: true, hasGallery: pinned.settings.includeGallery }]
      for (const part of ['map', 'index'] as const) {
        yield { page: { type: 'atlas', entries, part, total_pages: body.atlas_pages, total_points: summary.points, total_travels: summary.mapped_travels, index },
          blocks: source.locations.map(location => `${source.id}:atlas:${part}:${location.id}`), occurrences: [] }
        index++
      }
    }
  }
}
