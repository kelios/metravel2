/**
 * Карточки и артефакт внешнего индекса пеших маршрутов (#3357). Чистые функции и запись файлов.
 *
 * Артефакт — отдельный каталог, с индексом сайта не смешивается (решение I):
 *   trails-osm.jsonl       — слой полей, полученных из OpenStreetMap (ODbL): длина по геометрии, набор и
 *                            высоты вдоль неё, класс тропы, этапы, дни, ступень нагрузки, месяцы. Этот файл
 *                            выкладывается под ODbL как производная база (решение H);
 *   trails-wikidata.jsonl  — слой Wikidata (CC0): названия, псевдонимы, описание, страны, места ниже
 *                            страны, адреса статей, число вики-статей, длина P2043;
 *   chunks.jsonl           — тексты для смыслового поиска, собранные ТОЛЬКО из слоя Wikidata;
 *   vectors.f16            — векторы фрагментов той же моделью, что у индекса сайта (пишет `embed`);
 *   manifest.json          — состав, отпечатки слоёв, параметры расчёта и лицензия с атрибуцией каждого
 *                            источника.
 * Одно поле карточки берётся из одного слоя целиком: длина маршрута — только геометрия OSM; длина из
 * Wikidata лежит отдельным полем `wd_length_km` и в карточку не подставляется.
 */
import fs from 'node:fs'
import path from 'node:path'

import { type AiWorldTrail, type LoadStep, type SacScale, WORLD_CARD_TYPE, WORLD_GROUP } from '../../../api/aiAssist/trailFacts.ts'
import { sha256Hex, writeJsonl } from '../format.ts'
import type { AscentParams } from './elevation.ts'
import { EFFORT_THRESHOLDS } from './effort.ts'
import { writeJson } from './net.ts'
import { SEASON_ALTITUDE_QUANTILE, SEASON_PARAMS, type SeasonParams } from './season.ts'
import { CARD_LOCALES, type CardLocale, type TrailPlace } from './wikidata.ts'

export const WORLD_INDEX_FORMAT_VERSION = 1
export const OSM_LAYER_FILE = 'trails-osm.jsonl'
export const OPEN_LAYER_FILE = 'trails-wikidata.jsonl'
export const WORLD_CHUNKS_FILE = 'chunks.jsonl'
export const WORLD_VECTORS_FILE = 'vectors.f16'
export const WORLD_MANIFEST_FILE = 'manifest.json'

/** Запись слоя OSM (ODbL). Ключ связи со слоем Wikidata — `source_id` (QID). */
export interface OsmLayerRecord {
  source_id: string
  osm_relation: number
  distance_km: number
  loop: boolean
  /** Середина маршрута — точка на карте. */
  lat: number
  lng: number
  ascent_m?: number
  descent_m?: number
  max_alt_m?: number
  min_alt_m?: number
  /** Технический класс тропы — старший заметный класс `sac_scale`. */
  grade?: SacScale
  days?: number
  /** `true` — дни оценены от усилия, а не взяты из этапов источника. */
  days_estimated?: boolean
  effort_km?: number
  /** Ступень нагрузки. */
  effort?: LoadStep
  /** `true` — ступень задал класс тропы `sac_scale` (подпись «по разметке OpenStreetMap»). */
  effort_by_grade?: boolean
  /** Месяцы без снега по климатической норме, 1–12; двенадцать — устойчивого снега нет круглый год. */
  months?: number[]
}

export interface TrailCountry {
  qid: string
  names: Partial<Record<CardLocale, string>>
}

export interface TrailLink {
  url: string
  /** Язык статьи: может отличаться от языка вопроса, когда статьи на нём нет. */
  lang: string
  kind: 'wikipedia' | 'wikivoyage'
}

