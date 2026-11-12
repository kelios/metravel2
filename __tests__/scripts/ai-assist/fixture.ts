/**
 * Фикстурный индекс для тестов metravel-assist: 8-мерные детерминированные «эмбеддинги»
 * (как в embed.test.ts), три статьи и два квеста (один — на двух локалях).
 */
import { createHash } from 'crypto'

import { chunkId, type ChunkRecord, type SourceFacts, writeIndex } from '@/scripts/ai-index/format'
import { join } from 'path'

import { indexMaps, type LoadedIndex, openChunkText } from '@/scripts/ai-assist/index'
import { CHUNKS_FILE, readIndex } from '@/scripts/ai-index/format'

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

export interface Spec {
  type: ChunkRecord['type']
  sourceId: number
  locale?: string
  title: string
  text: string
  city?: string | null
  /** Страна источника; без неё — Польша, как у всех (#3289: отбор по месту вопроса). */
  country?: string
  /** Теги каталога (у квеста — `kids`, `age-8-10`…, #3276); без них — пусто. */
  tags?: string[]
  /** Координаты источника (#2911, /ai/near-route); без них — Краков, как у всех. */
  lat?: number | null
  lng?: number | null
  /** Справка о сайте (#3293): утверждённый ответ записи и страница сайта, к которой он относится. */
  answer?: string
  page?: string
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

export function fixtureChunks(specs: Spec[] = FIXTURE_CHUNKS): ChunkRecord[] {
  return specs.map((spec) => {
    const locale = spec.locale ?? 'ru'
    return {
      id: chunkId(spec.type, spec.sourceId, locale, spec.text),
      type: spec.type,
      source_id: spec.sourceId,
      url: spec.type === 'help' ? `https://metravel.by${spec.page ?? '/about'}` : `https://metravel.by/${spec.type === 'travel' ? 'travels' : 'quests'}/${spec.sourceId}${locale === 'ru' ? '' : `-${locale}`}`,
      title: spec.title,
      city: spec.city ?? null,
      country: spec.country ?? 'Польша',
      lat: spec.lat === undefined ? 50.06 : spec.lat,
      lng: spec.lng === undefined ? 19.94 : spec.lng,
      month: [],
      tags: spec.tags ?? [],
      locale,
      text: spec.text,
      ...(spec.answer ? { answer: spec.answer } : {}),
    }
  })
}

/** `facts` — записи `facts.jsonl` (#3287); без них артефакт собирается с пустым списком фактов. */
export function writeFixtureIndex(model = MODEL, specs: Spec[] = FIXTURE_CHUNKS, facts: SourceFacts[] = []): string {
  const distDir = makeTempDir('ai-assist-')
  const chunks = fixtureChunks(specs)
  writeIndex(distDir, { model, dim: DIM, chunks, vectors: chunks.map((chunk) => fakeVector(chunk.text)), facts, builtAt: '2026-10-18T16:48:48.951Z' })
  return distDir
}

export function loadFixtureIndex(distDir = writeFixtureIndex()): LoadedIndex {
  const artifact = readIndex(distDir)
  if (!artifact) throw new Error(`fixture index missing at ${distDir}`)
  // Полный текст строки с диска — как у `loadIndex` службы: сниппет в памяти короче фрагмента.
  const readText = openChunkText(join(distDir, CHUNKS_FILE), artifact.chunks)
  return { artifact, ...indexMaps(artifact), readText }
}

export const fakeEmbedQuery = async (q: string): Promise<Float32Array> => fakeVector(q)
