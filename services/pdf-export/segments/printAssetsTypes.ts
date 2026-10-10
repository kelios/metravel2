import { assertWorkerImageEffect, type WorkerImageEffect } from './workerImageEffects'
/** Private worker data only; original B1 snapshot/media identity never changes. */
export const PRINT_ASSET_RECIPE = {
  version: 1, max_long_edge: 2400, max_pixels: 5_760_000, jpeg_quality: 0.92,
  jpeg_passthrough_bytes: 2097152,
  upscale: false, crop: false, alpha: 'preserve-png', color_space: 'srgb',
} as const

export const PRINT_VARIANT_RECIPE = {
  version: 2, max_long_edge: 2400, max_pixels: 5_760_000, jpeg_quality: 0.92,
  jpeg_passthrough_bytes: 2097152, upscale: false, crop: false, alpha: 'preserve-png', color_space: 'srgb',
  color_transform: 'canonical-theme-color-only-v1',
} as const

export const PRINT_ORIENTED_VARIANT_RECIPE = {
  version: 3, max_long_edge: 2400, max_pixels: 5_760_000, jpeg_quality: 0.92,
  jpeg_passthrough_bytes: 2097152, upscale: false, crop: false, alpha: 'preserve-png', color_space: 'srgb',
  color_transform: 'canonical-theme-color-only-v1', orientation: 'bounded-ifd0-neutral-carrier-affine-1-8-v1',
} as const
export type PrintSourcePolicy = 3 | 4 | 5
/** Canonical JSON print-cache descriptor bound; planning generations reserve it with each binary. */
export const PRINT_DESCRIPTOR_MAX_BYTES = 65_536

export interface PrintEncoderIdentity {
  browser_name: 'chromium'
  playwright_version: string
  chromium_revision: string
  chromium_version: string
  /** Exact version reported by the pinned executable; Linux builds of the same revision end in `.0`. */
  actual_chromium_version: string
  executable_sha256: string
  platform: string
  arch: string
}

export interface PrintResourceBinding {
  original_orientation?: number
  raw_width?: number
  raw_height?: number
  oriented_width?: number
  oriented_height?: number
  normalized_decode_checksum?: string
  normalized_decode_bytes?: number
  normalization_working_bytes?: number
  variant_hash?: string
  effect?: WorkerImageEffect
  filter_working_pixels?: number
  original_checksum: string
  served_checksum: string
  descriptor_ref: string
  descriptor_checksum: string
  served_file_ref: string
  mode: 'encoded' | 'passthrough'
  mime: 'image/jpeg' | 'image/png'
  width: number
  height: number
  encoded_bytes: number
  original_encoded_bytes: number
  original_transfer_bytes: number
  original_pixels: number
  alpha_canvas_pixels: number
  alpha_scratch_bytes: number
  canvas_pixels: number
  encoder_pixels: number
  served_pixels: number
  transfer_bytes: number
  pixel_scratch_bytes: number
  recipe_hash: string
  encoder_identity_hash: string
}

export interface PreparedPrintResources {
  html: string
  resource_bindings: PrintResourceBinding[]
  resource_bindings_hash: string
  resource_policy_hash: string
  encoder_identity_hash: string
}