/** Запись слоя Wikidata (CC0). */
export interface OpenLayerRecord {
  source_id: string
  labels: Partial<Record<CardLocale, string>>
  aliases: Partial<Record<CardLocale, string[]>>
  descriptions: Partial<Record<CardLocale, string>>
  countries: TrailCountry[]
  /**
   * Места маршрута ниже страны (#3357, приёмка): регион, остров, горная система — цепочка P131 и свойства
   * рельефа Wikidata. По ним маршрут находится на вопрос «в Шотландии», «на Корсике», «в Альпах»; входят в
   * текст смыслового поиска. Поля нет — у элемента места не названы.
   */
  places?: TrailPlace[]
  /**
   * Название статьи Википедии — заголовок карточки, когда у элемента нет названия ни на одном из пяти
   * языков сайта (немецкая тропа с названием только по-немецки).
   */
  native_title?: string
  /** Статья карточки на каждом из пяти языков сайта (с запасным языком, если своей нет). */
  links: Partial<Record<CardLocale, TrailLink>>
  /** Число статей Википедии и Wikivoyage на всех языках — мера известности для порядка выдачи. */
  sitelinks: number
  wd_length_km?: number
}

/** Карточка маршрута в событии `sources` — форма общая со службой и экраном (`api/aiAssist/trailFacts.ts`). */
export type TrailCard = AiWorldTrail

export interface WorldSource {
  id: string
  name: string
  license: string
  license_url: string
  /** Строка, которую экран показывает под блоком «Ещё в мире». */
  attribution: string
  /** Поля карточки, которые дал источник. */
  fields: string[]
  /** Файл слоя в артефакте, если у источника он свой. */
  file?: string
}

/** Источники внешнего индекса: лицензия и строка атрибуции каждого. Запреты — раздел 8 отчёта об источниках. */
export const WORLD_SOURCES: readonly WorldSource[] = [
  {
    id: 'osm',
    name: 'OpenStreetMap',
    license: 'ODbL 1.0',
    license_url: 'https://www.openstreetmap.org/copyright',
    attribution: '© OpenStreetMap contributors',
    fields: ['distance_km', 'grade', 'days', 'ascent_m', 'max_alt_m', 'effort', 'months', 'lat', 'lng'],
    file: OSM_LAYER_FILE,
  },
  {
    id: 'wikidata',
    name: 'Wikidata',
    license: 'CC0 1.0',
    license_url: 'https://www.wikidata.org/wiki/Wikidata:Licensing',
    attribution: 'Wikidata',
    fields: ['title', 'country', 'url'],
    file: OPEN_LAYER_FILE,
  },
  {
    id: 'copernicus-dem',
    name: 'Copernicus DEM',
    license: 'Licence for the use of the Copernicus WorldDEM-30',
    license_url: 'https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf',
    attribution:
      'produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30',
    fields: ['ascent_m', 'max_alt_m', 'effort', 'months'],
  },
  {
    id: 'nasa-power',
    name: 'NASA POWER',
    license: 'без ограничений на использование; просьба ссылаться на проект (в реестре открытых данных AWS — CC BY 4.0)',
    license_url: 'https://registry.opendata.aws/nasa-power/',
    attribution: 'Climate normals: NASA Langley Research Center (LaRC) POWER Project',
    fields: ['months'],
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia и Wikivoyage',
    license: 'CC BY-SA 4.0 — только ссылки на статьи, текст статей в индекс не входит',
    license_url: 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use',
    attribution: 'Wikipedia, Wikivoyage',
    fields: ['url'],
  },
]

/** Короткая строка атрибуции карточки: источники её фактов. */
export function cardAttribution(osm: OsmLayerRecord): string {
  const names = ['OpenStreetMap', 'Wikidata']
  if (osm.ascent_m !== undefined || osm.max_alt_m !== undefined) names.push('Copernicus DEM')
  if (osm.months?.length) names.push('NASA POWER')
  return names.join(', ')
}

const firstOf = <T>(values: Partial<Record<CardLocale, T>>, locale: CardLocale): T | undefined => values[locale] ?? values.en ?? CARD_LOCALES.map((key) => values[key]).find((value) => value !== undefined)

