/**
 * Контракт артефакта смыслового индекса сайта (#2454).
 *
 * Артефакт — три файла в одной директории:
 *   chunks.jsonl   — по одной записи ChunkRecord на строку, порядок = порядок векторов;
 *   vectors.f16    — N × dim чисел IEEE 754 binary16, little-endian, без заголовка;
 *   manifest.json  — IndexManifest: модель, размерность, число записей, время сборки,
 *                    sha256 источника (детерминизм: те же chunks → тот же sha).
 *
 * Формат читают сервис metravel-assist (#2456) и MCP metravel-knowledge (#2455);
 * менять поля только с версией в manifest.model/dim и правкой этого файла.
 */
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export type ChunkType = 'travel' | 'quest'

export interface ChunkRecord {
  /** Стабильный id: `${t|q}${source_id}-${locale}-${sha256(text)[0:16]}`. */
  id: string
  type: ChunkType
  source_id: number
  /** Абсолютный URL страницы-источника на metravel.by. */
  url: string
  title: string
  city: string | null
  country: string | null
  lat: number | null
  lng: number | null
  /** Месяцы поездки (1–12) для статей; для квестов пусто. */
  month: number[]
  tags: string[]
  /** Язык текста фрагмента: ru для статей, content_locale квеста. */
  locale: string
  text: string
}

export interface IndexManifest {
  model: string
  dim: number
  count: number
  built_at: string
  source_sha256: string
}

export interface IndexArtifact {
  manifest: IndexManifest
  chunks: ChunkRecord[]
  /** Плоский массив count × dim, нормализованные (L2) векторы. */
  vectors: Float32Array
}

export const CHUNKS_FILE = 'chunks.jsonl'
export const VECTORS_FILE = 'vectors.f16'
export const MANIFEST_FILE = 'manifest.json'

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex')
}

export function chunkId(type: ChunkType, sourceId: number, locale: string, text: string): string {
  return `${type === 'travel' ? 't' : 'q'}${sourceId}-${locale}-${sha256Hex(text).slice(0, 16)}`
}

/** Детерминированный отпечаток источника: зависит только от содержимого и порядка записей. */
export function sourceSha256(chunks: ChunkRecord[]): string {
  const hash = createHash('sha256')
  for (const chunk of chunks) {
    hash.update(JSON.stringify(chunk))
    hash.update('\n')
  }
  return hash.digest('hex')
}

const f32 = new Float32Array(1)
const u32 = new Uint32Array(f32.buffer)

/** float32 → биты binary16, округление к ближайшему чётному. */
export function float32ToFloat16Bits(value: number): number {
  f32[0] = value
  const x = u32[0]
  const sign = (x >>> 16) & 0x8000
  const exp = (x >>> 23) & 0xff
  const mant = x & 0x7fffff
  if (exp === 0xff) return sign | 0x7c00 | (mant ? 0x200 : 0)
  const e = exp - 127 + 15
  if (e >= 0x1f) return sign | 0x7c00
  if (e <= 0) {
    if (e < -10) return sign
    const m = mant | 0x800000
    const shift = 14 - e
    let half = m >> shift
    const rem = m & ((1 << shift) - 1)
    const halfway = 1 << (shift - 1)
    if (rem > halfway || (rem === halfway && (half & 1))) half += 1
    return sign | half
  }
  let half = (e << 10) | (mant >> 13)
  const rem = mant & 0x1fff
  if (rem > 0x1000 || (rem === 0x1000 && (half & 1))) half += 1
  return sign | half
}

export function float16BitsToFloat32(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1
  const exp = (bits >> 10) & 0x1f
  const mant = bits & 0x3ff
  if (exp === 0) return sign * mant * 2 ** -24
  if (exp === 0x1f) return mant ? Number.NaN : sign * Number.POSITIVE_INFINITY
  return sign * (1 + mant / 1024) * 2 ** (exp - 15)
}

export function encodeVectors(vectors: ArrayLike<number>[], dim: number): Buffer {
  const buffer = Buffer.alloc(vectors.length * dim * 2)
  let offset = 0
  for (const vector of vectors) {
    if (vector.length !== dim) {
      throw new Error(`vector length ${vector.length} does not match dim ${dim}`)
    }
    for (let i = 0; i < dim; i += 1) {
      buffer.writeUInt16LE(float32ToFloat16Bits(vector[i]), offset)
      offset += 2
    }
  }
  return buffer
}

