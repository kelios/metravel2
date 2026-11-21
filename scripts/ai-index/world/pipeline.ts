/**
 * Конвейер одного маршрута внешнего индекса (#3357): геометрия OSM → рельеф → климат → факты и ступень.
 * Сеть — только через кэш на диске (`net.ts`); расчёт — чистые функции соседних модулей.
 */
import { fetchNormals } from './climate.ts'
import type { OsmLayerRecord, OpenLayerRecord, TrailCountry } from './cards.ts'
import fs from 'node:fs'
import path from 'node:path'

import { type DemProduct, DemReader } from './dem.ts'
import { type AscentParams, mergeStats, profileStats } from './elevation.ts'
import { estimateEffort, sacGrade } from './effort.ts'
import { type Point, resampleLine } from './geo.ts'
import type { NetStats } from './net.ts'
import { assembleRoute, fetchRoute, type RouteGeometry, type TaggedRelation } from './overpass.ts'
import { altitudeQuantile, passableMonths, SEASON_ALTITUDE_QUANTILE, type SeasonSegment } from './season.ts'
import { articleFor, CARD_LOCALES, type ClassMember, type RawEntity, type TrailPlace, type WikidataTrail } from './wikidata.ts'

/**
 * Параметры набора высоты по продуктам рельефа — подобраны на эталонах 14.11.2026
 * (`.codex-temp/3357/calibrate.mts`): шаг профиля 30 м, без сглаживания, порог разворота 20 м для GLO-30
 * и 15 м для GLO-90.
 */
export const ASCENT_PARAMS: Record<DemProduct['key'], AscentParams> = {
  glo30: { stepM: 30, smoothM: 0, thresholdM: 20 },
  glo90: { stepM: 30, smoothM: 0, thresholdM: 15 },
}

/** Длина участка маршрута для климата, км, и предел числа участков. */
export const CLIMATE_SEGMENT_KM = 50
export const CLIMATE_MAX_SEGMENTS = 12
/** Геометрия расходится с длиной Wikidata больше этой доли — отношение не тот маршрут (участок, вариант). */
export const LENGTH_MISMATCH = 0.25

export interface ListEntry {
  qid: string
  /** Выбранное отношение OSM и откуда связь. */
  relation: number
  link: 'P402' | 'tag' | 'both'
  /** Все отношения-кандидаты элемента. */
  candidates: number[]
}

/**
 * Связь элемента Wikidata с отношением OSM в обе стороны: P402 и тег `wikidata` на отношении. Выбор
 * отношения: значение P402; иначе среди помеченных — superroute, затем с наибольшим тегом `distance`,
 * затем с меньшим номером.
 */
export function joinList(members: readonly ClassMember[], tagged: readonly TaggedRelation[]): ListEntry[] {
  const byQid = new Map<string, TaggedRelation[]>()
  for (const relation of tagged) {
    const list = byQid.get(relation.qid)
    if (list) list.push(relation)
    else byQid.set(relation.qid, [relation])
  }
  const p402 = new Map<string, Set<number>>()
  for (const member of members) {
    const ids = p402.get(member.qid) ?? new Set<number>()
    member.osm.forEach((id) => ids.add(id))
    p402.set(member.qid, ids)
  }
  const out: ListEntry[] = []
  for (const [qid, ids] of p402) {
    const own = [...ids].sort((a, b) => a - b)
    const tags = [...(byQid.get(qid) ?? [])].sort(
      (a, b) => Number(b.type === 'superroute') - Number(a.type === 'superroute') || (Number.parseFloat(b.distance ?? '') || 0) - (Number.parseFloat(a.distance ?? '') || 0) || a.id - b.id,
    )
    if (!own.length && !tags.length) continue
    const relation = own[0] ?? tags[0].id
    out.push({ qid, relation, link: own.length && tags.length ? 'both' : own.length ? 'P402' : 'tag', candidates: [...new Set([...own, ...tags.map((tag) => tag.id)])] })
  }
  return out.sort((a, b) => Number(a.qid.slice(1)) - Number(b.qid.slice(1)))
}