/** Карточка маршрута на языке вопроса: поля слоёв соединяются по `source_id`, значения не смешиваются. */
export function toTrailCard(osm: OsmLayerRecord, open: OpenLayerRecord, locale: CardLocale): TrailCard | null {
  const title = firstOf(open.labels, locale) ?? open.native_title
  const link = firstOf(open.links, locale)
  if (!title || !link || osm.source_id !== open.source_id) return null
  const countries = open.countries.map((country) => firstOf(country.names, locale)).filter((name): name is string => Boolean(name))
  return {
    type: WORLD_CARD_TYPE,
    group: WORLD_GROUP,
    source_id: osm.source_id,
    title,
    url: link.url,
    country: countries.length ? countries.join(', ') : null,
    distance_km: osm.distance_km,
    ...(osm.days !== undefined ? { days: osm.days } : {}),
    ...(osm.days_estimated ? { days_estimated: true } : {}),
    ...(osm.ascent_m !== undefined ? { ascent_m: osm.ascent_m } : {}),
    ...(osm.max_alt_m !== undefined ? { max_alt_m: osm.max_alt_m } : {}),
    ...(osm.grade ? { grade: osm.grade } : {}),
    ...(osm.months?.length ? { months: osm.months } : {}),
    ...(osm.effort ? { effort: osm.effort } : {}),
    ...(osm.effort && osm.effort_by_grade ? { effort_by_grade: true } : {}),
    attribution: cardAttribution(osm),
  }
}

/** Фрагмент смыслового поиска внешнего индекса. */
export interface WorldChunk {
  /** `w<QID>-<locale>-<sha16>`. */
  id: string
  source_id: string
  locale: CardLocale
  title: string
  text: string
}

/** Сколько мест маршрута идёт в текст смыслового поиска: первые в списке — самые узнаваемые. */
export const CHUNK_PLACES = 6

/**
 * Текст для смыслового поиска (решение E): название, псевдонимы и описание элемента Wikidata, названия
 * стран и мест маршрута — на языке фрагмента, с английским запасным. Прозы и чужих абзацев нет. Один
 * фрагмент на язык: вопрос на польском находит маршрут по польскому названию.
 */
export function buildWorldChunks(open: OpenLayerRecord): WorldChunk[] {
  const out: WorldChunk[] = []
  const seen = new Set<string>()
  for (const locale of CARD_LOCALES) {
    const title = open.labels[locale] ?? open.labels.en ?? open.native_title
    if (!title) continue
    const aliases = [...new Set([...(open.aliases[locale] ?? []), ...(open.aliases.en ?? []), open.labels.en ?? ''])].filter((alias) => alias && alias !== title)
    const description = open.descriptions[locale] ?? open.descriptions.en ?? ''
    const countries = open.countries.map((country) => country.names[locale] ?? country.names.en ?? '').filter(Boolean)
    const places = [...new Set((open.places ?? []).map((place) => place.names[locale] ?? place.names.en ?? '').filter(Boolean))].slice(0, CHUNK_PLACES)
    const text = [title, aliases.join(', '), description, countries.join(', '), places.join(', ')].filter(Boolean).join('. ')
    // Языки без своего названия дали бы пять одинаковых английских фрагментов: текст индексируется один раз.
    if (seen.has(text)) continue
    seen.add(text)
    out.push({ id: `w${open.source_id}-${locale}-${sha256Hex(text).slice(0, 16)}`, source_id: open.source_id, locale, title, text })
  }
  return out
}

export interface WorldManifest {
  format_version: number
  built_at: string
  /** Число маршрутов и фрагментов. */
  trails: number
  chunks: number
  /** Модель и размерность векторов; `null` — векторы ещё не посчитаны (`embed`). */
  model: string | null
  dim: number | null
  layers: Record<'osm' | 'wikidata' | 'chunks', { file: string; count: number; sha256: string }>
  /** Параметры расчёта производных фактов — по ним сборка воспроизводима. */
  params: { dem: string; ascent: AscentParams; season: SeasonParams & { altitude_quantile: number }; effort: typeof EFFORT_THRESHOLDS }
  sources: readonly WorldSource[]
}