export function decodeVectors(buffer: Buffer, dim: number): Float32Array {
  if (dim <= 0 || buffer.length % (dim * 2) !== 0) {
    throw new Error(`vectors buffer of ${buffer.length} bytes is not a multiple of dim ${dim} × 2`)
  }
  const total = buffer.length / 2
  const out = new Float32Array(total)
  for (let i = 0; i < total; i += 1) {
    out[i] = float16BitsToFloat32(buffer.readUInt16LE(i * 2))
  }
  return out
}

export function readJsonl<T>(file: string): T[] {
  if (!fs.existsSync(file)) return []
  const rows: T[] = []
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (trimmed) rows.push(JSON.parse(trimmed) as T)
  }
  return rows
}

function toJsonl(rows: unknown[]): string {
  return rows.map((row) => `${JSON.stringify(row)}\n`).join('')
}

export function writeJsonl(file: string, rows: unknown[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, toJsonl(rows))
}

export function readIndex(distDir: string): IndexArtifact | null {
  const manifestFile = path.join(distDir, MANIFEST_FILE)
  const chunksFile = path.join(distDir, CHUNKS_FILE)
  const vectorsFile = path.join(distDir, VECTORS_FILE)
  if (!fs.existsSync(manifestFile) || !fs.existsSync(chunksFile) || !fs.existsSync(vectorsFile)) {
    return null
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as IndexManifest
  const chunks = readJsonl<ChunkRecord>(chunksFile)
  const vectors = decodeVectors(fs.readFileSync(vectorsFile), manifest.dim)
  if (chunks.length !== manifest.count || vectors.length !== manifest.count * manifest.dim) {
    throw new Error(
      `index at ${distDir} is inconsistent: manifest.count=${manifest.count}, chunks=${chunks.length}, vectors=${vectors.length / manifest.dim}`,
    )
  }
  // Файлы заменяются по одному (tmp + rename), поэтому читатель, попавший между rename,
  // может получить chunks от одной сборки и manifest от другой: sha это ловит.
  const sha = sourceSha256(chunks)
  if (sha !== manifest.source_sha256) {
    throw new Error(`index at ${distDir} is inconsistent: source_sha256 ${sha} ≠ manifest ${manifest.source_sha256}`)
  }
  return { manifest, chunks, vectors }
}

export function writeIndex(
  distDir: string,
  input: { model: string; dim: number; chunks: ChunkRecord[]; vectors: ArrayLike<number>[]; builtAt?: string },
): IndexManifest {
  if (input.vectors.length !== input.chunks.length) {
    throw new Error(`chunks (${input.chunks.length}) and vectors (${input.vectors.length}) differ in length`)
  }
  fs.mkdirSync(distDir, { recursive: true })
  const manifest: IndexManifest = {
    model: input.model,
    dim: input.dim,
    count: input.chunks.length,
    built_at: input.builtAt ?? new Date().toISOString(),
    source_sha256: sourceSha256(input.chunks),
  }
  const tmpSuffix = `.tmp-${process.pid}`
  const targets: Array<[string, Buffer | string]> = [
    [path.join(distDir, VECTORS_FILE), encodeVectors(input.vectors, input.dim)],
    [path.join(distDir, CHUNKS_FILE), toJsonl(input.chunks)],
    [path.join(distDir, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`],
  ]
  for (const [file, body] of targets) fs.writeFileSync(file + tmpSuffix, body)
  for (const [file] of targets) fs.renameSync(file + tmpSuffix, file)
  return manifest
}

/** Проверка артефакта по правилам карточки: count = строки chunks.jsonl = size(vectors.f16) / (dim × 2). */
export function verifyIndex(distDir: string): { ok: boolean; problems: string[]; manifest: IndexManifest | null } {
  const problems: string[] = []
  const manifestFile = path.join(distDir, MANIFEST_FILE)
  if (!fs.existsSync(manifestFile)) return { ok: false, problems: [`нет ${manifestFile}`], manifest: null }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as IndexManifest
  const chunks = readJsonl<ChunkRecord>(path.join(distDir, CHUNKS_FILE))
  const vectorsFile = path.join(distDir, VECTORS_FILE)
  const vectorBytes = fs.existsSync(vectorsFile) ? fs.statSync(vectorsFile).size : -1
  if (chunks.length !== manifest.count) problems.push(`chunks.jsonl: ${chunks.length} строк, manifest.count=${manifest.count}`)
  if (vectorBytes !== manifest.count * manifest.dim * 2) {
    problems.push(`vectors.f16: ${vectorBytes} байт, ожидалось ${manifest.count * manifest.dim * 2}`)
  }
  const sha = sourceSha256(chunks)
  if (sha !== manifest.source_sha256) problems.push(`source_sha256 не совпадает: ${sha} ≠ ${manifest.source_sha256}`)
  return { ok: problems.length === 0, problems, manifest }
}
