/**
 * Геометрия пешего маршрута из отношения OSM через Overpass (#3357, решение C). Данные — ODbL: всё,
 * что отсюда выходит, лежит в слое OSM внешнего индекса (решение H).
 *
 * Известные маршруты в OSM — `type=superroute`: отношение из отношений-этапов и вариантов (Tour du Mont
 * Blanc — основной маршрут и семь вариантов с ролью `alternative`). Запрос спускается на три уровня
 * подотношений; основной маршрут — члены без ролей варианта, подъезда и радиального выхода. Длина —
 * сумма длин разных путей основного маршрута: путь, который входит в два этапа, считается один раз.
 */
import path from 'node:path'

import { SAC_SCALE, type SacScale } from '../../../api/aiAssist/trailFacts.ts'
import { sha256Hex } from '../format.ts'
import { haversineM, lineLengthM, type Point, stitchWays } from './geo.ts'
import { fetchCached, type NetStats } from './net.ts'

export const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'
/** Пауза между запросами: один поток, сервер общий. */
export const OVERPASS_PAUSE_MS = 5000

export const routeQuery = (relationId: number): string =>
  `[out:json][timeout:180];rel(${relationId})->.r0;rel(r.r0)->.r1;rel(r.r1)->.r2;rel(r.r2)->.r3;(.r0;.r1;.r2;.r3;)->.all;.all out body;way(r.all);out tags geom;`

/**
 * Отношения пеших маршрутов с тегом `wikidata` — вторая сторона связи с Wikidata (первая — P402). Часть
 * superroute размечена не `route=hiking`, а `superroute=hiking` (тропы Гонконга): берутся оба способа.
 */
export const TAGGED_QUERY =
  '[out:json][timeout:300];(relation["type"~"^(route|superroute)$"]["route"~"^(hiking|foot)$"]["wikidata"];relation["type"="superroute"]["superroute"~"^(hiking|foot)$"]["wikidata"];);out tags;'

/** Значения тегов `route` и `superroute`, с которыми отношение считается пешим маршрутом. */
export const FOOT_ROUTES: ReadonlySet<string> = new Set(['hiking', 'foot'])

export interface OverpassMember {
  type: 'node' | 'way' | 'relation'
  ref: number
  role: string
}

export interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  tags?: Record<string, string>
  members?: OverpassMember[]
  geometry?: Array<{ lat: number; lon: number } | null>
}

export interface OverpassFetch {
  rawDir: string
  /** Другой экземпляр Overpass API (по умолчанию — основной). */
  endpoint?: string
  /** Только кэш: сеть для этого прохода закрыта. */
  offline?: boolean
  /** Сколько раз повторять запрос к занятому серверу (по умолчанию 8). */
  retries?: number
  stats?: NetStats
  log?: (line: string) => void
}

/**
 * Ответ Overpass годен для кэша: это JSON со списком элементов, запрос не оборван по времени или памяти
 * (такой ответ приходит с кодом 200 и пометкой `remark`), у каждого пути есть геометрия — экземпляр
 * старой версии режим `out geom` не знает и молча отдаёт пути без неё.
 */
export function overpassProblem(body: Buffer): string | null {
  let parsed: { elements?: OverpassElement[]; remark?: string }
  try {
    parsed = JSON.parse(body.toString('utf8'))
  } catch {
    return 'ответ Overpass — не JSON'
  }
  if (!Array.isArray(parsed.elements)) return 'в ответе Overpass нет списка элементов'
  if (parsed.remark && /timed out|out of memory/i.test(parsed.remark)) return `Overpass: ${parsed.remark}`
  if (parsed.elements.some((element) => element.type === 'way' && !Array.isArray(element.geometry))) return 'Overpass отдал пути без геометрии'
  return null
}

async function overpass(query: string, cacheFile: string, options: OverpassFetch): Promise<OverpassElement[]> {
  const body = await fetchCached(options.endpoint ?? OVERPASS_ENDPOINT, {
    cacheFile,
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    pauseMs: OVERPASS_PAUSE_MS,
    // Общий сервер часто отвечает 502 «очередь полна»: ждём дольше, а не шлём чаще.
    retries: options.retries ?? 8,
    retryPauseMs: 30_000,
    offline: options.offline,
    validate: overpassProblem,
    stats: options.stats,
    log: options.log,
  })
  const parsed = JSON.parse(body?.toString('utf8') ?? '{}') as { elements?: OverpassElement[] }
  return parsed.elements ?? []
}

export const fetchRoute = (relationId: number, options: OverpassFetch): Promise<OverpassElement[]> =>
  overpass(routeQuery(relationId), path.join(options.rawDir, 'overpass', `route-${relationId}.json`), options)

export interface TaggedRelation {
  id: number
  qid: string
  type: string
  network?: string
  name?: string
  distance?: string
}

export async function fetchTaggedRelations(options: OverpassFetch): Promise<TaggedRelation[]> {
  // Имя файла кэша несёт отпечаток запроса: изменённый запрос не читает ответ прежнего.
  const elements = await overpass(TAGGED_QUERY, path.join(options.rawDir, 'overpass', `tagged-relations-${sha256Hex(TAGGED_QUERY).slice(0, 8)}.json`), options)
  return elements.flatMap((element) => {
    const qid = /^Q\d+$/.exec(String(element.tags?.wikidata ?? '').trim())?.[0]
    if (!qid) return []
    const { type = '', network, name, distance } = element.tags ?? {}
    return [{ id: element.id, qid, type, ...(network ? { network } : {}), ...(name ? { name } : {}), ...(distance ? { distance } : {}) }]
  })
}

