/** @jest-environment node */
import { deflateSync } from 'node:zlib'
import { normalizePrintOrientation, readPrintOrientation, printOrientationMatrix, orientedPrintDimensions, printOrientationCrc32, type PrintOrientation } from '@/workers/book-renderer/printOrientation'
import { samplePrintImage } from '@/workers/book-renderer/measurement'
import { encodePrintImage } from '@/workers/book-renderer/printAssets'
import { printReplayPolicy } from '@/workers/book-renderer/portion'

const values: PrintOrientation[] = [1, 2, 3, 4, 5, 6, 7, 8]
const checksum = (bytes: Buffer) => require('node:crypto').createHash('sha256').update(bytes).digest('hex') as string
it('matches the independent standard CRC32 check vector', () => {
  expect(printOrientationCrc32(Buffer.from('123456789'))).toBe(0xcbf43926)
})
it('keeps legacy raw1/2/3 replay on native analysis and preserves explicit4/5 policy dispatch', () => {
  expect([undefined, 1, 2, 3, 4, 5].map(version => printReplayPolicy(version as 1 | 2 | 3 | 4 | 5 | undefined))).toEqual([3, 3, 3, 3, 4, 5])
  expect(() => printReplayPolicy(6 as never)).toThrow('SEGMENT_SOURCE_SCHEMA_UNSUPPORTED')
})
function metadata(value: number, little: boolean, prefixTag = false): Buffer {
  const bytes = Buffer.alloc(prefixTag ? 38 : 26)
  bytes.write(little ? 'II' : 'MM')
  const short = (value: number, at: number) => little ? bytes.writeUInt16LE(value, at) : bytes.writeUInt16BE(value, at)
  const long = (value: number, at: number) => little ? bytes.writeUInt32LE(value, at) : bytes.writeUInt32BE(value, at)
  short(42, 2); long(8, 4); short(prefixTag ? 2 : 1, 8)
  if (prefixTag) { short(0x0100, 10); short(4, 12); long(1, 14); long(300, 18) }
  const at = prefixTag ? 22 : 10
  short(0x0112, at); short(3, at + 2); long(1, at + 4); short(value, at + 8)
  return bytes
}
function pngChunk(kind: string, data: Buffer): Buffer {
  const prefix = Buffer.alloc(8); prefix.writeUInt32BE(data.length); prefix.write(kind, 4)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(printOrientationCrc32(Buffer.concat([Buffer.from(kind), data])))
  return Buffer.concat([prefix, data, crc])
}
function container(format: string, exif?: Buffer, duplicate = false): Buffer {
  if (format === 'jpg') {
    const segment = (data: Buffer) => { const header = Buffer.from([255, 225, 0, 0]); header.writeUInt16BE(data.length + 2, 2); return Buffer.concat([header, data]) }
    return Buffer.concat([Buffer.from([255, 216]), ...(exif ? [segment(Buffer.concat([Buffer.from('Exif\0\0'), exif])), ...(duplicate ? [segment(Buffer.concat([Buffer.from('Exif\0\0'), exif]))] : [])] : []), Buffer.from([255, 217])])
  }
  if (format === 'png') {
    const header = Buffer.alloc(13); header.writeUInt32BE(3); header.writeUInt32BE(2, 4); header[8] = 8; header[9] = 6
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(Buffer.alloc(26))),
      ...(exif ? [pngChunk('eXIf', exif), ...(duplicate ? [pngChunk('eXIf', exif)] : [])] : []), pngChunk('IEND', Buffer.alloc(0))])
  }
  const chunk = (kind: string, data: Buffer) => { const prefix = Buffer.alloc(8); prefix.write(kind); prefix.writeUInt32LE(data.length, 4); return Buffer.concat([prefix, data, ...(data.length & 1 ? [Buffer.alloc(1)] : [])]) }
  const flags = Buffer.alloc(10); flags[0] = exif ? 8 : 0; flags.writeUIntLE(2, 4, 3); flags.writeUIntLE(1, 7, 3)
  const body = Buffer.concat([Buffer.from('WEBP'), chunk('VP8X', flags), chunk('VP8 ', Buffer.from([1, 2, 3])), ...(exif ? [chunk('EXIF', exif), ...(duplicate ? [chunk('EXIF', exif)] : [])] : [])])
  const header = Buffer.alloc(8); header.write('RIFF'); header.writeUInt32LE(body.length, 4)
  return Buffer.concat([header, body])
}

