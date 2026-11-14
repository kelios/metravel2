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
  }
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
