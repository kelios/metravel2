import { createHash } from 'node:crypto'

export const PRINT_ORIENTATION_METADATA_BYTES = 65_536
export type PrintOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export interface NormalizedPrintOrientation {
  orientation: PrintOrientation
  carrier: Buffer
  checksum: string
  working_bytes: number
}
interface OrientationLocation { orientation: PrintOrientation; offset?: number; little?: boolean; crc?: { start: number; end: number; offset: number } }
const invalid = (): never => { throw new Error('PRINT_IMAGE_ORIENTATION_METADATA_INVALID') }
const budget = (): never => { throw new Error('PRINT_IMAGE_ORIENTATION_METADATA_BUDGET_EXCEEDED') }
export function printOrientationCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function tiff(bytes: Buffer, start: number, end: number): OrientationLocation {
  if (end - start > PRINT_ORIENTATION_METADATA_BYTES) budget()
  if (end - start < 8) invalid()
  const order = bytes.toString('ascii', start, start + 2)
  if (order !== 'II' && order !== 'MM') invalid()
  const little = order === 'II'
  const u16 = (offset: number) => little ? bytes.readUInt16LE(offset) : bytes.readUInt16BE(offset)
  const u32 = (offset: number) => little ? bytes.readUInt32LE(offset) : bytes.readUInt32BE(offset)
  if (u16(start + 2) !== 42) invalid()
  const relative = u32(start + 4)
  if (relative < 8 || relative > end - start - 2) invalid()
  const first = start + relative, count = u16(first)
  if (count > Math.floor((end - first - 6) / 12)) invalid()
  let result: OrientationLocation = { orientation: 1 }
  for (let index = 0; index < count; index++) {
    const at = first + 2 + 12 * index
    if (u16(at) !== 0x0112) continue
    if (result.offset !== undefined || u16(at + 2) !== 3 || u32(at + 4) !== 1) invalid()
    const value = u16(at + 8)
    if (value < 1 || value > 8) invalid()
    result = { orientation: value as PrintOrientation, offset: at + 8, little }
  }
  return result
}

