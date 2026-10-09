/** Private worker data only; original B1 snapshot/media identity never changes. */
export const PRINT_ASSET_RECIPE = {
  version: 1, max_long_edge: 2400, max_pixels: 5_760_000, jpeg_quality: 0.92,
  jpeg_passthrough_bytes: 2097152,
  upscale: false, crop: false, alpha: 'preserve-png', color_space: 'srgb',
} as const

export interface PrintEncoderIdentity {
  browser_name: 'chromium'
  playwright_version: string
  chromium_revision: string
  chromium_version: string
  executable_sha256: string
  platform: string
  arch: string
}

export interface PrintResourceBinding {
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
