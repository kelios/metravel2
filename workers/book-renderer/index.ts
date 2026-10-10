import { access, mkdir, opendir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { BookDocument } from '@/types/bookDocument'
import { BOOK_RENDERER_VERSION } from '@/types/bookDocument'
import { assertBookDocument } from '@/services/pdf-export/segments/snapshotAdapter'
import { renderSegment, type BookSegmentSource } from '@/services/pdf-export/segments/renderSegment'
import { CanonicalPageRenderer } from '@/services/pdf-export/segments/CanonicalPageRenderer'
import type { PrintEncoderIdentity } from '@/services/pdf-export/segments/printAssetsTypes'
import { BOOK_SEGMENT_LIMITS } from '@/services/pdf-export/segments/types'
import { appendRecord, canonicalJson, jsonLines, makePrivateDirectory, readBoundedBytes, readBoundedJson, sha256 } from './filesystem'
import { DEFAULT_RENDERER_RESOURCE_PROFILE, physicalMeasurer, validateRendererResourceProfile, type MeasurePage, type PhysicalMeasurer, type RendererResourceProfile } from './measurement'
import { indexSnapshot } from './snapshot'
import { frontmatter, planBody, type BodyRecord } from './planner'
import { withWorkerLocale } from './locale'
import { withImageAnalysis } from './imageAnalysis'

export { PRINT_ASSET_RECIPE, PRINT_VARIANT_RECIPE, PRINT_ORIENTED_VARIANT_RECIPE, assertPrintOrientedBinding, assertPrintVariantBinding, assertPrintResourceBinding } from '@/services/pdf-export/segments/printAssetsTypes'
export { PRINT_RESOURCE_POLICY_HASH, PRINT_VARIANT_POLICY_HASH, PRINT_ORIENTED_VARIANT_POLICY_HASH, transformPrintResourceUrls, checkPrintWorkingBudget } from './printAssets'
export { normalizePrintOrientation, readPrintOrientation, printOrientationMatrix } from './printOrientation'
export { physicalMeasurer, DEFAULT_RENDERER_RESOURCE_PROFILE } from './measurement'
export { prepareSegmentSource } from './portion'
export { renderPreparedPage, type PreparedPageRequest, type PreparedPageReceipt } from './portion'
export { BOOK_SEGMENT_SOURCE_SCHEMA_VERSION } from '@/services/pdf-export/segments/types'
export { renderSegment, assertBookSegmentSourceSchema } from '@/services/pdf-export/segments/renderSegment'
export { iterateSnapshotChunks, iterateTextFieldRefs, streamSnapshotChunk } from '@/services/pdf-export/segments/snapshotAdapter'
export { incrementalContent } from '@/services/pdf-export/parsers/incrementalContent'
export { incrementalContentStep, type IncrementalContentCheckpoint, type IncrementalStepOptions } from './htmlCheckpoint/incrementalStep'
export { createDiskCheckpointStores } from './htmlCheckpoint/diskStores'
export { HTML_PORT_PROTOCOL_VERSION, HTML_PORT_UPSTREAM_PIN } from './htmlCheckpoint/protocol'
export { preparePlanningStep, type PlanningStepOptions } from './planningStep'
export { PlanningPhysicalSession } from './planningSession'
export { PLANNING_PROTOCOL_VERSION, type PlanningRequest, type PlanningStepResult } from './planningTypes'
export { subdivideSource } from '@/services/pdf-export/segments/subdivideSource'
export { CanonicalPageRenderer } from '@/services/pdf-export/segments/CanonicalPageRenderer'
export { PDF_THEMES } from '@/services/pdf-export/themes/PdfThemeConfig'
export { getFixedTranslator } from './locale'

export interface WorkerCertificate {
  renderer_version: string
  prepared_source_schema_version: 5
  print_resource_policy_hash?: string
  print_encoder_identity?: PrintEncoderIdentity
  snapshot_hash: string
  settings_hash: string
  measured: boolean
  expected: { travels: number; blocks: number; mediaOccurrences: number; pages: number }
  completed: { travels: number; blocks: number; mediaOccurrences: number; pages: number }
  peak_heap_bytes: number
  source_count: number
  source_media_coverage: { expected: number; completed: number }
  resource_profile: RendererResourceProfile
  plan_ref: string
}
export interface WorkerOptions {
  read_bytes?: number
  /** Unit protocol verification only; an injected port never claims physical acceptance. */
  measure?: MeasurePage
  fonts_dir?: string
  resource_profile?: RendererResourceProfile
}

/** Diagnostic full-run driver. B3 supervises the exported bounded primitives/portion adapter. */
export async function runWorker(jobDir: string, outDir: string, options: WorkerOptions = {}): Promise<WorkerCertificate> {
  const root = resolve(jobDir)
  const out = resolve(outDir)
  if (root === out) throw new Error('WORKER_OUTPUT_CONFLICT')
  const pinned = await readBoundedJson<BookDocument>(resolve(root, 'document.json'), 8 * 1024 * 1024 + 65_536)
  assertBookDocument(pinned)
  const resourceProfile = options.resource_profile ?? DEFAULT_RENDERER_RESOURCE_PROFILE
  validateRendererResourceProfile(resourceProfile)
  await mkdir(out, { mode: 0o700 })
  await makePrivateDirectory(resolve(out, 'pages'))
  await makePrivateDirectory(resolve(out, 'coverage', 'blocks'))
  await makePrivateDirectory(resolve(out, 'coverage', 'occurrences'))
  await makePrivateDirectory(resolve(out, 'expected-occurrences'))
  let physical: PhysicalMeasurer | undefined
  const readBytes = options.read_bytes ?? 65_536
  const fontsDir = options.fonts_dir ?? resolve(__dirname, '../../fonts')
  let peakHeap = process.memoryUsage().heapUsed
  try {
    const summary = await indexSnapshot(root, out, pinned, readBytes)
    if (!options.measure) physical = await physicalMeasurer(root, out, fontsDir, resourceProfile)
    const measure = options.measure ?? physical!.measure
    const fit = options.measure ?? physical!.fit
    const execute = async () => {
      const body = await planBody(root, out, pinned, summary, fit, readBytes, resourceProfile, physical?.prepareHtml, physical?.assertResourceServing)
      const certificate: WorkerCertificate = { prepared_source_schema_version: 5, renderer_version: BOOK_RENDERER_VERSION,
        snapshot_hash: pinned.snapshot_hash, settings_hash: pinned.settings_hash, measured: !options.measure,
        expected: { travels: summary.travels, blocks: body.blocks, mediaOccurrences: body.occurrences, pages: body.pages },
        completed: { travels: summary.travels, blocks: 0, mediaOccurrences: 0, pages: 0 },
        source_count: summary.sources, peak_heap_bytes: peakHeap, plan_ref: 'plan.ndjson',
        print_resource_policy_hash: physical?.resource_policy_hash, print_encoder_identity: physical?.encoder_identity,
        source_media_coverage: { expected: summary.included_media_occurrences, completed: 0 }, resource_profile: resourceProfile }
      let order = 0
      const fontCss = options.measure ? '' : (await readBoundedBytes(resolve(fontsDir, 'fonts.css'), 512 * 1024)).toString('utf8')
      const emit = async (source: BookSegmentSource, ref: string, front: boolean) => {
        if (source.source_schema_version !== 5) {
          source = { ...source, source_schema_version: 2 }
          if (physical) {
            const html = await new CanonicalPageRenderer(pinned.settings.template).renderBoundedPage(source.page, { start_page: order + 1, folio_area_mm: 12 }, pinned, true)
            const prepared = await physical.prepareHtml(html, undefined, 5)
            source = { ...source, resource_bindings: prepared.resource_bindings, resource_bindings_hash: prepared.resource_bindings_hash,
              resource_policy_hash: prepared.resource_policy_hash, encoder_identity_hash: prepared.encoder_identity_hash, source_schema_version: 5 }
          }
        }
        // Front matter also has a committed bounded prepared source, not a transient name.
        if (front && physical) {
          ref = `pages/${order}.source.json`
          await writeFile(resolve(out, ref), canonicalJson(source), { mode: 0o600, flag: 'wx' })
        }
        if (front) {
          certificate.expected.pages++
          certificate.expected.blocks += source.blocks.length
          certificate.expected.mediaOccurrences += source.occurrences.length
        }
        for (const [kind, keys] of [['blocks', source.blocks], ['occurrences', source.occurrences]] as const) {
          for (const key of keys) await writeFile(resolve(out, 'coverage', kind, sha256(key)), key, { flag: 'wx', mode: 0o600 })
        }
        const fileRef = `pages/${order}.html`
        const result = await renderSegment({ segment_ref: ref, snapshot_hash: pinned.snapshot_hash,
          page_context: { start_page: order + 1, folio_area_mm: 12 } }, pinned, {
          load: async () => source,
          verifyResources: physical?.assertResourceServing,
          prepare: physical ? async (html, source) => (await physical!.prepareHtml(html, source)).html : undefined,
          measure,
          persist: async html => {
            const pinnedHtml = fontCss ? html.replace(/<link\b[^>]*https:\/\/fonts\.[^>]*>/g, '').replace('</head>', `<style>${fontCss}</style></head>`) : html
            await writeFile(resolve(out, fileRef), pinnedHtml, { mode: 0o600 })
            return { html_ref: fileRef, checksum: sha256(pinnedHtml) }
          },
        })
        await appendRecord(resolve(out, 'plan.ndjson'), { order, segment_ref: ref, file_ref: fileRef,
          type: source.page.type, start_page: order + 1, folio_area_mm: 12,
          checksum: result.checksum, measured_pages: result.measured_pages,
          source_checksum: sha256(canonicalJson(source)), source_schema_version: source.source_schema_version,
          resource_bindings_hash: source.resource_bindings_hash, resource_policy_hash: source.resource_policy_hash, encoder_identity_hash: source.encoder_identity_hash,
          served_resources: physical?.servedResources(), frontmatter: front,
          blocks: source.blocks, occurrences: source.occurrences })
        certificate.completed.pages += result.measured_pages
        certificate.completed.blocks += result.completed.blocks
        certificate.completed.mediaOccurrences += result.completed.mediaOccurrences
        peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed)
        order++
      }
      for await (const source of frontmatter(out, pinned, summary, body)) await emit(source, `frontmatter:${order}`, true)
      for await (const row of jsonLines<BodyRecord>(resolve(out, 'body.ndjson'))) {
        await emit(await readBoundedJson<BookSegmentSource>(resolve(out, row.ref), BOOK_SEGMENT_LIMITS.source_bytes), row.ref, false)
      }
      if (canonicalJson(certificate.expected) !== canonicalJson(certificate.completed)) throw new Error('WORKER_COVERAGE_MISMATCH')
      for await (const entry of await opendir(resolve(out, 'expected-occurrences'))) {
        await access(resolve(out, 'coverage', 'occurrences', entry.name))
        certificate.source_media_coverage.completed++
      }
      if (certificate.source_media_coverage.expected !== certificate.source_media_coverage.completed) throw new Error('WORKER_SOURCE_MEDIA_COVERAGE_MISMATCH')
      certificate.peak_heap_bytes = peakHeap
      await writeFile(resolve(out, 'certificate.json'), canonicalJson(certificate), { mode: 0o600 })
      return certificate
    }
    return await withWorkerLocale(pinned.settings.locale, () => physical
      ? withImageAnalysis(physical, execute) : execute())
  } finally { await physical?.close() }
}

if (require.main === module) {
  const [jobDir, outDir] = process.argv.slice(2)
  if (!jobDir || !outDir) throw new Error('Usage: node renderer <private-job-dir> <new-output-dir>')
  runWorker(jobDir, outDir).then(result => process.stdout.write(`${JSON.stringify(result)}\n`), error => {
    process.stderr.write(`${error instanceof Error ? error.message : 'WORKER_FAILED'}\n`)
    process.exitCode = 1
  })
}