/** Запись слоя Wikidata из разобранного элемента, названий стран и мест маршрута ниже страны. */
export function toOpenRecord(trail: WikidataTrail, countryNames: ReadonlyMap<string, RawEntity>, places: readonly TrailPlace[] = []): OpenLayerRecord | null {
  if (!trail.articles.length) return null
  // Название статьи без уточнения в скобках: «Rennsteig (Wanderweg)» → «Rennsteig».
  const native = Object.keys(trail.labels).length ? '' : (articleFor(trail.articles, 'en')?.title ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (!Object.keys(trail.labels).length && !native) return null
  const countries: TrailCountry[] = trail.countries.map((qid) => {
    const names: TrailCountry['names'] = {}
    for (const locale of CARD_LOCALES) {
      const value = countryNames.get(qid)?.labels?.[locale]?.value
      if (value) names[locale] = value
    }
    return { qid, names }
  })
  const links: OpenLayerRecord['links'] = {}
  for (const locale of CARD_LOCALES) {
    const article = articleFor(trail.articles, locale)
    if (article) links[locale] = { url: article.url, lang: article.lang, kind: article.kind }
  }
  return {
    source_id: trail.qid,
    labels: trail.labels,
    ...(native ? { native_title: native } : {}),
    aliases: trail.aliases,
    descriptions: trail.descriptions,
    countries,
    ...(places.length ? { places: [...places] } : {}),
    links,
    sitelinks: trail.articles.length,
    ...(trail.wd_length_km !== undefined ? { wd_length_km: trail.wd_length_km } : {}),
  }
}

export interface TrailContext {
  rawDir: string
  /** Другой экземпляр Overpass API. */
  overpass?: string
  /** Только кэш геометрии: сеть Overpass для этого прохода закрыта. */
  offline?: boolean
  /** Сколько раз повторять запрос геометрии к занятому серверу. */
  overpassRetries?: number
  /**
   * Каталог профилей высот: блоки рельефа в кэше ограничены по объёму и удаляются, а профиль маршрута
   * (высоты в дециметрах с шагом расчёта) остаётся — следующий проход сборки рельеф заново не качает.
   */
  profileDir?: string
  dem: DemReader
  stats?: { overpass: NetStats; dem: NetStats; climate: NetStats }
  log?: (line: string) => void
}

export interface TrailResult {
  record: OsmLayerRecord
  route: Pick<RouteGeometry, 'length_km' | 'continuity' | 'loop' | 'ways' | 'sac_km' | 'tags'> & { chains: number; stages_km: number[] }
  /** Участки расчёта сезона: высота участка и ячейка климатической сетки. */
  segments: Array<{ altitude_m: number; cell: string | null }>
}

const middleOf = (chains: readonly (readonly Point[])[]): Point => {
  const longest = chains.reduce((best, chain) => (chain.length > best.length ? chain : best), chains[0])
  return longest[Math.floor(longest.length / 2)]
}

/** Профили цепочек маршрута: с диска, если точек столько же, сколько в геометрии, иначе по рельефу. */
async function readProfiles(relation: number, points: readonly (readonly Point[])[], stepM: number, context: TrailContext): Promise<number[][]> {
  const file = context.profileDir ? path.join(context.profileDir, `${context.dem.product.key}-s${stepM}`, `${relation}.json`) : null
  if (file && fs.existsSync(file)) {
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as { chains?: number[][] }
      const chains = saved.chains ?? []
      if (chains.length === points.length && chains.every((chain, index) => chain.length === points[index].length)) return chains.map((chain) => chain.map((value) => value / 10))
    } catch {
      // Битый файл профиля — считаем заново.
    }
  }
  const profiles: number[][] = []
  for (const chain of points) profiles.push(await context.dem.profile(chain))
  if (file) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp-${process.pid}`
    fs.writeFileSync(tmp, JSON.stringify({ relation, step_m: stepM, chains: profiles.map((profile) => profile.map((value) => Math.round(value * 10))) }))
    fs.renameSync(tmp, file)
    // Дальше расчёт идёт по тем же округлённым высотам, что лягут в файл: проходы дают одно и то же.
    return profiles.map((profile) => profile.map((value) => Math.round(value * 10) / 10))
  }
  return profiles
}

/** Сколько отношений-кандидатов пробуется у одного маршрута. */
export const MAX_CANDIDATES = 3

/**
 * Отношения, которые стоит пробовать по очереди. Без длины Wikidata — только выбранное: другой кандидат
 * может оказаться этапом (у троп Гонконга тегом `wikidata` помечен каждый этап), и отличить его от целого
 * маршрута нечем; с длиной Wikidata этап отсеет сверка длины.
 */
export const candidatesToTry = (entry: Pick<ListEntry, 'relation' | 'candidates'>, wdLengthKm: number | undefined): number[] =>
  wdLengthKm === undefined ? [entry.relation] : [...new Set([entry.relation, ...entry.candidates])].slice(0, MAX_CANDIDATES)

/** Геометрия → рельеф → климат → запись слоя OSM. `null` — у отношения нет геометрии. */
export async function processTrail(qid: string, relation: number, context: TrailContext): Promise<TrailResult | null> {
  const elements = await fetchRoute(relation, {
    rawDir: context.rawDir,
    endpoint: context.overpass,
    offline: context.offline,
    retries: context.overpassRetries,
    stats: context.stats?.overpass,
    log: context.log,
  })
  const route = assembleRoute(elements, relation)
  if (!route || !(route.length_km > 0)) return null
  // В классе «пешая тропа» Wikidata попадаются исторические дороги и городские прогулки, а P402 у них
  // указывает на отношение другого вида: в индекс идёт только то, что OSM размечает пешим маршрутом.
  if (!route.foot) throw new Error(`отношение ${relation} — не пеший маршрут в OSM (route=${route.tags.route ?? route.tags.superroute ?? 'нет'})`)

  const params = ASCENT_PARAMS[context.dem.product.key]
  const points = route.chains.map((chain) => resampleLine(chain, params.stepM))
  const profiles = await readProfiles(relation, points, params.stepM, context)
  const stats = mergeStats(profiles.map((profile) => profileStats(profile, params)))
  // Набор по направлению маршрута: половина размаха плюс половина перепада «конец минус начало». Перепад
  // известен, когда маршрут склеился в одну незамкнутую цепочку; иначе набор и сброс равны.
  const single = profiles.length === 1 && !route.loop ? profiles[0] : null
  const net = single ? single[single.length - 1] - single[0] : 0
  const span = stats.ascent_m + stats.descent_m
  const ascent = Math.max(0, Math.round((span + net) / 2))
  const descent = Math.max(0, Math.round((span - net) / 2))

  const flatPoints = points.flat()
  const flatElevations = profiles.flat()
  const count = Math.max(1, Math.min(CLIMATE_MAX_SEGMENTS, Math.round(route.length_km / CLIMATE_SEGMENT_KM)))
  const segments: SeasonSegment[] = []
  const trace: TrailResult['segments'] = []
  for (let index = 0; index < count; index += 1) {
    const from = Math.floor((index * flatPoints.length) / count)
    const to = Math.max(from + 1, Math.floor(((index + 1) * flatPoints.length) / count))
    const elevations = flatElevations.slice(from, to)
    let top = 0
    for (let i = 1; i < elevations.length; i += 1) if (elevations[i] > elevations[top]) top = i
    const [lat, lon] = flatPoints[from + top]
    const altitude = Math.round(altitudeQuantile(elevations, SEASON_ALTITUDE_QUANTILE))
    const normals = await fetchNormals(lat, lon, { rawDir: context.rawDir, stats: context.stats?.climate, log: context.log })
    trace.push({ altitude_m: altitude, cell: normals ? `${normals.lat},${normals.lon}` : null })
    if (normals) segments.push({ altitude_m: altitude, normals })
  }
  // Норм нет хотя бы у одного участка — о сезоне маршрута судить нельзя: факта нет.
  const months = segments.length === count ? passableMonths(segments) : null

  const grade = sacGrade(route.sac_km, route.length_km)
  const stagesKm = route.stages.map((stage) => stage.length_km)
  const effort = estimateEffort({ distance_km: route.length_km, ascent_m: ascent, max_alt_m: stats.max_alt_m, sac: grade, stages_km: stagesKm })
  const [lat, lng] = middleOf(route.chains)
  return {
    record: {
      source_id: qid,
      osm_relation: relation,
      distance_km: route.length_km,
      loop: route.loop,
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5,
      ascent_m: ascent,
      descent_m: descent,
      max_alt_m: stats.max_alt_m,
      min_alt_m: stats.min_alt_m,
      ...(grade ? { grade } : {}),
      ...(effort ? { days: effort.days, ...(effort.days_source === 'estimate' ? { days_estimated: true } : {}), effort_km: effort.effort_km, effort: effort.step, ...(effort.step_by_grade ? { effort_by_grade: true } : {}) } : {}),
      ...(months ? { months } : {}),
    },
    route: { length_km: route.length_km, continuity: route.continuity, loop: route.loop, ways: route.ways, sac_km: route.sac_km, tags: route.tags, chains: route.chains.length, stages_km: stagesKm },
    segments: trace,
  }
}

/** Набор высоты не прошёл сверку на эталонах: из записи уходят набор и всё, что от него посчитано. */
export function withoutAscent(record: OsmLayerRecord): OsmLayerRecord {
  const { ascent_m: _ascent, descent_m: _descent, days: _days, days_estimated: _estimated, effort_km: _effortKm, effort: _effort, effort_by_grade: _byGrade, ...rest } = record
  return rest
}

/**
 * Длина, с которой сверяется геометрия отношения OSM (#3431): длина Wikidata, а когда её нет (319 маршрутов
 * из 781 на индексе 21.11.2026) — тег `distance` самого отношения. Без этого участок выдавался за весь
 * маршрут: Kammweg — 149,8 км при теге 298, Naheweg — 16,1 км при 75. Нет ни того ни другого — сверить нечем.
 */
export const referenceLengthKm = (row: { wd_length_km?: number; tag_distance_km?: number }): number | undefined => {
  const tag = row.tag_distance_km
  return row.wd_length_km ?? (tag !== undefined && Number.isFinite(tag) && tag > 0 ? tag : undefined)
}

/** Геометрия OSM расходится с длиной Wikidata: выбранное отношение — не весь маршрут. */
export const lengthMismatch = (osmKm: number, wdKm: number | undefined): boolean => wdKm !== undefined && wdKm > 0 && Math.abs(osmKm - wdKm) / wdKm > LENGTH_MISMATCH
