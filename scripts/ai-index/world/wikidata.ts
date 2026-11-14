/**
 * Перечень пеших маршрутов мира из Wikidata (CC0) — #3357, решение B.
 *
 * Берутся элементы классов hiking trail / long-distance trail / pilgrims' way с подклассами, у которых
 * есть хотя бы одна статья Википедии или Wikivoyage. Связь с отношением OSM — свойство P402 либо тег
 * `wikidata` на отношении (его добавляет `overpass.ts`); без геометрии маршрут в индекс не идёт.
 *
 * Из Wikidata в карточку идут: названия и псевдонимы на RU/BE/UK/PL/EN, описание элемента, страны (P17),
 * адреса статей, число вики-статей (мера известности для порядка выдачи). Длина P2043 хранится
 * отдельным полем слоя Wikidata и с длиной геометрии OSM в одно поле не сливается (решение H).
 */
import path from 'node:path'

import { fetchCached, type NetStats } from './net.ts'

/** hiking trail, long-distance trail, pilgrims' way. */
export const TRAIL_CLASSES = ['Q2143825', 'Q13405588', 'Q337912'] as const
export const CARD_LOCALES = ['ru', 'be', 'uk', 'pl', 'en'] as const
export type CardLocale = (typeof CARD_LOCALES)[number]

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
const API_ENDPOINT = 'https://www.wikidata.org/w/api.php'
/** 14.11.2026 служба запросов отвечала 429 «1 запрос в минуту»: пауза с запасом. */
export const SPARQL_PAUSE_MS = 65_000
export const ENTITY_BATCH = 50

/** Единицы длины P2043 → метры. */
const UNIT_METERS: Record<string, number> = { Q828224: 1000, Q11573: 1, Q253276: 1609.344, Q3710: 0.3048 }

export interface ClassMember {
  qid: string
  /** Идентификаторы отношений OSM из P402 (у элемента их бывает несколько). */
  osm: number[]
}

export const classQuery = (classId: string): string =>
  `SELECT ?item ?osm WHERE { ?item wdt:P31/wdt:P279* wd:${classId} ; wikibase:sitelinks ?links . FILTER(?links > 0) OPTIONAL { ?item wdt:P402 ?osm } }`

