import fs from 'fs'
import path from 'path'

import {
  CHUNKS_FILE,
  FACTS_FILE,
  INDEX_FORMAT_VERSION,
  MANIFEST_FILE,
  VECTORS_FILE,
  chunkId,
  decodeVectors,
  encodeVectors,
  factsSha256,
  float16BitsToFloat32,
  float32ToFloat16Bits,
  readIndex,
  sourceSha256,
  verifyIndex,
  writeFacts,
  writeIndex,
  type ChunkRecord,
  type SourceFacts,
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
      sources: { travel: 3, quest: 0 },
      // #3287: версия формата и отпечаток записей фактов; без фактов файл пуст.
      format_version: INDEX_FORMAT_VERSION,
      facts: { count: 0, sha256: factsSha256([]) },
    })
    expect(fs.readFileSync(path.join(dir, FACTS_FILE), 'utf8')).toBe('')
    expect(fs.statSync(path.join(dir, VECTORS_FILE)).size).toBe(3 * 4 * 2)
    expect(fs.readFileSync(path.join(dir, CHUNKS_FILE), 'utf8').trim().split('\n')).toHaveLength(3)
    expect(JSON.parse(fs.readFileSync(path.join(dir, MANIFEST_FILE), 'utf8'))).toEqual(manifest)

    const artifact = readIndex(dir)
    expect(artifact?.chunks).toEqual(chunks)
    expect(artifact?.facts).toEqual([])
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

  // #3287: факты источника — отдельный файл артефакта, одна строка на источник.
  const questChunk = (sourceId: number, locale: string, text: string): ChunkRecord => ({
    ...makeChunk(0, text),
    id: chunkId('quest', sourceId, locale, text),
    type: 'quest',
    source_id: sourceId,
    locale,
  })
  const FACTS: SourceFacts[] = [
    { type: 'quest', source_id: 7, points: 9, duration_min: 90, difficulty: 'easy', pet_friendly: true, audience: 'kids', age: [8, 10], adult: true },
    { type: 'travel', source_id: 101, number_days: 3, months: [11, 12], transports: ['Машина'] },
    // Источника 999 нет среди фрагментов: записи о нём в артефакте не будет.
    { type: 'travel', source_id: 999, number_days: 5 },
    // Повтор источника (квест на второй локали) — одна запись.
    { type: 'quest', source_id: 7, points: 1 },
  ]

  it('#3287: writeIndex пишет facts.jsonl — запись на источник индекса в порядке фрагментов, манифест несёт версию и отпечаток', () => {
    const chunks = [makeChunk(1), questChunk(7, 'ru', 'квест ru'), questChunk(7, 'pl', 'квест pl'), makeChunk(2)]
    const vectors = chunks.map(() => [1, 0])
    const manifest = writeIndex(dir, { model: 'm', dim: 2, chunks, vectors, facts: FACTS })
    const expected = [FACTS[1], FACTS[0]]
    expect(manifest.format_version).toBe(2)
    expect(manifest.facts).toEqual({ count: 2, sha256: factsSha256(expected) })
    expect(fs.readFileSync(path.join(dir, FACTS_FILE), 'utf8').trim().split('\n').map((line) => JSON.parse(line))).toEqual(expected)
    expect(readIndex(dir)?.facts).toEqual(expected)
    expect(verifyIndex(dir)).toEqual({ ok: true, problems: [], manifest })
  })

  it('#3287: артефакт версии 1 (манифест без format_version и facts, файла фактов нет) читается без фактов', () => {
    const chunks = [makeChunk(1), makeChunk(2)]
    writeIndex(dir, { model: 'm', dim: 2, chunks, vectors: [[1, 0], [0, 1]], facts: FACTS })
    const { format_version: _version, facts: _facts, ...legacy } = JSON.parse(fs.readFileSync(path.join(dir, MANIFEST_FILE), 'utf8'))
    fs.writeFileSync(path.join(dir, MANIFEST_FILE), JSON.stringify(legacy))
    fs.rmSync(path.join(dir, FACTS_FILE))
    const artifact = readIndex(dir)
    expect(artifact?.manifest.format_version).toBeUndefined()
    expect(artifact?.chunks).toEqual(chunks)
    expect(artifact?.facts).toEqual([])
    expect(verifyIndex(dir).ok).toBe(true)
  })

  it('#3287: facts.jsonl от другой сборки — несогласованный артефакт: readIndex отказывает, verifyIndex называет файл', () => {
    const chunks = [makeChunk(1), makeChunk(2)]
    writeIndex(dir, { model: 'm', dim: 2, chunks, vectors: [[1, 0], [0, 1]], facts: [{ type: 'travel', source_id: 101, number_days: 3 }] })
    fs.writeFileSync(path.join(dir, FACTS_FILE), `${JSON.stringify({ type: 'travel', source_id: 555, number_days: 1 })}\n`)
    expect(() => readIndex(dir)).toThrow(/inconsistent: facts\.jsonl/)
    const result = verifyIndex(dir)
    expect(result.ok).toBe(false)
    expect(result.problems.join('\n')).toMatch(/facts\.sha256/)
    expect(result.problems.join('\n')).toMatch(/которых нет в chunks\.jsonl/)
    fs.rmSync(path.join(dir, FACTS_FILE))
    expect(() => readIndex(dir)).toThrow(/facts\.jsonl/)
  })

  it('#3287: writeFacts переводит готовый артефакт на формат с фактами, не трогая фрагменты, векторы и время сборки', () => {
    const chunks = [makeChunk(1), questChunk(7, 'ru', 'квест ru')]
    const before = writeIndex(dir, { model: 'm', dim: 2, chunks, vectors: [[1, 0], [0, 1]], builtAt: '2026-10-18T00:00:00.000Z' })
    const vectorsBefore = fs.readFileSync(path.join(dir, VECTORS_FILE))
    const chunksBefore = fs.readFileSync(path.join(dir, CHUNKS_FILE), 'utf8')
    const after = writeFacts(dir, FACTS)
    expect(after).toEqual({ ...before, facts: { count: 2, sha256: factsSha256([FACTS[1], FACTS[0]]) } })
    expect(fs.readFileSync(path.join(dir, VECTORS_FILE)).equals(vectorsBefore)).toBe(true)
    expect(fs.readFileSync(path.join(dir, CHUNKS_FILE), 'utf8')).toBe(chunksBefore)
    expect(readIndex(dir)?.facts).toEqual([FACTS[1], FACTS[0]])
    expect(verifyIndex(dir).ok).toBe(true)
    // Файл фактов испорчен — та же команда его чинит.
    fs.writeFileSync(path.join(dir, FACTS_FILE), '{"type":"travel","source_id":999}\n')
    expect(() => readIndex(dir)).toThrow(/facts\.jsonl/)
    expect(readIndex(dir, { skipFacts: true })?.facts).toEqual([])
    writeFacts(dir, FACTS)
    expect(readIndex(dir)?.facts).toEqual([FACTS[1], FACTS[0]])
    const empty = makeTempDir('ai-index-format-empty-')
    expect(() => writeFacts(empty, FACTS)).toThrow(/нет артефакта/)
    fs.rmSync(empty, { recursive: true, force: true })
  })

  it('chunkId зависит от типа, источника, локали и текста', () => {
    const base = chunkId('quest', 7, 'pl', 'tekst')
    expect(base).toMatch(/^q7-pl-[0-9a-f]{16}$/)
    expect(chunkId('quest', 7, 'pl', 'tekst')).toBe(base)
    expect(chunkId('quest', 7, 'ru', 'tekst')).not.toBe(base)
    expect(chunkId('quest', 7, 'pl', 'inny tekst')).not.toBe(base)
  })
})