/** Роли члена отношения, который не входит в основной маршрут (вики OSM, `route=hiking`). */
export const SIDE_ROLES: ReadonlySet<string> = new Set(['alternative', 'alternate', 'excursion', 'approach', 'connection', 'variant'])

// Шкала SAC — общая со службой и экраном (`api/aiAssist/trailFacts.ts`).
export { SAC_SCALE, type SacScale }

export interface RouteStage {
  relation: number
  name: string | null
  length_km: number
}

export interface RouteGeometry {
  relation: number
  tags: Record<string, string>
  /** Цепочки основного маршрута в порядке членов отношения. */
  chains: Point[][]
  /** Длина разных путей основного маршрута, км. */
  length_km: number
  /** Доля длины в самой длинной цепочке: 1 — маршрут склеился целиком. */
  continuity: number
  /** Замкнут ли маршрут: начало и конец единственной цепочки ближе 500 м. */
  loop: boolean
  /** Прямые подотношения основного маршрута — этапы, если их два и больше. */
  stages: RouteStage[]
  /** Длина путей по классам `sac_scale`, км; путь без тега сюда не входит. */
  sac_km: Partial<Record<SacScale, number>>
  ways: number
  /**
   * OSM размечает отношение пешим маршрутом: `route` или `superroute` — hiking либо foot; у superroute без
   * этих тегов — все его основные подотношения пешие.
   */
  foot: boolean
}

const round1 = (value: number): number => Math.round(value * 10) / 10

/** Разбор ответа `routeQuery`: основной маршрут, его длина, этапы и классы сложности путей. */
export function assembleRoute(elements: readonly OverpassElement[], relationId: number, ancestors: ReadonlySet<number> = new Set()): RouteGeometry | null {
  const relations = new Map<number, OverpassElement>()
  const ways = new Map<number, OverpassElement>()
  for (const element of elements) {
    if (element.type === 'relation') relations.set(element.id, element)
    else if (element.type === 'way') ways.set(element.id, element)
  }
  const root = relations.get(relationId)
  if (!root) return null

  const seenRelations = new Set<number>()
  const order: number[] = []
  const seenWays = new Set<number>()
  const collect = (relation: OverpassElement): void => {
    if (seenRelations.has(relation.id)) return
    seenRelations.add(relation.id)
    for (const member of relation.members ?? []) {
      if (SIDE_ROLES.has(member.role)) continue
      if (member.type === 'relation') {
        const child = relations.get(member.ref)
        if (child) collect(child)
      } else if (member.type === 'way' && ways.has(member.ref) && !seenWays.has(member.ref)) {
        seenWays.add(member.ref)
        order.push(member.ref)
      }
    }
  }
  collect(root)

  const lineOf = (wayId: number): Point[] => (ways.get(wayId)?.geometry ?? []).flatMap((point) => (point ? [[point.lat, point.lon] as Point] : []))
  const lines = order.map(lineOf).filter((line) => line.length >= 2)
  if (!lines.length) return null
  const chains = stitchWays(lines)
  const lengths = chains.map(lineLengthM)
  const total = lengths.reduce((sum, length) => sum + length, 0)
  const longest = chains[lengths.indexOf(Math.max(...lengths))]

  const sac: Partial<Record<SacScale, number>> = {}
  for (const wayId of order) {
    const scale = ways.get(wayId)?.tags?.sac_scale as SacScale | undefined
    if (scale && SAC_SCALE.includes(scale)) sac[scale] = (sac[scale] ?? 0) + lineLengthM(lineOf(wayId)) / 1000
  }
  for (const key of Object.keys(sac) as SacScale[]) sac[key] = round1(sac[key]!)

  const stages: RouteStage[] = []
  const childKinds: string[] = []
  for (const member of root.members ?? []) {
    if (member.type !== 'relation' || SIDE_ROLES.has(member.role)) continue
    const child = relations.get(member.ref)
    // Отношение, вложенное в собственный этап (ошибка разметки OSM), этапом не считается: без этой проверки
    // разбор этапов уходил в бесконечную рекурсию и маршрут отсеивался переполнением стека.
    if (!child || child.id === relationId || ancestors.has(child.id)) continue
    childKinds.push(child.tags?.route ?? child.tags?.superroute ?? '')
    const own = assembleRoute(elements, child.id, new Set([...ancestors, relationId]))
    if (own) stages.push({ relation: child.id, name: child.tags?.name ?? null, length_km: own.length_km })
  }
  const ownKind = root.tags?.route ?? root.tags?.superroute
  const foot = ownKind !== undefined ? FOOT_ROUTES.has(ownKind) : root.tags?.type === 'superroute' && childKinds.length > 0 && childKinds.every((kind) => FOOT_ROUTES.has(kind))

  return {
    relation: relationId,
    tags: root.tags ?? {},
    chains,
    length_km: round1(total / 1000),
    continuity: total > 0 ? Math.round((Math.max(...lengths) / total) * 100) / 100 : 0,
    loop: chains.length === 1 && haversineM(longest[0], longest[longest.length - 1]) < 500,
    stages: stages.length >= 2 ? stages : [],
    sac_km: sac,
    ways: order.length,
    foot,
  }
}
