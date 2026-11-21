#!/usr/bin/env node --experimental-strip-types
/**
 * Внешний индекс пеших маршрутов мира (#3357). Запуск:
 * `node --experimental-strip-types scripts/ai-index/world/build.ts <команда> [опции]`.
 *
 *   list     — перечень: классы Wikidata + отношения OSM с тегом `wikidata` → <out>/work/list.jsonl и
 *              слой Wikidata <out>/work/open-layer.jsonl; печатает числа перечня
 *   refs     — четыре эталона: геометрия, набор высоты, ступень, сезон против чисел источников
 *   build    — выборка маршрутов → <dist>/{trails-osm.jsonl,trails-wikidata.jsonl,chunks.jsonl,manifest.json}.
 *              По умолчанию — эталоны и --sample 30; полная сборка — только с явным --all
 *   embed    — chunks.jsonl → vectors.f16 той же моделью, что у индекса сайта (--model)
 *   manifest — проверка артефакта: лицензии и атрибуции источников, отпечатки слоёв
 *
 * Опции: --out <dir> (.codex-temp/3357), --dist <dir> (<out>/dist), --dem glo30|glo90 (glo30),
 *        --sample <n>, --ids Q24777,Q965998, --all, --model <ключ>, --dem-cache-gb <n> (4),
 *        --overpass <url[,url]> (экземпляры Overpass API по очереди), --overpass-max-mb <n> (900) и
 *        --overpass-max-requests <n> (1500) — потолок прохода: дальше берётся только кэш, код выхода 0,
 *        следующий проход продолжает с отложенных маршрутов; --offline — только кэш.
 * Сырые ответы сервисов лежат в <out>/raw и в git не попадают; повторный запуск сеть не трогает.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseArgs } from '../build.ts'
import { createEmbedder } from '../embed.ts'
import { encodeVectors, readJsonl, writeJsonl } from '../format.ts'
import { resolveModel } from '../models.ts'
import {
  type OpenLayerRecord,
  type OsmLayerRecord,
  verifyWorldIndex,
  WORLD_CHUNKS_FILE,
  WORLD_MANIFEST_FILE,
  WORLD_VECTORS_FILE,
  type WorldChunk,
  type WorldManifest,
  writeWorldIndex,
} from './cards.ts'
import { DEM_PRODUCTS, DemReader, pruneDemCache } from './dem.ts'
import { NetworkError, newStats, OfflineError, readJson, sleep, writeJson } from './net.ts'
import { fetchTaggedRelations, OVERPASS_ENDPOINT } from './overpass.ts'
import { ASCENT_PARAMS, candidatesToTry, joinList, lengthMismatch, type ListEntry, processTrail, referenceLengthKm, toOpenRecord, type TrailResult, withoutAscent } from './pipeline.ts'
import { ascentCalibrated, checkReference, REFERENCE_TRAILS, type ReferenceVerdict } from './references.ts'
import { type ClassMember, fetchClassMembers, fetchEntities, fetchPlaceEntities, parseEntity, resolvePlaces, TRAIL_CLASSES, TRAIL_PROPS } from './wikidata.ts'

const log = (line: string) => console.error(line)

interface Paths {
  out: string
  raw: string
  work: string
  dist: string
}

const pathsOf = (flags: Record<string, string | boolean>): Paths => {
  const out = path.resolve(typeof flags.out === 'string' ? flags.out : '.codex-temp/3357')
  return { out, raw: path.join(out, 'raw'), work: path.join(out, 'work'), dist: path.resolve(typeof flags.dist === 'string' ? flags.dist : path.join(out, 'dist')) }
}

type ListRow = ListEntry & { sitelinks: number; wd_length_km?: number; tag_distance_km?: number; countries: string[]; title: string }

async function runList(paths: Paths, flags: Record<string, string | boolean>): Promise<void> {
  const stats = { wikidata: newStats(), overpass: newStats() }
  const members: ClassMember[] = []
  const perClass: Record<string, number> = {}
  for (const classId of TRAIL_CLASSES) {
    const own = await fetchClassMembers(classId, { rawDir: paths.raw, stats: stats.wikidata, log })
    perClass[classId] = own.length
    members.push(...own)
  }
  const endpoints = typeof flags.overpass === 'string' ? flags.overpass.split(',').map((url) => url.trim()).filter(Boolean) : [OVERPASS_ENDPOINT]
  let tagged: Awaited<ReturnType<typeof fetchTaggedRelations>> | null = null
  for (const [index, endpoint] of endpoints.entries()) {
    try {
      tagged = await fetchTaggedRelations({ rawDir: paths.raw, stats: stats.overpass, log, endpoint, retries: endpoints.length > 1 ? 3 : undefined })
      break
    } catch (error) {
      if (!(error instanceof NetworkError) || index === endpoints.length - 1) throw error
      log(`${new URL(endpoint).host} не ответил, следующий экземпляр`)
    }
  }
  if (!tagged) throw new Error('нет ответа Overpass на запрос отношений с тегом wikidata')
  const entries = joinList(members, tagged)
  const classQids = new Set(members.map((member) => member.qid))
  log(`классы Wikidata со статьёй: ${classQids.size} (${JSON.stringify(perClass)}); отношений OSM с тегом wikidata: ${tagged.length}; с геометрией: ${entries.length}`)

  const entities = await fetchEntities(entries.map((entry) => entry.qid), TRAIL_PROPS, { rawDir: paths.raw, stats: stats.wikidata, log })
  const trails = entries.flatMap((entry) => {
    const raw = entities.get(entry.qid)
    return raw ? [{ entry, trail: parseEntity(raw) }] : []
  })
  const countries = await fetchEntities([...new Set(trails.flatMap(({ trail }) => trail.countries))], 'labels', { rawDir: paths.raw, stats: stats.wikidata, log })
  const distanceTag = new Map(tagged.map((relation) => [relation.id, Number.parseFloat(String(relation.distance ?? '').replace(',', '.'))]))
  // Места маршрута ниже страны: цепочка административных единиц и рельефа Wikidata. Страны и сами маршруты
  // перечня местами не считаются.
  const placeRules = { countries: new Set(trails.flatMap(({ trail }) => trail.countries)), exclude: classQids }
  const placeEntities = await fetchPlaceEntities(trails.flatMap(({ trail }) => trail.place_refs), placeRules, { rawDir: paths.raw, stats: stats.wikidata, log })

  const open: OpenLayerRecord[] = []
  const rows: ListRow[] = []
  for (const { entry, trail } of trails) {
    const record = toOpenRecord(trail, countries, resolvePlaces(trail.place_refs, placeEntities, placeRules))
    // Служебные сайты (Commons) статьёй не считаются: элемент без статьи в перечень не идёт.
    if (!record) continue
    open.push(record)
    const tag = distanceTag.get(entry.relation)
    rows.push({
      ...entry,
      sitelinks: record.sitelinks,
      ...(record.wd_length_km !== undefined ? { wd_length_km: record.wd_length_km } : {}),
      ...(tag !== undefined && Number.isFinite(tag) && tag > 0 ? { tag_distance_km: tag } : {}),
      countries: record.countries.map((country) => country.names.en ?? country.qid),
      title: record.labels.en ?? Object.values(record.labels)[0] ?? record.native_title ?? entry.qid,
    })
  }
  writeJsonl(path.join(paths.work, 'list.jsonl'), rows)
  writeJsonl(path.join(paths.work, 'open-layer.jsonl'), open)

  const withPlaces = new Set(open.filter((record) => record.places?.length).map((record) => record.source_id))
  const lengthOf = (row: ListRow): number | undefined => row.wd_length_km ?? row.tag_distance_km
  const within = (low: number, high: number) => rows.filter((row) => {
    const km = lengthOf(row)
    return km !== undefined && km >= low && km <= high
  }).length
  const byCountry = new Map<string, number>()
  for (const row of rows) for (const country of row.countries.length ? row.countries : ['(страна не указана)']) byCountry.set(country, (byCountry.get(country) ?? 0) + 1)
  const summary = {
    class_members_with_article: classQids.size,
    per_class: perClass,
    osm_tagged_relations: tagged.length,
    with_osm_and_article: rows.length,
    link: { P402: rows.filter((row) => row.link === 'P402').length, tag: rows.filter((row) => row.link === 'tag').length, both: rows.filter((row) => row.link === 'both').length },
    with_length: rows.filter((row) => lengthOf(row) !== undefined).length,
    length_from: { wikidata: rows.filter((row) => row.wd_length_km !== undefined).length, osm_tag_only: rows.filter((row) => row.wd_length_km === undefined && row.tag_distance_km !== undefined).length },
    km_20_100: within(20, 100),
    km_under_20: within(0, 19.999),
    km_100_300: within(100.001, 300),
    km_over_300: within(300.001, 1e9),
    first_version: rows.filter(inFirstVersion).length,
    // У скольких маршрутов названо хотя бы одно место ниже страны — по всему перечню и по первой версии.
    with_places: { all: open.filter((record) => record.places?.length).length, first_version: rows.filter((row) => inFirstVersion(row) && withPlaces.has(row.qid)).length },
    sitelinks: { ge2: rows.filter((row) => row.sitelinks >= 2).length, ge3: rows.filter((row) => row.sitelinks >= 3).length, ge5: rows.filter((row) => row.sitelinks >= 5).length, ge10: rows.filter((row) => row.sitelinks >= 10).length },
    total_km_known: Math.round(rows.reduce((sum, row) => sum + (lengthOf(row) ?? 0), 0)),
    top_countries: [...byCountry].sort((a, b) => b[1] - a[1]).slice(0, 10),
    net: stats,
  }
  writeJson(path.join(paths.work, 'list-summary.json'), summary)
  console.log(JSON.stringify(summary, null, 2))
}

/** Самый длинный маршрут малой сборки, км: проба не должна тянуть трансконтинентальные тропы. */
const SAMPLE_MAX_KM = 600

