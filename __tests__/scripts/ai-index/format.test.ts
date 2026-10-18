import fs from 'fs'
import path from 'path'

import {
  CHUNKS_FILE,
  MANIFEST_FILE,
  VECTORS_FILE,
  chunkId,
  decodeVectors,
  encodeVectors,
  float16BitsToFloat32,
  float32ToFloat16Bits,
  readIndex,
  sourceSha256,
  verifyIndex,
  writeIndex,
  type ChunkRecord,
} from '@/scripts/ai-index/format'

import { makeTempDir } from '../cli-test-utils'

const makeChunk = (i: number, text = `фрагмент ${i}`): ChunkRecord => ({
  id: chunkId('travel', 100 + i, 'ru', text),
  type: 'travel',
  source_id: 100 + i,
  url: `https://metravel.by/travels/t${i}`,
  title: `Статья ${i}`,
  city: null,
  country: 'Беларусь',
  lat: null,
  lng: null,
  month: [],
  tags: [],
  locale: 'ru',
  text,
})

describe('ai-index format: float16', () => {
  it('известные значения кодируются в стандартные биты', () => {
    expect(float32ToFloat16Bits(0)).toBe(0x0000)
    expect(float32ToFloat16Bits(1)).toBe(0x3c00)
    expect(float32ToFloat16Bits(-2)).toBe(0xc000)
    expect(float32ToFloat16Bits(65504)).toBe(0x7bff)
    expect(float32ToFloat16Bits(1e6)).toBe(0x7c00)
    expect(float32ToFloat16Bits(2 ** -24)).toBe(0x0001)
    expect(float16BitsToFloat32(0x3c00)).toBe(1)
    expect(float16BitsToFloat32(0xc000)).toBe(-2)
    expect(float16BitsToFloat32(0x0001)).toBe(2 ** -24)
    expect(float16BitsToFloat32(0x7c00)).toBe(Number.POSITIVE_INFINITY)
  })

  it('запись → чтение возвращает те же числа с точностью binary16 и little-endian порядком', () => {
    const values = [0, 1, -1, 0.1, -0.33, 0.000123, 123.456, -0.5, 0.75, 2 ** -20]
    const buffer = encodeVectors([values], values.length)
    expect(buffer.length).toBe(values.length * 2)
    expect([buffer[2], buffer[3]]).toEqual([0x00, 0x3c])
    const decoded = decodeVectors(buffer, values.length)
    expect(decoded.length).toBe(values.length)
    values.forEach((value, i) => {
      const tolerance = Math.max(Math.abs(value) * 2 ** -10, 2 ** -24)
      expect(Math.abs(decoded[i] - value)).toBeLessThanOrEqual(tolerance)
    })
  })

  it('несогласованная размерность — ошибка', () => {
    expect(() => encodeVectors([[1, 2, 3]], 2)).toThrow(/dim/)
    expect(() => decodeVectors(Buffer.alloc(6), 2)).toThrow(/multiple/)
  })
})

describe('ai-index format: артефакт', () => {
  let dir: string
  beforeEach(() => {
    dir = makeTempDir('ai-index-format-')
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('writeIndex → readIndex даёт те же записи и векторы, manifest согласован', () => {
    const chunks = [makeChunk(1), makeChunk(2), makeChunk(3)]
    const vectors = chunks.map((_, i) => Float32Array.from([0.5 * i, -0.25, 0.125, 1]))
    const manifest = writeIndex(dir, { model: 'test-model', dim: 4, chunks, vectors, builtAt: '2026-10-18T00:00:00.000Z' })
    expect(manifest).toEqual({
      model: 'test-model',
      dim: 4,
      count: 3,
      built_at: '2026-10-18T00:00:00.000Z',
      source_sha256: sourceSha256(chunks),
    })
    expect(fs.statSync(path.join(dir, VECTORS_FILE)).size).toBe(3 * 4 * 2)
    expect(fs.readFileSync(path.join(dir, CHUNKS_FILE), 'utf8').trim().split('\n')).toHaveLength(3)
    expect(JSON.parse(fs.readFileSync(path.join(dir, MANIFEST_FILE), 'utf8'))).toEqual(manifest)

    const artifact = readIndex(dir)
    expect(artifact?.chunks).toEqual(chunks)
    expect(Array.from(artifact!.vectors)).toEqual([0, -0.25, 0.125, 1, 0.5, -0.25, 0.125, 1, 1, -0.25, 0.125, 1])
    expect(verifyIndex(dir)).toEqual({ ok: true, problems: [], manifest })
  })

  it('source_sha256 детерминирован и меняется при изменении содержимого', () => {
    const a = [makeChunk(1), makeChunk(2)]
    const b = [makeChunk(1), makeChunk(2)]
    expect(sourceSha256(a)).toBe(sourceSha256(b))
    expect(sourceSha256([makeChunk(1), makeChunk(2, 'другой текст')])).not.toBe(sourceSha256(a))
    expect(sourceSha256([makeChunk(2), makeChunk(1)])).not.toBe(sourceSha256(a))
  })

  it('verifyIndex ловит расхождение count/vectors/sha, readIndex — отсутствие файлов', () => {
    expect(readIndex(dir)).toBeNull()
    writeIndex(dir, { model: 'm', dim: 2, chunks: [makeChunk(1)], vectors: [[1, 0]] })
    fs.appendFileSync(path.join(dir, CHUNKS_FILE), `${JSON.stringify(makeChunk(9))}\n`)
    const result = verifyIndex(dir)
    expect(result.ok).toBe(false)
    expect(result.problems.join('\n')).toMatch(/chunks\.jsonl/)
    expect(result.problems.join('\n')).toMatch(/source_sha256/)
    expect(() => readIndex(dir)).toThrow(/inconsistent/)
  })

  it('readIndex отбрасывает набор, где chunks.jsonl и manifest от разных сборок', () => {
    const chunks = [makeChunk(1), makeChunk(2)]
    writeIndex(dir, { model: 'm', dim: 2, chunks, vectors: [[1, 0], [0, 1]] })
    const swapped = [makeChunk(1), makeChunk(2, 'другой текст той же длины')]
    fs.writeFileSync(path.join(dir, CHUNKS_FILE), `${swapped.map((row) => JSON.stringify(row)).join('\n')}\n`)
    expect(() => readIndex(dir)).toThrow(/source_sha256/)
  })

  it('chunkId зависит от типа, источника, локали и текста', () => {
    const base = chunkId('quest', 7, 'pl', 'tekst')
    expect(base).toMatch(/^q7-pl-[0-9a-f]{16}$/)
    expect(chunkId('quest', 7, 'pl', 'tekst')).toBe(base)
    expect(chunkId('quest', 7, 'ru', 'tekst')).not.toBe(base)
    expect(chunkId('quest', 7, 'pl', 'inny tekst')).not.toBe(base)
  })
})