/** Разбор ответа SPARQL в формате TSV: `<…/Q24777>\t"124456"`. */
export function parseClassTsv(tsv: string): ClassMember[] {
  const byQid = new Map<string, Set<number>>()
  for (const line of tsv.split('\n').slice(1)) {
    const [item, osm] = line.split('\t')
    const qid = /\/(Q\d+)>/.exec(item ?? '')?.[1]
    if (!qid) continue
    const ids = byQid.get(qid) ?? new Set<number>()
    const relation = Number.parseInt(String(osm ?? '').replace(/"/g, ''), 10)
    if (Number.isInteger(relation) && relation > 0) ids.add(relation)
    byQid.set(qid, ids)
  }
  return [...byQid].map(([qid, ids]) => ({ qid, osm: [...ids].sort((a, b) => a - b) }))
}

export interface WikidataFetch {
  rawDir: string
  stats?: NetStats
  log?: (line: string) => void
}

export async function fetchClassMembers(classId: string, options: WikidataFetch): Promise<ClassMember[]> {
  const body = await fetchCached(`${SPARQL_ENDPOINT}?query=${encodeURIComponent(classQuery(classId))}`, {
    cacheFile: path.join(options.rawDir, 'wikidata', `class-${classId}.tsv`),
    headers: { accept: 'text/tab-separated-values' },
    pauseMs: SPARQL_PAUSE_MS,
    retries: 4,
    retryPauseMs: SPARQL_PAUSE_MS,
    stats: options.stats,
    log: options.log,
  })
  return parseClassTsv(body?.toString('utf8') ?? '')
}

interface RawSnak {
  mainsnak?: { datavalue?: { value?: unknown } }
  rank?: string
}

export interface RawEntity {
  id: string
  labels?: Record<string, { value: string }>
  aliases?: Record<string, Array<{ value: string }>>
  descriptions?: Record<string, { value: string }>
  claims?: Record<string, RawSnak[]>
  sitelinks?: Record<string, { title: string; url?: string }>
}

export interface TrailArticle {
  /** Ключ сайта Wikimedia: `enwiki`, `ruwikivoyage`. */
  site: string
  lang: string
  kind: 'wikipedia' | 'wikivoyage'
  title: string
  url: string
}

/**
 * Свойства Wikidata, которыми элемент маршрута называет своё место: административная единица (P131, вверх
 * по ней — регион и часть страны), форма рельефа (P706), горная система (P4552), «часть от» (P361) и
 * «место» (P276). По ним «West Highland Way» находится на вопрос о Шотландии, а «GR 20» — о Корсике.
 */
export const PLACE_PROPS = { P131: 'admin', P706: 'terrain', P4552: 'range', P361: 'part', P276: 'location' } as const
export type PlaceKind = (typeof PLACE_PROPS)[keyof typeof PLACE_PROPS]

export interface PlaceRef {
  qid: string
  kind: PlaceKind
}

/** Место маршрута ниже страны: регион, остров, горная система — с названиями на языках сайта. */
export interface TrailPlace {
  qid: string
  names: Partial<Record<CardLocale, string>>
  kind: PlaceKind
}

export interface WikidataTrail {
  qid: string
  labels: Partial<Record<CardLocale, string>>
  aliases: Partial<Record<CardLocale, string[]>>
  descriptions: Partial<Record<CardLocale, string>>
  /** QID стран (P17) в порядке элемента. */
  countries: string[]
  /** Отношения OSM из P402. */
  osm: number[]
  /** Длина P2043, км — слой Wikidata; в карточку как длина маршрута не идёт. */
  wd_length_km?: number
  /** Статьи Википедии и Wikivoyage на всех языках. */
  articles: TrailArticle[]
  /** Ссылки элемента на свои места (`PLACE_PROPS`) — исходные точки цепочки мест. */
  place_refs: PlaceRef[]
}

const snakValues = (entity: RawEntity, property: string): unknown[] =>
  (entity.claims?.[property] ?? []).filter((claim) => claim.rank !== 'deprecated').map((claim) => claim.mainsnak?.datavalue?.value).filter((value) => value !== undefined)

const SITE_RE = /^([a-z_]+?)(wiki|wikivoyage)$/
/** Служебные проекты с ключом на `wiki`: статьёй о маршруте не считаются. */
const NOT_ARTICLES = new Set(['commonswiki', 'wikidatawiki', 'specieswiki', 'metawiki', 'mediawikiwiki', 'sourceswiki', 'foundationwiki', 'outreachwiki', 'incubatorwiki'])

export function articlesOf(entity: RawEntity): TrailArticle[] {
  const out: TrailArticle[] = []
  for (const [site, link] of Object.entries(entity.sitelinks ?? {})) {
    const match = SITE_RE.exec(site)
    if (!match || NOT_ARTICLES.has(site) || !link.url) continue
    out.push({ site, lang: match[1].replace(/_/g, '-'), kind: match[2] === 'wiki' ? 'wikipedia' : 'wikivoyage', title: link.title, url: link.url })
  }
  return out.sort((a, b) => a.site.localeCompare(b.site))
}

/** Длина P2043 в километрах: первое значение с известной единицей; без единицы числа нет. */
export function lengthKmOf(entity: RawEntity): number | undefined {
  for (const value of snakValues(entity, 'P2043')) {
    const { amount, unit } = (value ?? {}) as { amount?: string; unit?: string }
    const meters = UNIT_METERS[String(unit ?? '').split('/').pop() ?? '']
    const number = Number(amount)
    if (meters && Number.isFinite(number) && number > 0) return Math.round(((number * meters) / 1000) * 10) / 10
  }
  return undefined
}

export function parseEntity(entity: RawEntity): WikidataTrail {
  const pick = <T>(source: Record<string, T> | undefined, map: (value: T) => string | string[]) => {
    const out: Record<string, string | string[]> = {}
    for (const locale of CARD_LOCALES) {
      const value = source?.[locale]
      if (value === undefined) continue
      const mapped = map(value)
      if (Array.isArray(mapped) ? mapped.length : mapped) out[locale] = mapped
    }
    return out
  }
  const length = lengthKmOf(entity)
  return {
    qid: entity.id,
    labels: pick(entity.labels, (label) => label.value.trim()) as WikidataTrail['labels'],
    aliases: pick(entity.aliases, (list) => [...new Set(list.map((alias) => alias.value.trim()).filter(Boolean))]) as WikidataTrail['aliases'],
    descriptions: pick(entity.descriptions, (description) => description.value.trim()) as WikidataTrail['descriptions'],
    countries: [...new Set(snakValues(entity, 'P17').map((value) => String((value as { id?: string })?.id ?? '')).filter(Boolean))],
    osm: [...new Set(snakValues(entity, 'P402').map((value) => Number.parseInt(String(value), 10)).filter((id) => Number.isInteger(id) && id > 0))],
    ...(length !== undefined ? { wd_length_km: length } : {}),
    articles: articlesOf(entity),
    place_refs: placeRefsOf(entity),
  }
}

const itemIds = (entity: RawEntity, property: string): string[] => [...new Set(snakValues(entity, property).map((value) => String((value as { id?: string })?.id ?? '')).filter((id) => /^Q\d+$/.test(id)))]

/** Ссылки элемента на места по всем свойствам `PLACE_PROPS`, без повторов. */
export function placeRefsOf(entity: RawEntity): PlaceRef[] {
  const seen = new Set<string>()
  const out: PlaceRef[] = []
  for (const [property, kind] of Object.entries(PLACE_PROPS) as Array<[string, PlaceKind]>) {
    for (const qid of itemIds(entity, property)) {
      if (seen.has(qid)) continue
      seen.add(qid)
      out.push({ qid, kind })
    }
  }
  return out
}

/**
 * Суверенное государство и часть света: место «ниже страны» ими не бывает, цепочка на них кончается. Класс
 * «страна» (Q6256) сюда не входит: им помечены и Шотландия, Англия, Уэльс — как раз те места, ради которых
 * цепочка строится; сами страны маршрутов отсекает `PlaceRules.countries`.
 */
const TOP_LEVEL_CLASSES = new Set(['Q3624078', 'Q5107'])
/** Глубина цепочки мест от маршрута и предел числа мест у одного маршрута. */
export const PLACE_MAX_DEPTH = 4
export const PLACE_MAX_PER_TRAIL = 24

/** Куда цепочка идёт дальше от места: у административной единицы — вверх по P131, у рельефа — к горной системе и целому. */
export function parentRefsOf(entity: RawEntity, kind: PlaceKind): PlaceRef[] {
  if (kind === 'admin' || kind === 'location') return itemIds(entity, 'P131').map((qid) => ({ qid, kind: 'admin' as const }))
  return [...itemIds(entity, 'P4552').map((qid) => ({ qid, kind: 'range' as const })), ...itemIds(entity, 'P361').map((qid) => ({ qid, kind: 'part' as const }))]
}

export interface PlaceRules {
  /** QID стран всех маршрутов: страна в места не идёт — она у карточки отдельным полем. */
  countries: ReadonlySet<string>
  /** QID, которые местом не считаются: сами маршруты перечня («часть от» у тропы — часто сеть троп). */
  exclude: ReadonlySet<string>
}

/** Страна маршрутов, суверенное государство, часть света либо упразднённое образование (у него есть дата конца, P576). */
const isTopLevel = (entity: RawEntity, rules: PlaceRules): boolean =>
  rules.countries.has(entity.id) || itemIds(entity, 'P31').some((id) => TOP_LEVEL_CLASSES.has(id)) || snakValues(entity, 'P576').length > 0

/**
 * Места маршрута: от ссылок элемента вверх по цепочке не глубже `PLACE_MAX_DEPTH`, до страны. «Часть от»
 * и «место» берутся, только когда это географический объект с координатами (сеть троп и организация их
 * не имеют). Порядок: рельеф и горные системы, затем административные единицы — в каждой группе от
 * крупных к мелким: первые места списка самые узнаваемые.
 */
export function resolvePlaces(refs: readonly PlaceRef[], entities: ReadonlyMap<string, RawEntity>, rules: PlaceRules): TrailPlace[] {
  const seen = new Set<string>()
  const found: Array<TrailPlace & { depth: number }> = []
  let level: PlaceRef[] = [...refs]
  for (let depth = 1; depth <= PLACE_MAX_DEPTH && level.length; depth += 1) {
    const next: PlaceRef[] = []
    for (const ref of level) {
      if (seen.has(ref.qid)) continue
      seen.add(ref.qid)
      const entity = entities.get(ref.qid)
      if (!entity || rules.exclude.has(ref.qid) || isTopLevel(entity, rules)) continue
      if ((ref.kind === 'part' || ref.kind === 'location') && !snakValues(entity, 'P625').length) continue
      const names: TrailPlace['names'] = {}
      for (const locale of CARD_LOCALES) {
        const value = entity.labels?.[locale]?.value?.trim()
        if (value) names[locale] = value
      }
      if (Object.keys(names).length) found.push({ qid: ref.qid, names, kind: ref.kind, depth })
      next.push(...parentRefsOf(entity, ref.kind))
    }
    level = next
  }
  // Крупное — первым: «Альпы» раньше «Массива Монблан», «Шотландия» раньше округа.
  const relief = found.filter((place) => place.kind !== 'admin').sort((a, b) => b.depth - a.depth)
  const admin = found.filter((place) => place.kind === 'admin').sort((a, b) => b.depth - a.depth)
  return [...relief, ...admin].slice(0, PLACE_MAX_PER_TRAIL).map(({ depth: _depth, ...place }) => place)
}

export const PLACE_ENTITY_PROPS = 'labels|claims'

/**
 * Элементы мест по уровням цепочки: уровень — одна доборка пачками, следующий уровень — родители
 * найденных. Запрашивается надмножество (правила отбора применяет `resolvePlaces`); на стране и части
 * света цепочка не продолжается.
 */
export async function fetchPlaceEntities(start: readonly PlaceRef[], rules: PlaceRules, options: WikidataFetch): Promise<Map<string, RawEntity>> {
  const all = new Map<string, RawEntity>()
  const kinds = new Map<string, Set<PlaceKind>>()
  const note = (ref: PlaceRef): void => {
    const set = kinds.get(ref.qid) ?? new Set<PlaceKind>()
    set.add(ref.kind)
    kinds.set(ref.qid, set)
  }
  start.forEach(note)
  let level = [...new Set(start.map((ref) => ref.qid))]
  for (let depth = 1; depth <= PLACE_MAX_DEPTH && level.length; depth += 1) {
    const fetched = await fetchEntities(level.filter((qid) => !all.has(qid)), PLACE_ENTITY_PROPS, options)
    const next = new Set<string>()
    for (const qid of level) {
      const entity = fetched.get(qid) ?? all.get(qid)
      if (!entity) continue
      all.set(qid, entity)
      if (rules.exclude.has(qid) || isTopLevel(entity, rules)) continue
      for (const kind of kinds.get(qid) ?? []) {
        for (const parent of parentRefsOf(entity, kind)) {
          note(parent)
          if (!all.has(parent.qid)) next.add(parent.qid)
        }
      }
    }
    options.log?.(`места Wikidata, уровень ${depth}: элементов ${level.length}, дальше ${next.size}`)
    level = [...next]
  }
  return all
}

/** Элементы пачками по 50 (`wbgetentities`); сырой ответ пачки — в кэше по её первому и последнему QID. */
export async function fetchEntities(qids: readonly string[], props: string, options: WikidataFetch): Promise<Map<string, RawEntity>> {
  const out = new Map<string, RawEntity>()
  const sorted = [...new Set(qids)].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
  for (let start = 0; start < sorted.length; start += ENTITY_BATCH) {
    const batch = sorted.slice(start, start + ENTITY_BATCH)
    const query = new URLSearchParams({ action: 'wbgetentities', format: 'json', ids: batch.join('|'), props, languages: CARD_LOCALES.join('|') })
    const body = await fetchCached(`${API_ENDPOINT}?${query}`, {
      cacheFile: path.join(options.rawDir, 'wikidata', 'entities', `${props.replace(/\W+/g, '_')}-${batch[0]}-${batch.at(-1)}-${batch.length}.json`),
      pauseMs: 1000,
      stats: options.stats,
      log: options.log,
    })
    const parsed = JSON.parse(body?.toString('utf8') ?? '{}') as { entities?: Record<string, RawEntity> }
    for (const entity of Object.values(parsed.entities ?? {})) if (entity?.id) out.set(entity.id, entity)
  }
  return out
}

export const TRAIL_PROPS = 'labels|aliases|descriptions|claims|sitelinks/urls'

/**
 * Адрес статьи карточки на языке вопроса (решение B): Википедия на этом языке, затем Wikivoyage на нём
 * же, затем английские; если нет и их — первая статья по списку запасных языков, иначе любая. Язык
 * выбранной статьи возвращается: экран подписывает ссылку «Википедия (de)».
 */
const FALLBACK_LANGS = ['en', 'de', 'fr', 'es', 'it', 'pl', 'ru', 'uk', 'nl', 'cs', 'sv', 'no', 'pt', 'ja']

export function articleFor(articles: readonly TrailArticle[], locale: CardLocale): TrailArticle | null {
  const find = (lang: string, kind: TrailArticle['kind']) => articles.find((article) => article.lang === lang && article.kind === kind)
  for (const lang of [locale, ...FALLBACK_LANGS]) {
    const hit = find(lang, 'wikipedia') ?? find(lang, 'wikivoyage')
    if (hit) return hit
  }
  return articles[0] ?? null
}