/**
 * Состав первой версии (предложение проекта): маршруты хотя бы с двумя вики-статьями и все маршруты на
 * 20–100 км со статьёй; трансконтинентальные пути длиннее `V1_MAX_KM` не берутся.
 */
export const V1_MAX_KM = 5000
export const inFirstVersion = (row: Pick<ListRow, 'sitelinks' | 'wd_length_km' | 'tag_distance_km'>): boolean => {
  const km = row.wd_length_km ?? row.tag_distance_km
  if (km !== undefined && km > V1_MAX_KM) return false
  return row.sitelinks >= 2 || (km !== undefined && km >= 20 && km <= 100)
}

/** Выборка малой сборки: эталоны, затем самые известные маршруты на 20–100 км и самые известные остальные. */
function pickSample(rows: readonly ListRow[], size: number): ListRow[] {
  const refs = new Set(REFERENCE_TRAILS.map((reference) => reference.qid))
  const byFame = [...rows]
    .filter((row) => !refs.has(row.qid) && row.wd_length_km !== undefined && row.wd_length_km <= SAMPLE_MAX_KM)
    .sort((a, b) => b.sitelinks - a.sitelinks || Number(a.qid.slice(1)) - Number(b.qid.slice(1)))
  const short = byFame.filter((row) => row.wd_length_km !== undefined && row.wd_length_km >= 20 && row.wd_length_km <= 100)
  const rest = Math.max(0, size - refs.size)
  const half = Math.ceil(rest / 2)
  const picked = new Map<string, ListRow>()
  for (const row of short.slice(0, half)) picked.set(row.qid, row)
  for (const row of byFame) {
    if (picked.size >= rest) break
    picked.set(row.qid, row)
  }
  return [...picked.values()]
}