export function assertPrintResourceBinding(value: PrintResourceBinding): void {
  if (!value || typeof value !== 'object' || !['encoded', 'passthrough'].includes(value.mode) || !['image/jpeg', 'image/png'].includes(value.mime)) throw new Error('SEGMENT_RESOURCE_BINDING_INVALID')
  for (const field of ['original_checksum', 'served_checksum', 'descriptor_checksum', 'recipe_hash', 'encoder_identity_hash'] as const) {
    if (typeof value[field] !== 'string' || !/^[a-f0-9]{64}$/.test(value[field])) throw new Error('SEGMENT_RESOURCE_BINDING_INVALID')
  }
  for (const field of ['width', 'height', 'encoded_bytes', 'original_encoded_bytes', 'original_pixels', 'served_pixels'] as const) {
    if (!Number.isSafeInteger(value[field]) || value[field] < 1) throw new Error('SEGMENT_RESOURCE_BINDING_INVALID')
  }
  for (const field of ['alpha_canvas_pixels', 'alpha_scratch_bytes', 'canvas_pixels', 'encoder_pixels', 'transfer_bytes', 'pixel_scratch_bytes'] as const) {
    if (!Number.isSafeInteger(value[field]) || value[field] < 0) throw new Error('SEGMENT_RESOURCE_BINDING_INVALID')
  }
  if (!/^print-cache\/[a-f0-9]{64}\.json$/.test(value.descriptor_ref) || value.served_file_ref !== `print-assets/${value.served_checksum}` || value.served_pixels !== value.width * value.height || value.original_transfer_bytes !== Math.ceil(value.original_encoded_bytes / 3) * 4 ||
    (value.mode === 'passthrough' && (value.mime !== 'image/jpeg' || value.served_checksum !== value.original_checksum || value.alpha_canvas_pixels || value.alpha_scratch_bytes || value.canvas_pixels || value.encoder_pixels || value.transfer_bytes || value.pixel_scratch_bytes)) ||
    (value.mode === 'encoded' && (value.canvas_pixels !== value.served_pixels || value.encoder_pixels !== value.canvas_pixels || value.transfer_bytes !== Math.ceil(value.encoded_bytes / 3) * 4 || value.pixel_scratch_bytes !== value.width * Math.min(16, value.height) * 4))) throw new Error('SEGMENT_RESOURCE_BINDING_INVALID')
}

const ORIENTATION_FIELDS = ['original_orientation', 'raw_width', 'raw_height', 'oriented_width', 'oriented_height', 'normalized_decode_checksum', 'normalized_decode_bytes', 'normalization_working_bytes'] as const
export function assertNoPrintOrientationBinding(value: PrintResourceBinding): void {
  if (ORIENTATION_FIELDS.some(field => value[field] !== undefined)) throw new Error('SEGMENT_RESOURCE_BINDING_INVALID')
}
export function assertPrintVariantBinding(value: PrintResourceBinding, oriented = false): void {
  assertPrintResourceBinding(value)
  if (!oriented) assertNoPrintOrientationBinding(value)
  if (typeof value.variant_hash !== 'string' || !/^[a-f0-9]{64}$/.test(value.variant_hash) || !value.effect ||
    !Number.isSafeInteger(value.filter_working_pixels) || value.filter_working_pixels !== (value.effect.filter === 'none' ? 0 : value.served_pixels) ||
    (value.effect.filter !== 'none' && value.mode === 'passthrough')) throw new Error('SEGMENT_RESOURCE_BINDING_INVALID')
  assertWorkerImageEffect(value.effect)
}

export function assertPrintOrientedBinding(value: PrintResourceBinding): void {
  assertPrintVariantBinding(value, true)
  if (!Number.isInteger(value.original_orientation) || value.original_orientation! < 1 || value.original_orientation! > 8 ||
    typeof value.normalized_decode_checksum !== 'string' || !/^[a-f0-9]{64}$/.test(value.normalized_decode_checksum)) throw new Error('SEGMENT_RESOURCE_BINDING_INVALID')
  for (const field of ['raw_width', 'raw_height', 'oriented_width', 'oriented_height', 'normalized_decode_bytes'] as const) {
    if (!Number.isSafeInteger(value[field]) || value[field]! < 1) throw new Error('SEGMENT_RESOURCE_BINDING_INVALID')
  }
  const rotated = value.original_orientation! >= 5
  if (value.raw_width! * value.raw_height! !== value.original_pixels ||
    value.oriented_width !== (rotated ? value.raw_height : value.raw_width) || value.oriented_height !== (rotated ? value.raw_width : value.raw_height) ||
    value.normalized_decode_bytes !== value.original_encoded_bytes || value.normalization_working_bytes !== (value.original_orientation === 1 ? 0 : value.original_encoded_bytes) ||
    (value.original_orientation === 1 && value.normalized_decode_checksum !== value.original_checksum) ||
    (value.original_orientation !== 1 && (value.mode === 'passthrough' || value.normalized_decode_checksum === value.original_checksum))) throw new Error('SEGMENT_RESOURCE_BINDING_INVALID')
}

export interface PrintServedResource { original_checksum: string; served_checksum: string; variant_hash?: string }