const jsonlSha = (rows: readonly unknown[]): string => sha256Hex(rows.map((row) => `${JSON.stringify(row)}\n`).join(''))

export interface WorldIndexInput {
  osm: OsmLayerRecord[]
  open: OpenLayerRecord[]
  dem: string
  ascent: AscentParams
  builtAt?: string
}

/** Запись слоёв, фрагментов и манифеста; векторы добавляет `embed` (манифест получает модель и размерность). */
export function writeWorldIndex(distDir: string, input: WorldIndexInput): WorldManifest {
  const openById = new Map(input.open.map((record) => [record.source_id, record]))
  // В индекс идёт только маршрут, у которого есть оба слоя: без геометрии нет фактов, без названия — карточки.
  const osm = input.osm.filter((record) => openById.has(record.source_id)).sort((a, b) => a.source_id.localeCompare(b.source_id, 'en', { numeric: true }))
  const open = osm.map((record) => openById.get(record.source_id)!)
  const chunks = open.flatMap(buildWorldChunks)
  fs.mkdirSync(distDir, { recursive: true })
  writeJsonl(path.join(distDir, OSM_LAYER_FILE), osm)
  writeJsonl(path.join(distDir, OPEN_LAYER_FILE), open)
  writeJsonl(path.join(distDir, WORLD_CHUNKS_FILE), chunks)
  const manifest: WorldManifest = {
    format_version: WORLD_INDEX_FORMAT_VERSION,
    built_at: input.builtAt ?? new Date().toISOString(),
    trails: osm.length,
    chunks: chunks.length,
    model: null,
    dim: null,
    layers: {
      osm: { file: OSM_LAYER_FILE, count: osm.length, sha256: jsonlSha(osm) },
      wikidata: { file: OPEN_LAYER_FILE, count: open.length, sha256: jsonlSha(open) },
      chunks: { file: WORLD_CHUNKS_FILE, count: chunks.length, sha256: jsonlSha(chunks) },
    },
    params: { dem: input.dem, ascent: input.ascent, season: { ...SEASON_PARAMS, altitude_quantile: SEASON_ALTITUDE_QUANTILE }, effort: EFFORT_THRESHOLDS },
    sources: WORLD_SOURCES,
  }
  writeJson(path.join(distDir, WORLD_MANIFEST_FILE), manifest)
  return manifest
}

/** Проверка манифеста: у каждого источника есть лицензия и атрибуция, слои совпадают с отпечатками. */
export function verifyWorldIndex(distDir: string): string[] {
  const problems: string[] = []
  const manifestFile = path.join(distDir, WORLD_MANIFEST_FILE)
  if (!fs.existsSync(manifestFile)) return [`нет ${manifestFile}`]
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as WorldManifest
  for (const source of manifest.sources ?? []) {
    if (!source.license?.trim() || !source.license_url?.trim() || !source.attribution?.trim()) problems.push(`источник ${source.id}: нет лицензии, её адреса или строки атрибуции`)
  }
  for (const required of ['osm', 'wikidata', 'copernicus-dem', 'nasa-power']) {
    if (!(manifest.sources ?? []).some((source) => source.id === required)) problems.push(`в манифесте нет источника ${required}`)
  }
  for (const layer of Object.values(manifest.layers ?? {})) {
    const file = path.join(distDir, layer.file)
    const body = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
    const count = body.split('\n').filter((line) => line.trim()).length
    if (count !== layer.count) problems.push(`${layer.file}: ${count} строк, в манифесте ${layer.count}`)
    if (sha256Hex(body) !== layer.sha256) problems.push(`${layer.file}: sha256 не совпадает с манифестом`)
  }
  if (manifest.model) {
    const vectors = path.join(distDir, WORLD_VECTORS_FILE)
    const bytes = fs.existsSync(vectors) ? fs.statSync(vectors).size : -1
    if (bytes !== manifest.chunks * (manifest.dim ?? 0) * 2) problems.push(`${WORLD_VECTORS_FILE}: ${bytes} байт, ожидалось ${manifest.chunks * (manifest.dim ?? 0) * 2}`)
  }
  return problems
}