interface RunSummary {
  dem: string
  trails: number
  skipped: Array<{ qid: string; reason: string }>
  /** Маршруты, до которых проход не дошёл: потолок объёма или недоступный Overpass. Их возьмёт следующий проход. */
  deferred: string[]
  stopped: string | null
  seconds: number
  net: Record<'overpass' | 'dem' | 'climate', ReturnType<typeof newStats>>
  references: Array<{ verdict: ReferenceVerdict; distance_km: number; ascent_m?: number; max_alt_m?: number; days?: number; days_estimated?: boolean; effort?: string; grade?: string; months?: number[] }>
  ascent_calibrated: boolean
}

type Target = { qid: string; relation: number; candidates: number[]; wd_length_km?: number; tag_distance_km?: number }

/**
 * Вежливость к Overpass: потолок объёма и числа запросов на проход (правило основного экземпляра — меньше
 * 1 ГБ и 10 000 запросов в сутки, https://wiki.openstreetmap.org/wiki/Overpass_API), а при недоступном
 * сервере — растущие паузы и остановка прохода вместо непрерывных повторов. Кэш возобновляемый: следующий
 * проход берёт готовое с диска и продолжает с отложенных маршрутов.
 */
export const OVERPASS_PASS_LIMITS = { maxMb: 900, maxRequests: 1500 } as const
/** Паузы после подряд идущих отказов сети, мин; после последней проход закрывает сеть. */
export const OUTAGE_PAUSES_MIN = [10, 20, 40, 60, 60] as const
const FAILURES_PER_PAUSE = 2