describe.each(['jpg', 'png', 'webp'])('%s bounded orientation carrier (metadata protocol, no decoder claim)', format => {
  it.each(values.flatMap(value => [false, true].map(little => [value, little] as const)))('normalizes EXIF%s endian little=%s once without changing the original or raster bytes', (orientation, little) => {
    const bytes = container(format, metadata(orientation, little, true)), original = Buffer.from(bytes)
    const normalized = normalizePrintOrientation(bytes, bytes.length)
    expect(normalized.orientation).toBe(orientation)
    expect(normalized.checksum).toBe(checksum(normalized.carrier))
    expect(bytes).toEqual(original)
    expect(readPrintOrientation(normalized.carrier)).toBe(1)
    expect(normalized.carrier).toEqual(container(format, metadata(1, little, true)))
    expect(normalized.working_bytes).toBe(orientation === 1 ? 0 : bytes.length)
    if (orientation === 1) expect(normalized.carrier).toBe(bytes)
  })
  it('accepts a missing orientation only after valid complete metadata inspection', () => {
    const absent = container(format)
    expect(normalizePrintOrientation(absent, absent.length).orientation).toBe(1)
    const noTag = metadata(2, false); noTag.writeUInt16BE(0x0100, 10)
    expect(readPrintOrientation(container(format, noTag))).toBe(1)
  })
  it('rejects duplicate EXIF chunks and duplicate orientation tags even when equal', () => {
    expect(() => readPrintOrientation(container(format, metadata(6, false), true))).toThrow('PRINT_IMAGE_ORIENTATION_METADATA_INVALID')
    const duplicate = metadata(6, false, true); duplicate.writeUInt16BE(0x0112, 10); duplicate.writeUInt16BE(3, 12); duplicate.writeUInt16BE(6, 18)
    expect(() => readPrintOrientation(container(format, duplicate))).toThrow('PRINT_IMAGE_ORIENTATION_METADATA_INVALID')
  })
  it.each(['endian', 'magic', 'offset', 'type', 'count', 'zero', 'nine', 'table'])('rejects malformed TIFF %s', defect => {
    const bytes = metadata(6, false)
    if (defect === 'endian') bytes.write('ZZ')
    if (defect === 'magic') bytes.writeUInt16BE(43, 2)
    if (defect === 'offset') bytes.writeUInt32BE(0xffffffff, 4)
    if (defect === 'type') bytes.writeUInt16BE(4, 12)
    if (defect === 'count') bytes.writeUInt32BE(2, 14)
    if (defect === 'zero') bytes.writeUInt16BE(0, 18)
    if (defect === 'nine') bytes.writeUInt16BE(9, 18)
    if (defect === 'table') bytes.writeUInt16BE(65535, 8)
    expect(() => readPrintOrientation(container(format, bytes))).toThrow('PRINT_IMAGE_ORIENTATION_METADATA_INVALID')
  })
})

it('supports optional WebP Exif prefix and late metadata without a first64KiB truncation', () => {
  const bytes = container('webp', Buffer.concat([Buffer.from('Exif\0\0'), metadata(6, true)]))
  expect(readPrintOrientation(bytes)).toBe(6)
  const png = container('png', metadata(7, false))
  const filler = pngChunk('tEXt', Buffer.alloc(70_000, 65))
  const late = Buffer.concat([png.subarray(0, 33), filler, png.subarray(33)])
  expect(readPrintOrientation(late)).toBe(7)
})

it('rejects EXIF metadata beyond64KiB, conflicting RIFF flags/extents/padding, invalid PNG CRC and animation', () => {
  expect(() => readPrintOrientation(container('webp', Buffer.concat([metadata(6, false), Buffer.alloc(65_536)])))).toThrow('PRINT_IMAGE_ORIENTATION_METADATA_BUDGET_EXCEEDED')
  const bytes = container('webp', metadata(6, false))
  const noFlag = Buffer.from(bytes); noFlag[20] = 0
  expect(() => readPrintOrientation(noFlag)).toThrow('PRINT_IMAGE_ORIENTATION_METADATA_INVALID')
  const missing = container('webp'); missing[20] = 8
  expect(() => readPrintOrientation(missing)).toThrow('PRINT_IMAGE_ORIENTATION_METADATA_INVALID')
  for (const mutation of [(value: Buffer) => value.writeUInt32LE(1, 4), (value: Buffer) => value.writeUInt32LE(0xffffffff, 34), (value: Buffer) => { value[41] = 1 }]) {
    const broken = Buffer.from(bytes); mutation(broken)
    expect(() => readPrintOrientation(broken)).toThrow('PRINT_IMAGE_ORIENTATION_METADATA_INVALID')
  }
  const png = container('png', metadata(6, false)); png[png.length - 13] ^= 1
  expect(() => readPrintOrientation(png)).toThrow('PRINT_IMAGE_ORIENTATION_METADATA_INVALID')
  const animated = Buffer.from(bytes); animated[20] |= 2
  expect(() => readPrintOrientation(animated)).toThrow('PRINT_IMAGE_ANIMATION_UNSUPPORTED')
  expect(() => readPrintOrientation(bytes.subarray(0, bytes.length - 1))).toThrow('PRINT_IMAGE_ORIENTATION_METADATA_INVALID')
  expect(() => normalizePrintOrientation(bytes, bytes.length - 1)).toThrow('SNAPSHOT_IMAGE_ENCODED_BUDGET_EXCEEDED')
})

