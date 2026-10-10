import type { BookSnapshotChunk } from '@/types/bookDocument'
import type { RecordCursor } from './recordCursor'
import type { Sha256CheckpointV1 } from './checkpointHash'
import type { IndexedBookSummary } from './snapshot'

export const PLANNING_PROTOCOL_VERSION = 1 as const
export const MAX_PLANNING_CHECKPOINT_BYTES = 1_048_576

export interface PlanningFile {
  ref: string
  checksum: string
  size_bytes: number
}

export interface PlanningLimits {
  input_bytes: number
  output_bytes: number
  output_records: number
  probes: number
}

export interface PlanningRequest {
  renderer_content_hash: string
  generation: number
  checkpoint?: PlanningFile
  limits?: Partial<PlanningLimits>
}

export interface IndexCounts {
  kinds: Partial<Record<BookSnapshotChunk['kind'], number>>
  roles: Partial<Record<string, number>>
  fields: Partial<Record<string, number>>
  photos: number
  locations: number
}

export interface VerifiedSourceCursor {
  chunk: BookSnapshotChunk
  offset: number
  hash: Sha256CheckpointV1
}

export interface SnapshotIndexState {
  manifest?: RecordCursor
  manifest_done: boolean
  manifest_hash: Sha256CheckpointV1
  verification?: VerifiedSourceCursor
  summary: IndexedBookSummary
  current_travel?: number
  current_route?: { id: number; position: number; categories: number; media: Array<{ role: string; resource_key: string }> }
  current_counts: IndexCounts
  global_counts: IndexCounts
  first_cover_position?: number
  book_cover_position?: number
}

export interface PlanningCheckpoint {
  version: typeof PLANNING_PROTOCOL_VERSION
  identity: string
  generation: number
  phase: 'index' | 'indexed'
  index: SnapshotIndexState
}

export interface PlanningStepResult {
  planning_protocol_version: typeof PLANNING_PROTOCOL_VERSION
  generation: number
  checkpoint: PlanningFile
  phase: PlanningCheckpoint['phase']
  outputs: PlanningFile[]
  consumed_bytes: number
  deltas: { sources: number; travels: number; included_media_occurrences: number }
}