const flagFloat = (flags: Record<string, string | boolean>, name: string, fallback: number): number => {
  const value = Number.parseFloat(String(flags[name] ?? ''))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

async function runTrails(paths: Paths, flags: Record<string, string | boolean>, targets: Target[]): Promise<{ results: Map<string, TrailResult>; summary: RunSummary }> {
  const product = DEM_PRODUCTS[flags.dem === 'glo90' ? 'glo90' : 'glo30']
  const cacheBytes = flagFloat(flags, 'dem-cache-gb', 4) * 1e9
  const maxBytes = flagFloat(flags, 'overpass-max-mb', OVERPASS_PASS_LIMITS.maxMb) * 1e6
  const maxRequests = flagFloat(flags, 'overpass-max-requests', OVERPASS_PASS_LIMITS.maxRequests)
  // Экземпляры Overpass по очереди: следующий берётся, когда текущий не ответил после всех повторов.
  const endpoints = typeof flags.overpass === 'string' ? flags.overpass.split(',').map((url) => url.trim()).filter(Boolean) : [OVERPASS_ENDPOINT]
  let endpoint = 0
  const stats = { overpass: newStats(), dem: newStats(), climate: newStats() }
  const dem = new DemReader({ product, rawDir: paths.raw, stats: stats.dem, log })
  const started = Date.now()
  const results = new Map<string, TrailResult>()
  const skipped: RunSummary['skipped'] = []
  const deferred: string[] = []
  let stopped: string | null = flags.offline === true ? 'сеть Overpass закрыта флагом --offline' : null
  let failures = 0
  let attempts = 0
  // Эталоны считаются всегда и первыми: по ним решается, идёт ли набор высоты в карточки.
  const references: Target[] = REFERENCE_TRAILS.map((reference) => ({ qid: reference.qid, relation: reference.relation, candidates: [reference.relation] }))
  const wanted = [...references, ...targets.filter((target) => !REFERENCE_TRAILS.some((reference) => reference.qid === target.qid))]
  for (const [index, target] of wanted.entries()) {
    if (!stopped && (stats.overpass.bytes >= maxBytes || attempts >= maxRequests)) {
      stopped = `потолок прохода Overpass: ${Math.round(stats.overpass.bytes / 1e6)} МБ, запросов ${attempts}`
      log(`${stopped}; дальше — только маршруты из кэша`)
    }
    // Отношение из P402 бывает участком или не маршрутом вовсе: пробуются и другие кандидаты элемента.
    const reasons: string[] = []
    let postponed = false
    // Длина для сверки: Wikidata, иначе тег `distance` отношения OSM.
    const expectedKm = referenceLengthKm(target)
    for (const relation of candidatesToTry(target, expectedKm)) {
      const before = stats.overpass.requests
      try {
        const result = await processTrail(target.qid, relation, {
          rawDir: paths.raw,
          profileDir: path.join(paths.work, 'profiles'),
          dem,
          stats,
          log,
          overpass: endpoints[endpoint],
          offline: stopped !== null,
          // Несколько экземпляров — у каждого меньше повторов: занятый быстрее уступает следующему.
          overpassRetries: endpoints.length > 1 ? 3 : undefined,
        })
        if (stats.overpass.requests > before) failures = 0
        if (!result) reasons.push(`отношение ${relation}: нет геометрии`)
        else if (lengthMismatch(result.record.distance_km, expectedKm)) reasons.push(`отношение ${relation}: геометрия ${result.record.distance_km} км при длине ${target.wd_length_km !== undefined ? 'Wikidata' : 'по тегу distance OSM'} ${expectedKm} км`)
        else {
          results.set(target.qid, result)
          break
        }
      } catch (error) {
        if (error instanceof OfflineError) {
          postponed = true
          break
        }
        if (error instanceof NetworkError && /overpass|interpreter/i.test(error.message)) {
          postponed = true
          failures += 1
          endpoint = (endpoint + 1) % endpoints.length
          log(`Overpass не ответил (${failures} подряд): ${error.message}; следующий экземпляр — ${new URL(endpoints[endpoint]).host}`)
          if (failures % FAILURES_PER_PAUSE === 0) {
            const pause = OUTAGE_PAUSES_MIN[failures / FAILURES_PER_PAUSE - 1]
            if (pause === undefined) {
              stopped = `Overpass недоступен: ${failures} отказов подряд`
              log(`${stopped}; сеть для прохода закрыта, дальше — только маршруты из кэша`)
            } else {
              log(`пауза ${pause} мин перед следующей попыткой`)
              await sleep(pause * 60_000)
            }
          }
          break
        }
        reasons.push(error instanceof Error ? error.message : String(error))
      } finally {
        attempts += stats.overpass.requests - before
      }
    }
    if (results.has(target.qid)) {
      // Маршрут получен.
    } else if (postponed) deferred.push(target.qid)
    else skipped.push({ qid: target.qid, reason: reasons.join('; ') })
    if ((index + 1) % 5 === 0) {
      const removed = pruneDemCache(paths.raw, product, cacheBytes)
      log(`маршрутов ${index + 1}/${wanted.length}: готово ${results.size}, отсеяно ${skipped.length}, отложено ${deferred.length}; Overpass ${Math.round(stats.overpass.bytes / 1e6)} МБ${removed ? `, из кэша рельефа убрано блоков: ${removed}` : ''}`)
    }
  }
  const verdicts = REFERENCE_TRAILS.flatMap((reference) => {
    const record = results.get(reference.qid)?.record
    if (!record) return []
    const { distance_km, ascent_m, max_alt_m, days, days_estimated, effort, grade, months } = record
    return [{ verdict: checkReference(reference, record), distance_km, ascent_m, max_alt_m, days, days_estimated, effort, grade, months }]
  })
  const calibrated = ascentCalibrated(verdicts.map((entry) => entry.verdict))
  return {
    results,
    summary: { dem: product.label, trails: results.size, skipped, deferred, stopped, seconds: Math.round((Date.now() - started) / 100) / 10, net: stats, references: verdicts, ascent_calibrated: calibrated },
  }
}

async function runRefs(paths: Paths, flags: Record<string, string | boolean>): Promise<number> {
  const { results, summary } = await runTrails(paths, flags, [])
  writeJson(path.join(paths.work, `refs-${flags.dem === 'glo90' ? 'glo90' : 'glo30'}.json`), { summary, trails: Object.fromEntries([...results].map(([qid, result]) => [qid, result])) })
  console.log(JSON.stringify(summary, null, 2))
  return summary.ascent_calibrated && summary.references.every(({ verdict }) => verdict.length && verdict.months && verdict.step !== false) ? 0 : 1
}

async function runBuild(paths: Paths, flags: Record<string, string | boolean>): Promise<number> {
  const listFile = path.join(paths.work, 'list.jsonl')
  if (!fs.existsSync(listFile)) throw new Error(`нет перечня ${listFile}: сначала команда list`)
  const rows = readJsonl<ListRow>(listFile)
  const open = readJsonl<OpenLayerRecord>(path.join(paths.work, 'open-layer.jsonl'))
  const ids = typeof flags.ids === 'string' ? new Set(flags.ids.split(',').map((id) => id.trim())) : null
  const chosen = ids ? rows.filter((row) => ids.has(row.qid)) : flags.all === true ? rows.filter(inFirstVersion) : pickSample(rows, Number.parseInt(String(flags.sample ?? '30'), 10) || 30)
  const { results, summary } = await runTrails(paths, flags, chosen)
  const records: OsmLayerRecord[] = [...results.values()].map((result) => (summary.ascent_calibrated ? result.record : withoutAscent(result.record)))
  if (!summary.ascent_calibrated) log('набор высоты не сошёлся с эталонами: в карточках нет набора, дней и ступени нагрузки')
  const product = flags.dem === 'glo90' ? 'glo90' : 'glo30'
  const manifest = writeWorldIndex(paths.dist, { osm: records, open, dem: DEM_PRODUCTS[product].label, ascent: ASCENT_PARAMS[product] })
  writeJson(path.join(paths.work, 'build-summary.json'), { summary, manifest: { trails: manifest.trails, chunks: manifest.chunks } })
  console.log(JSON.stringify({ ...summary, written: { trails: manifest.trails, chunks: manifest.chunks, dist: paths.dist } }, null, 2))
  const problems = verifyWorldIndex(paths.dist)
  problems.forEach((problem) => log(`артефакт: ${problem}`))
  return problems.length ? 1 : 0
}

async function runEmbed(paths: Paths, flags: Record<string, string | boolean>): Promise<number> {
  const manifestFile = path.join(paths.dist, WORLD_MANIFEST_FILE)
  const manifest = readJson<WorldManifest>(manifestFile)
  const chunks = readJsonl<WorldChunk>(path.join(paths.dist, WORLD_CHUNKS_FILE))
  const spec = resolveModel(typeof flags.model === 'string' ? flags.model : undefined)
  const started = Date.now()
  const embedder = await createEmbedder(spec, { threads: Number.parseInt(String(flags.threads ?? ''), 10) || undefined })
  const loaded = Date.now()
  const vectors = await embedder.embedDocuments(chunks.map((chunk) => ({ title: chunk.title, text: chunk.text })))
  await embedder.dispose()
  fs.writeFileSync(path.join(paths.dist, WORLD_VECTORS_FILE), encodeVectors(vectors, spec.dim))
  writeJson(manifestFile, { ...manifest, model: spec.key, dim: spec.dim })
  console.log(JSON.stringify({ model: spec.key, chunks: chunks.length, load_s: (loaded - started) / 1000, embed_s: (Date.now() - loaded) / 1000, ms_per_chunk: Math.round((Date.now() - loaded) / Math.max(1, chunks.length)), rss_mb: Math.round(process.memoryUsage().rss / 1048576) }))
  return verifyWorldIndex(paths.dist).length ? 1 : 0
}

export async function main(argv: string[]): Promise<number> {
  const { command, flags } = parseArgs(argv)
  const paths = pathsOf(flags)
  if (command === 'list') {
    await runList(paths, flags)
    return 0
  }
  if (command === 'refs') return runRefs(paths, flags)
  if (command === 'build') return runBuild(paths, flags)
  if (command === 'embed') return runEmbed(paths, flags)
  if (command === 'manifest') {
    const problems = verifyWorldIndex(paths.dist)
    problems.forEach((problem) => console.log(problem))
    if (!problems.length) console.log(fs.readFileSync(path.join(paths.dist, WORLD_MANIFEST_FILE), 'utf8'))
    return problems.length ? 1 : 0
  }
  console.error('команды: list | refs | build | embed | manifest (см. шапку scripts/ai-index/world/build.ts)')
  return 2
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error instanceof Error ? (error.stack ?? error.message) : String(error))
      process.exit(1)
    },
  )
}
