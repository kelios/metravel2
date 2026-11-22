/**
 * Внешний индекс пеших маршрутов мира для службы (#3357): второй ярус ответа `/ai/ask`, блок «Ещё в мире».
 *
 * Артефакт собирает `scripts/ai-index/world/build.ts` и кладёт отдельным каталогом (`AI_WORLD_INDEX_DIR`),
 * с индексом сайта он не смешивается: слой OpenStreetMap (ODbL), слой Wikidata (CC0), фрагменты смыслового
 * поиска и их векторы. При старте проверяются отпечатки слоёв, лицензии источников в манифесте и модель
 * векторов — она обязана совпадать с моделью запросов службы. Без переменной служба работает без блока.
 */
import fs from 'node:fs'
import path from 'node:path'

import { parseConditions } from '../../api/aiAssist/questionConditions.ts'
import { asksForWorldTrails, borrowedPlaceWords, gazetteerPlace, namesTrail, ownPlaceNames, titleKeys, type WorldCandidate, type WorldPlace } from './worldTrails.ts'
import { decodeVectors, readJsonl } from '../ai-index/format.ts'
import {
  OPEN_LAYER_FILE,
  type OpenLayerRecord,
  OSM_LAYER_FILE,
  type OsmLayerRecord,
  toTrailCard,
  verifyWorldIndex,
  WORLD_CHUNKS_FILE,
  WORLD_MANIFEST_FILE,
  WORLD_VECTORS_FILE,
  type WorldChunk,
  type WorldManifest,
} from '../ai-index/world/cards.ts'
import type { Locale } from './search.ts'

export interface WorldTrailEntry {
  osm: OsmLayerRecord
  open: OpenLayerRecord
  /** Строки векторов фрагментов маршрута. */
  rows: number[]
  /** Место маршрута для газеттира: слова названий мест ниже страны и стран на всех языках индекса, коды стран по общей таблице. */
  place: WorldPlace
  /** Ключи названий и псевдонимов: по ним вопрос называет сам маршрут. */
  titles: string[]
}

export interface WorldIndex {
  manifest: WorldManifest
  trails: WorldTrailEntry[]
  /** Плоский массив `chunks × dim`, нормализованные векторы. */
  vectors: Float32Array
  dim: number
}

export interface LoadWorldIndexOptions {
  /** Ключ модели запросов службы: векторы внешнего индекса обязаны быть посчитаны ею же. */
  expectedModel: string
}

const placeOf = (open: OpenLayerRecord, borrowed: ReadonlyMap<string, ReadonlySet<string>>): WorldPlace =>
  gazetteerPlace(
    (open.places ?? []).flatMap((place) => ownPlaceNames(place, borrowed)),
    open.countries.flatMap((country) => Object.values(country.names)),
  )

const titlesOf = (open: OpenLayerRecord): string[] => titleKeys([...Object.values(open.labels), open.native_title, ...Object.values(open.aliases).flat()])

export function loadWorldIndex(distDir: string, options: LoadWorldIndexOptions): WorldIndex {
  const manifestFile = path.join(distDir, WORLD_MANIFEST_FILE)
  if (!fs.existsSync(manifestFile)) throw new Error(`нет внешнего индекса маршрутов в ${distDir}: ожидался ${WORLD_MANIFEST_FILE} (сборка — npm run ai:index:world -- build)`)
  const problems = verifyWorldIndex(distDir)
  if (problems.length) throw new Error(`внешний индекс маршрутов в ${distDir} не прошёл проверку: ${problems.join('; ')}`)
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as WorldManifest
  if (!manifest.model || !manifest.dim) throw new Error(`внешний индекс маршрутов в ${distDir} без векторов: выполните npm run ai:index:world -- embed`)
  if (manifest.model !== options.expectedModel) {
    throw new Error(
      `внешний индекс маршрутов собран моделью "${manifest.model}", служба считает запросы моделью "${options.expectedModel}": ` +
        `пересчитайте векторы (npm run ai:index:world -- embed --model ${options.expectedModel})`,
    )
  }
  const osm = readJsonl<OsmLayerRecord>(path.join(distDir, OSM_LAYER_FILE))
  const open = new Map(readJsonl<OpenLayerRecord>(path.join(distDir, OPEN_LAYER_FILE)).map((record) => [record.source_id, record]))
  const chunks = readJsonl<WorldChunk>(path.join(distDir, WORLD_CHUNKS_FILE))
  const vectors = decodeVectors(fs.readFileSync(path.join(distDir, WORLD_VECTORS_FILE)), manifest.dim)
  const rows = new Map<string, number[]>()
  chunks.forEach((chunk, row) => {
    const list = rows.get(chunk.source_id)
    if (list) list.push(row)
    else rows.set(chunk.source_id, [row])
  })
  // Слово чужого места в названии («Альпы» у региона «Прованс — Альпы — Лазурный Берег») — по всему индексу сразу.
  const borrowed = borrowedPlaceWords([...open.values()].flatMap((record) => record.places ?? []))
  const trails = osm.flatMap((record): WorldTrailEntry[] => {
    const own = open.get(record.source_id)
    return own ? [{ osm: record, open: own, rows: rows.get(record.source_id) ?? [], place: placeOf(own, borrowed), titles: titlesOf(own) }] : []
  })
  return { manifest, trails, vectors, dim: manifest.dim }
}

/**
 * Кандидаты второго яруса: карточка каждого маршрута на языке вопроса и близость вопроса к лучшему из
 * фрагментов маршрута. Вектор — тот же, что посчитан для подбора по сайту: новой работы модели нет.
 */
export function worldCandidates(index: WorldIndex, vector: ArrayLike<number>, locale: Locale): WorldCandidate[] {
  const { vectors, dim } = index
  const out: WorldCandidate[] = []
  for (const trail of index.trails) {
    const card = toTrailCard(trail.osm, trail.open, locale)
    if (!card) continue
    let similarity = 0
    for (const row of trail.rows) {
      let dot = 0
      const offset = row * dim
      for (let i = 0; i < dim; i += 1) dot += vectors[offset + i] * vector[i]
      if (dot > similarity) similarity = dot
    }
    out.push({ card, similarity, fame: trail.open.sitelinks, place: trail.place, titles: trail.titles })
  }
  return out
}

/**
 * Вопросу нужен второй ярус: он о пешем маршруте либо дословно называет маршрут индекса («West Highland
 * Way»). Проверка дешёвая — без векторов и карточек; кандидаты служба собирает только после неё.
 */
export const asksWorld = (index: WorldIndex, query: string): boolean => asksForWorldTrails(parseConditions(query)) || index.trails.some((trail) => namesTrail(query, trail.titles))