function locateOrientation(bytes: Buffer): OrientationLocation {
  let found: OrientationLocation | undefined
  const read = (start: number, end: number, crc?: OrientationLocation['crc']) => {
    if (found) invalid()
    found = { ...tiff(bytes, start, end), ...(crc ? { crc } : {}) }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2, complete = false
    while (offset < bytes.length) {
      if (bytes[offset++] !== 0xff) invalid()
      while (bytes[offset] === 0xff) offset++
      const marker = bytes[offset++]
      if (marker === undefined || marker === 0 || marker === 0xd8) invalid()
      if (marker === 0xd9) { complete = true; break }
      if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue
      if (offset + 2 > bytes.length) invalid()
      const length = bytes.readUInt16BE(offset)
      if (length < 2 || length > bytes.length - offset) invalid()
      const start = offset + 2, end = offset + length
      if (marker === 0xe1 && bytes.toString('ascii', start, start + Math.min(4, end - start)) === 'Exif' && bytes.toString('ascii', start, start + Math.min(6, end - start)) !== 'Exif\0\0') invalid()
      if (marker === 0xe1 && bytes.toString('ascii', start, start + Math.min(6, end - start)) === 'Exif\0\0') read(start + 6, end)
      offset = end
      if (marker === 0xda) { complete = true; break }
    }
    if (!complete) invalid()
  } else if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    let offset = 8, complete = false, first = true
    while (offset < bytes.length) {
      if (offset + 12 > bytes.length) invalid()
      const size = bytes.readUInt32BE(offset), kind = bytes.toString('ascii', offset + 4, offset + 8)
      if (size > bytes.length - offset - 12 || !/^[A-Za-z]{4}$/.test(kind) || (first && (kind !== 'IHDR' || size !== 13)) || (!first && kind === 'IHDR')) invalid()
      const start = offset + 8, end = start + size
      if (printOrientationCrc32(bytes.subarray(offset + 4, end)) !== bytes.readUInt32BE(end)) invalid()
      if (kind === 'acTL' || kind === 'fcTL' || kind === 'fdAT') throw new Error('PRINT_IMAGE_ANIMATION_UNSUPPORTED')
      if (kind === 'eXIf') read(start, end, { start: offset + 4, end, offset: end })
      offset = end + 4; first = false
      if (kind === 'IEND') { if (size || offset !== bytes.length) invalid(); complete = true; break }
    }
    if (!complete) invalid()
  } else if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    if (bytes.length < 12 || bytes.readUInt32LE(4) !== bytes.length - 8) invalid()
    let offset = 12, flags: number | undefined
    while (offset < bytes.length) {
      if (offset + 8 > bytes.length) invalid()
      const kind = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4)
      if (size > bytes.length - offset - 8) invalid()
      const start = offset + 8, end = start + size
      if (kind === 'VP8X') {
        if (flags !== undefined || offset !== 12 || size !== 10) invalid()
        flags = bytes[start]
        if ((flags & 0xc1) || bytes[start + 1] || bytes[start + 2] || bytes[start + 3]) invalid()
        if (flags & 2) throw new Error('PRINT_IMAGE_ANIMATION_UNSUPPORTED')
      }
      if (kind === 'ANIM' || kind === 'ANMF') throw new Error('PRINT_IMAGE_ANIMATION_UNSUPPORTED')
      if (kind === 'EXIF') read(bytes.toString('ascii', start, start + Math.min(6, size)) === 'Exif\0\0' ? start + 6 : start, end)
      offset = end + (size & 1)
      if (offset > bytes.length || ((size & 1) && bytes[end] !== 0)) invalid()
    }
    if (offset !== bytes.length || (!!found !== !!(flags !== undefined && (flags & 8)))) invalid()
  } else throw new Error('PRINT_IMAGE_FORMAT_UNSUPPORTED')
  return found ?? { orientation: 1 }
}

/** Original compressed pixels stay immutable; only the inline EXIF tag and its PNG CRC change. */
export function normalizePrintOrientation(bytes: Buffer, maxBytes: number): NormalizedPrintOrientation {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || bytes.length > maxBytes) throw new Error('SNAPSHOT_IMAGE_ENCODED_BUDGET_EXCEEDED')
  const location = locateOrientation(bytes)
  const carrier = location.orientation === 1 ? bytes : Buffer.from(bytes)
  if (location.orientation !== 1) {
    if (location.offset === undefined) invalid()
    if (location.little) carrier.writeUInt16LE(1, location.offset); else carrier.writeUInt16BE(1, location.offset)
    if (location.crc) carrier.writeUInt32BE(printOrientationCrc32(carrier.subarray(location.crc.start, location.crc.end)), location.crc.offset)
  }
  return { orientation: location.orientation, carrier, checksum: createHash('sha256').update(carrier).digest('hex'), working_bytes: carrier === bytes ? 0 : carrier.length }
}

export function readPrintOrientation(bytes: Buffer): PrintOrientation { return locateOrientation(bytes).orientation }

export function orientedPrintDimensions(width: number, height: number, orientation: PrintOrientation): { width: number; height: number } {
  return orientation >= 5 ? { width: height, height: width } : { width, height }
}
export function printOrientationMatrix(orientation: PrintOrientation, width: number, height: number): [number, number, number, number, number, number] {
  switch (orientation) {
    case 1: return [1, 0, 0, 1, 0, 0]
    case 2: return [-1, 0, 0, 1, width, 0]
    case 3: return [-1, 0, 0, -1, width, height]
    case 4: return [1, 0, 0, -1, 0, height]
    case 5: return [0, 1, 1, 0, 0, 0]
    case 6: return [0, 1, -1, 0, height, 0]
    case 7: return [0, -1, -1, 0, height, width]
    case 8: return [0, -1, 1, 0, 0, width]
  }
  throw new Error('PRINT_IMAGE_ORIENTATION_METADATA_INVALID')
}
