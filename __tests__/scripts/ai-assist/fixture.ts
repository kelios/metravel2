/**
 * Фикстурный индекс для тестов metravel-assist: 8-мерные детерминированные «эмбеддинги»
 * (как в embed.test.ts), три статьи и два квеста (один — на двух локалях).
 */
import { createHash } from 'crypto'

import { chunkId, type ChunkRecord, writeIndex } from '@/scripts/ai-index/format'
import { indexMaps, type LoadedIndex } from '@/scripts/ai-assist/index'
import { readIndex } from '@/scripts/ai-index/format'

import { makeTempDir } from '../cli-test-utils'

export const DIM = 8
export const MODEL = 'fake-model'

export function fakeVector(text: string): Float32Array {
  const vector = new Float32Array(DIM)
  for (const word of text.toLowerCase().split(/\s+/)) {
    const digest = createHash('sha256').update(word).digest()
    for (let i = 0; i < DIM; i += 1) vector[i] += digest[i] / 255 - 0.5
  }
  const norm = Math.hypot(...vector) || 1
  return vector.map((v) => v / norm)
}

interface Spec {
  type: ChunkRecord['type']
  sourceId: number
  locale?: string
  title: string
  text: string
  city?: string | null
}

export const FIXTURE_CHUNKS: Spec[] = [
  { type: 'travel', sourceId: 816, title: 'Ярмарки Польши', text: 'рождественские ярмарки краков вроцлав гданьск', city: 'Краков' },
  { type: 'travel', sourceId: 816, title: 'Ярмарки Польши', text: 'глинтвейн пряники краков рынок зима', city: 'Краков' },
  { type: 'travel', sourceId: 761, title: 'Ойцувский парк', text: 'замки скалы пещеры ойцув краков однодневная вылазка', city: 'Ойцув' },
  { type: 'travel', sourceId: 791, title: 'Беловежская пуща', text: 'зубры лес велосипед беловежская пуща дети', city: 'Каменюки' },
  { type: 'quest', sourceId: 1, locale: 'ru', title: 'Квест по Гродно', text: 'квест гродно замок фарный костёл задание', city: 'Гродно' },
  { type: 'quest', sourceId: 1, locale: 'pl', title: 'Quest po Grodnie', text: 'квест гродно замок фарный костёл задание pl', city: 'Grodno' },
  { type: 'quest', sourceId: 2, locale: 'ru', title: 'Квест по Бресту', text: 'квест брест крепость задание дети', city: 'Брест' },
]

export function fixtureChunks(): ChunkRecord[] {
  return FIXTURE_CHUNKS.map((spec) => {
    const locale = spec.locale ?? 'ru'
    return {
      id: chunkId(spec.type, spec.sourceId, locale, spec.text),
      type: spec.type,
      source_id: spec.sourceId,
      url: `https://metravel.by/${spec.type === 'travel' ? 'travels' : 'quests'}/${spec.sourceId}${locale === 'ru' ? '' : `-${locale}`}`,
      title: spec.title,
      city: spec.city ?? null,
      country: 'Польша',
      lat: 50.06,
      lng: 19.94,
      month: [],
      tags: [],
      locale,
      text: spec.text,
    }
  })
}

export function writeFixtureIndex(model = MODEL): string {
  const distDir = makeTempDir('ai-assist-')
  const chunks = fixtureChunks()
  writeIndex(distDir, { model, dim: DIM, chunks, vectors: chunks.map((chunk) => fakeVector(chunk.text)), builtAt: '2026-10-18T16:48:48.951Z' })
  return distDir
}

export function loadFixtureIndex(distDir = writeFixtureIndex()): LoadedIndex {
  const artifact = readIndex(distDir)
  if (!artifact) throw new Error(`fixture index missing at ${distDir}`)
  return { artifact, ...indexMaps(artifact) }
}

export const fakeEmbedQuery = async (q: string): Promise<Float32Array> => fakeVector(q)
