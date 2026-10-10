import { mkdir, open, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { BookDocument } from '@/types/bookDocument'
import { assertBookDocument } from '@/services/pdf-export/segments/snapshotAdapter'
import { assertBookSegmentSourceSchema, renderSegment, type BookSegmentSource, type SegmentRenderRequest, type SegmentRenderResult } from '@/services/pdf-export/segments/renderSegment'
import { CanonicalPageRenderer } from '@/services/pdf-export/segments/CanonicalPageRenderer'
import type { BookPageContext } from '@/services/pdf-export/segments/types'
import type { PrintSourcePolicy, PrintEncoderIdentity, PrintServedResource } from '@/services/pdf-export/segments/printAssetsTypes'
import { BOOK_SEGMENT_LIMITS } from '@/services/pdf-export/segments/types'
import { canonicalJson, privatePath, readBoundedBytes, sha256 } from './filesystem'
import { DEFAULT_RENDERER_RESOURCE_PROFILE, physicalMeasurer, validateRendererResourceProfile, type MeasurePage, type RendererResourceProfile, type PhysicalMeasurer } from './measurement'
import { withWorkerLocale } from './locale'
import { withImageAnalysis } from './imageAnalysis'
import { planningIdentity, type PlanningPhysicalSession } from './planningSession'

export interface PreparedPageRequest extends SegmentRenderRequest {
  /** Canonical plan checksum and placement keys, independently committed by B3. */
  resource_bindings_hash?: string
  resource_policy_hash?: string
  encoder_identity_hash?: string
  source_checksum: string
  expected: { blocks: string[]; occurrences: string[] }
}
export interface PreparedPageOptions {
  /** B3 serializes ownership and closes this borrowed schema5 session after the job/epoch. */
  physical_session?: PlanningPhysicalSession
  renderer_content_hash?: string
  resource_profile?: RendererResourceProfile
  fonts_dir?: string
  /** Protocol fixtures only; receipts with an injected port are measured:false. */
  measure?: MeasurePage
}
export interface PreparedPageReceipt extends SegmentRenderResult {
  snapshot_hash: string
  settings_hash: string
  renderer_version: string
  segment_ref: string
  source_checksum: string
  measured: boolean
  resource_profile: RendererResourceProfile
  source_schema_version: number
  resource_bindings_hash?: string
  resource_policy_hash?: string
  encoder_identity_hash?: string
  encoder_identity?: PrintEncoderIdentity
  served_resources?: PrintServedResource[]
  pdf?: { pdf_ref: string; checksum: string; size_bytes: number; pages: 1 }
}

export function printReplayPolicy(version: BookSegmentSource['source_schema_version']): PrintSourcePolicy {
  switch (version) {
    case undefined: case 1: case 2: case 3: return 3
    case 4: return 4
    case 5: return 5
    default: throw new Error('SEGMENT_SOURCE_SCHEMA_UNSUPPORTED')
  }
}

/** B3 must commit the returned source/checksum before consuming the bounded portion adapter. */
export async function prepareSegmentSource(source: BookSegmentSource, pinned: BookDocument, page: BookPageContext, physical: PhysicalMeasurer): Promise<BookSegmentSource> {
  assertBookSegmentSourceSchema(source)
  if ((source.source_schema_version ?? 1) === 1 && source.page.type === 'map') throw new Error('SEGMENT_SOURCE_SCHEMA_UPGRADE_REQUIRED')
  const policy: PrintSourcePolicy = (source.source_schema_version ?? 1) >= 3 ? printReplayPolicy(source.source_schema_version) : 5
  const html = await new CanonicalPageRenderer(pinned.settings.template).renderBoundedPage(source.page, page, pinned, policy === 4 || policy === 5)
  const prepared = await physical.prepareHtml(html, (source.source_schema_version ?? 1) >= 3 ? source : undefined, policy)
  return { ...source, source_schema_version: policy, resource_bindings: prepared.resource_bindings,
    resource_bindings_hash: prepared.resource_bindings_hash, resource_policy_hash: prepared.resource_policy_hash, encoder_identity_hash: prepared.encoder_identity_hash }
}

/** One B3-supervised portion. B3 fences and publishes this receipt after its cgroup checks. */
export async function renderPreparedPage(
  jobRoot: string, planRoot: string, portionOut: string, pinned: BookDocument,
  request: PreparedPageRequest, options: PreparedPageOptions = {},
): Promise<PreparedPageReceipt> {
  assertBookDocument(pinned)
  if (request.snapshot_hash !== pinned.snapshot_hash || sha256(canonicalJson(pinned.settings)) !== pinned.settings_hash) throw new Error('SEGMENT_SNAPSHOT_HASH_MISMATCH')
  if (!/^[0-9a-f]{64}$/.test(request.source_checksum) || request.expected.blocks.length > 256 || request.expected.occurrences.length > 64) throw new Error('SEGMENT_PLAN_INVALID')
  const sourceFile = await privatePath(planRoot, request.segment_ref)
  const sourceBytes = await readBoundedBytes(sourceFile, BOOK_SEGMENT_LIMITS.source_bytes)
  if (sha256(sourceBytes) !== request.source_checksum) throw new Error('SEGMENT_PLAN_INTEGRITY_FAILED')
  const source = JSON.parse(sourceBytes.toString('utf8')) as BookSegmentSource
  assertBookSegmentSourceSchema(source)
  if (
    canonicalJson(source.blocks) !== canonicalJson(request.expected.blocks) || canonicalJson(source.occurrences) !== canonicalJson(request.expected.occurrences)) throw new Error('SEGMENT_PLAN_INTEGRITY_FAILED')
  if ((source.source_schema_version ?? 1) >= 3 && (request.resource_bindings_hash !== source.resource_bindings_hash || request.resource_policy_hash !== source.resource_policy_hash || request.encoder_identity_hash !== source.encoder_identity_hash || options.measure)) throw new Error('PRINT_RESOURCE_BINDING_MISMATCH')
  if ((source.source_schema_version ?? 1) < 3 && [request.resource_bindings_hash, request.resource_policy_hash, request.encoder_identity_hash].some(value => value !== undefined)) throw new Error('PRINT_RESOURCE_BINDING_MISMATCH')
  const resourceProfile = options.resource_profile ?? DEFAULT_RENDERER_RESOURCE_PROFILE
  validateRendererResourceProfile(resourceProfile)
  if (options.physical_session && (options.measure || source.source_schema_version !== 5 ||
      !/^[a-f0-9]{64}$/.test(options.renderer_content_hash ?? '') ||
      options.physical_session.identity !== planningIdentity(pinned, options.renderer_content_hash!, resourceProfile, false) ||
      options.physical_session.jobRoot !== resolve(jobRoot) || options.physical_session.planRoot !== resolve(planRoot))) {
    throw new Error('WORKER_PLANNING_SESSION_MISMATCH')
  }
  const out = resolve(portionOut)
  if (out === resolve(jobRoot) || out === resolve(planRoot)) throw new Error('WORKER_OUTPUT_CONFLICT')
  await mkdir(out, { mode: 0o700 })
  const fontsDir = options.fonts_dir ?? resolve(__dirname, '../../fonts')
  const policy = printReplayPolicy(source.source_schema_version)
  const created: string[] = []
  const persistExclusive = async (name: string, bytes: string | Buffer) => {
    const file = resolve(out, name)
    const handle = await open(file, 'wx', 0o600)
    created.push(file)
    try { await handle.writeFile(bytes); await handle.sync() } finally { await handle.close() }
    const directory = await open(out, 'r')
    try { await directory.sync() } finally { await directory.close() }
  }
  try {
    const physical = options.measure ? undefined : options.physical_session ? await options.physical_session.get() : await physicalMeasurer(jobRoot, planRoot, fontsDir, resourceProfile, policy)
    let receipt: PreparedPageReceipt
    try {
      const fontCss = physical ? (await readBoundedBytes(resolve(fontsDir, 'fonts.css'), 512 * 1024)).toString('utf8') : ''
      const execute = async () => {
        let pdf: Buffer | undefined
        let measuredHtmlChecksum: string | undefined
        const measure: MeasurePage = options.measure ?? (async html => {
          const measured = await physical!.measurePdf(html)
          pdf = measured.pdf
          measuredHtmlChecksum = sha256(html)
          return { pages: measured.pages, fits: measured.fits }
        })
        let pdfReceipt: PreparedPageReceipt['pdf']
        const result = await renderSegment(request, pinned, {
          load: async () => source,
          verifyResources: physical?.assertResourceServing,
          prepare: physical ? async (html, source) => (await physical.prepareHtml(html, source)).html : undefined,
          measure,
          persist: async html => {
            if (physical) {
              if (!Buffer.isBuffer(pdf) || !pdf.length || pdf.length > 4 * 1024 * 1024 || measuredHtmlChecksum !== sha256(html)) throw new Error('WORKER_MEASURED_PDF_MISMATCH')
              pdfReceipt = { pdf_ref: 'page.pdf', checksum: sha256(pdf), size_bytes: pdf.length, pages: 1 }
              await persistExclusive('page.pdf', pdf)
              pdf = undefined
            }
            const pinnedHtml = fontCss ? html.replace(/<link\b[^>]*https:\/\/fonts\.[^>]*>/g, '').replace('</head>', `<style>${fontCss}</style></head>`) : html
            await persistExclusive('page.html', pinnedHtml)
            return { html_ref: 'page.html', checksum: sha256(pinnedHtml) }
          },
        })
        const receipt: PreparedPageReceipt = { ...result, snapshot_hash: pinned.snapshot_hash,
          settings_hash: pinned.settings_hash, renderer_version: pinned.renderer_version,
          segment_ref: request.segment_ref, source_checksum: request.source_checksum,
          resource_bindings_hash: source.resource_bindings_hash, resource_policy_hash: source.resource_policy_hash, encoder_identity_hash: source.encoder_identity_hash,
          encoder_identity: (source.source_schema_version ?? 1) >= 3 ? physical?.encoder_identity : undefined,
          served_resources: (source.source_schema_version ?? 1) >= 3 ? physical?.servedResources() : undefined,
          measured: !!physical, resource_profile: resourceProfile, source_schema_version: source.source_schema_version ?? 1,
          ...(pdfReceipt ? { pdf: pdfReceipt } : {}) }
        return receipt
      }
      receipt = await withWorkerLocale(pinned.settings.locale, () => physical ? withImageAnalysis(physical, execute) : execute())
    } finally { if (!options.physical_session) await physical?.close() }
    await persistExclusive('receipt.json', canonicalJson(receipt))
    return receipt
  } catch (error) {
    await Promise.all(created.map(file => rm(file, { force: true })))
    throw error
  }
}