it.each([false, true])('maps every original corner and off-center alpha coordinate for all8 orientations, square=%s', square => {
  const width = 6, height = square ? 6 : 4
  const expected = [[1, 2], [5, 2], [5, height - 2], [1, height - 2], [2, 1], [height - 2, 1], [height - 2, 5], [2, 5]]
  for (const orientation of values) {
    const [a, b, c, d, e, f] = printOrientationMatrix(orientation, width, height)
    expect([a + c * 2 + e, b + d * 2 + f]).toEqual(expected[orientation - 1])
    const size = orientedPrintDimensions(width, height, orientation)
    const corners = [[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => [a * x + c * y + e, b * x + d * y + f])
    expect(corners.map(point => point.join(',')).sort()).toEqual([[0, 0], [size.width, 0], [0, size.height], [size.width, size.height]].map(point => point.join(',')).sort())
  }
})

it.each(values)('cover analysis and bounded encode use the same single orientation%s transform with exact raw decoder dimensions (mocked DOM)', async orientation => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document'), originalReader = Object.getOwnPropertyDescriptor(globalThis, 'FileReader')
  const transforms: number[][] = [], draws: number[][] = []
  const pixels = new Uint8ClampedArray(64 * 64 * 4); pixels.fill(255)
  const ctx = { filter: 'none', setTransform: (...matrix: number[]) => { transforms.push(matrix) }, drawImage: (_image: unknown, ...coordinates: number[]) => { draws.push(coordinates) }, getImageData: () => ({ data: pixels }) }
  const canvas = { width: 0, height: 0, getContext: () => ctx,
    toBlob: (callback: (value: { type: string; size: number }) => void, mime: string) => callback({ type: mime, size: 3 }) }
  const image = { naturalWidth: 3, naturalHeight: 2 }
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { querySelector: () => image, createElement: () => canvas } })
  Object.defineProperty(globalThis, 'FileReader', { configurable: true, value: class { result = 'data:image/jpeg;base64,AQID'; onload?: () => void; readAsDataURL() { this.onload?.() } } })
  try {
    const result = samplePrintImage({ raw: { width: 3, height: 2 }, matrix: printOrientationMatrix(orientation, 64, 64) })
    expect(result.brightness).toBe(255)
    expect(transforms).toEqual([printOrientationMatrix(orientation, 64, 64)])
    expect(draws).toEqual([[0, 0, 64, 64]])
    expect(() => samplePrintImage({ raw: { width: 2, height: 3 }, matrix: printOrientationMatrix(orientation, 64, 64) })).toThrow('PRINT_IMAGE_DIMENSIONS_INVALID')
    transforms.length = 0; draws.length = 0
    const size = orientedPrintDimensions(3, 2, orientation)
    await encodePrintImage({ ...size, alphaPossible: false, quality: .92, maxBytes: 100, orientationTransform: { matrix: printOrientationMatrix(orientation, 3, 2), rawWidth: 3, rawHeight: 2 } })
    expect(transforms).toEqual([printOrientationMatrix(orientation, 3, 2), [1, 0, 0, 1, 0, 0]])
    expect(draws).toEqual([[0, 0, 3, 2]])
    expect(canvas.width).toBe(size.width); expect(canvas.height).toBe(size.height)
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument); else Reflect.deleteProperty(globalThis, 'document')
    if (originalReader) Object.defineProperty(globalThis, 'FileReader', originalReader); else Reflect.deleteProperty(globalThis, 'FileReader')
  }
})
