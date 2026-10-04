// #2119: корпус эталонов PDF-книги — общий для web-теста (jsdom) и native-теста
// (окружение `node`, без DOM): оба читают одни и те же входы и сравнивают
// результат с одними и теми же эталонными файлами в `golden/`.
import fs from 'fs'
import path from 'path'

import type { Travel } from '@/types/types'

import { PDF_BOOK_EDGE_CASES, PIPELINE_EDGE_CASE_NAMES } from './edgeCases'

export const PDF_BOOK_FIXTURES_DIR = __dirname
export const PDF_BOOK_GOLDEN_DIR = path.join(PDF_BOOK_FIXTURES_DIR, 'golden')

const REAL_TRAVELS_DIR = path.join(PDF_BOOK_FIXTURES_DIR, 'realTravels')

export const RICH_TEXT_FIELDS = ['description', 'recommendation', 'plus', 'minus'] as const
export type RichTextField = (typeof RICH_TEXT_FIELDS)[number]

/**
 * Срез ответа `GET /api/travels/<id>/` (снят 04.10.2026): rich-text поля, галерея,
 * точки и обложка — как отдал бэкенд. Отличия от сырого ответа: служебное
 * `__draft_placeholder__` приведено к пустой строке (так делает
 * `api/travelsNormalize.ts`), `userName` заменён на нейтральный.
 */
export type RealTravelFixture = {
  id: number
  name: string
  slug: string
  url: string
  year: string | number
  monthName: string
  number_days: number
  countryName: string
  cityName: string
  countryCode: string
  youtube_link: string
  userName: string
  travel_image_thumb_url: string
  travel_image_thumb_small_url: string
  travel_image_print_url: string
  description: string
  recommendation: string
  plus: string
  minus: string
  gallery: Array<{ id: number; url: string; thumb_url: string; print_url: string; order: number; caption: string }>
  travelAddress: Array<{ id: number; address: string; coord: string; categoryName: string; travelImageThumbUrl: string }>
}

export function loadRealTravelFixtures(): RealTravelFixture[] {
  return fs
    .readdirSync(REAL_TRAVELS_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(fs.readFileSync(path.join(REAL_TRAVELS_DIR, file), 'utf8')) as RealTravelFixture)
    .sort((a, b) => a.id - b.id)
}

export function toTravel(fixture: RealTravelFixture): Travel {
  return { ...fixture, countUnicIpView: '0', userIds: '', companions: [] } as unknown as Travel
}

const edgeCaseHtml = (name: string): string => {
  const found = PDF_BOOK_EDGE_CASES.find((item) => item.name === name)
  if (!found) throw new Error(`Нет синтетического случая «${name}» в edgeCases.ts`)
  return found.html
}

const joinEdgeCases = (names: readonly string[]): string =>
  names.map((name) => `<h3>${name}</h3>${edgeCaseHtml(name)}`).join('')

/**
 * Синтетическое путешествие: случаи из `PIPELINE_EDGE_CASE_NAMES` разложены по
 * всем четырём rich-text полям, чтобы каждое прошло санитайзер, разбор и рендер.
 */
export function buildEdgeCaseTravel(): Travel {
  const names = [...PIPELINE_EDGE_CASE_NAMES]
  const quarter = Math.ceil(names.length / 4)
  return {
    id: 900001,
    name: 'Синтетические случаи разметки',
    slug: 'pdf-book-edge-cases',
    url: '/travels/pdf-book-edge-cases',
    year: '2026',
    monthName: 'Октябрь',
    number_days: 2,
    countryName: 'Беларусь',
    cityName: 'Минск',
    countryCode: 'BY',
    youtube_link: '',
    userName: 'MeTravel',
    travel_image_thumb_url: '/travel-image/900001/conversions/cover.webp',
    travel_image_thumb_small_url: '/travel-image/900001/conversions/cover-small.webp',
    description: joinEdgeCases(names.slice(0, quarter)),
    recommendation: joinEdgeCases(names.slice(quarter, quarter * 2)),
    plus: joinEdgeCases(names.slice(quarter * 2, quarter * 3)),
    minus: joinEdgeCases(names.slice(quarter * 3)),
    gallery: [
      { id: 1, url: 'https://metravel.by/gallery/900001/gallery/one.webp', caption: 'Подпись «один»' },
      { id: 2, url: '/gallery/900001/gallery/two.webp', caption: '' },
      'https://example.com/foreign/three.jpg',
    ],
    travelAddress: [
      { id: 1, address: 'Минск, площадь Свободы', coord: '53.9031,27.5566', categoryName: 'Площадь' },
      { id: 2, address: 'Точка без координат', coord: '' },
    ],
    countUnicIpView: '0',
    userIds: '',
    companions: [],
  } as unknown as Travel
}

export type ParseCorpusDocument = {
  /** Имя эталонного файла в `golden/parse/` (без расширения). */
  group: string
  /** Ключ документа внутри эталонного файла. */
  key: string
  html: string
}

/** Все входы `ContentParser.parse()`: поля реальных путешествий и синтетика. */
export function loadParseCorpus(): ParseCorpusDocument[] {
  const documents: ParseCorpusDocument[] = []
  for (const travel of loadRealTravelFixtures()) {
    for (const field of RICH_TEXT_FIELDS) {
      if (!travel[field]) continue
      documents.push({ group: `real-${travel.id}`, key: field, html: travel[field] })
    }
  }
  for (const edgeCase of PDF_BOOK_EDGE_CASES) {
    documents.push({ group: 'edge', key: edgeCase.name, html: edgeCase.html })
  }
  return documents
}

export function groupParseCorpus(documents: ParseCorpusDocument[]): Map<string, ParseCorpusDocument[]> {
  const groups = new Map<string, ParseCorpusDocument[]>()
  for (const document of documents) {
    const bucket = groups.get(document.group)
    if (bucket) bucket.push(document)
    else groups.set(document.group, [document])
  }
  return groups
}
