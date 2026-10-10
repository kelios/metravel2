import { resolve } from 'node:path'
import type { BookDocument } from '@/types/bookDocument'
import { assertBookDocument } from '@/services/pdf-export/segments/snapshotAdapter'
import { canonicalJson, sha256 } from './filesystem'
import { physicalMeasurer, validateRendererResourceProfile, type PhysicalMeasurer, type RendererResourceProfile } from './measurement'
import { PLANNING_PROTOCOL_VERSION } from './planningTypes'

export function planningIdentity(document: BookDocument, rendererHash: string, profile: RendererResourceProfile, fixture: boolean): string {
  return sha256(canonicalJson({ version: PLANNING_PROTOCOL_VERSION, renderer_content_hash: rendererHash,
    resource_profile_hash: sha256(canonicalJson(profile)), measurement_mode: fixture ? 'protocol-fixture' : 'physical', document }))
}
/** One serialized job/epoch session; no archive/page hashmap survives a step. B3 owns fencing and telemetry. */
export class PlanningPhysicalSession {
  readonly jobRoot: string
  readonly planRoot: string
  readonly identity: string
  private pending?: Promise<PhysicalMeasurer>
  private closed = false
  private readonly profile: RendererResourceProfile
  constructor(jobRoot: string, planRoot: string, document: BookDocument, rendererHash: string,
    profile: RendererResourceProfile, private readonly fontsDir?: string) {
    assertBookDocument(document)
    validateRendererResourceProfile(profile)
    if (!/^[a-f0-9]{64}$/.test(rendererHash) || sha256(canonicalJson(document.settings)) !== document.settings_hash) throw new Error('WORKER_PLANNING_SESSION_PIN_INVALID')
    this.jobRoot = resolve(jobRoot); this.planRoot = resolve(planRoot)
    this.profile = { ...profile }
    this.identity = planningIdentity(document, rendererHash, this.profile, false)
  }
  async get(): Promise<PhysicalMeasurer> {
    if (this.closed) throw new Error('WORKER_PLANNING_SESSION_CLOSED')
    this.pending ??= physicalMeasurer(this.jobRoot, this.planRoot, this.fontsDir ?? resolve(__dirname, '../../fonts'), this.profile, 5)
    try { return await this.pending } catch (error) { this.pending = undefined; throw error }
  }
  async close(): Promise<void> {
    this.closed = true
    const pending = this.pending; this.pending = undefined
    if (pending) { const physical = await pending; await physical.close() }
  }
}
