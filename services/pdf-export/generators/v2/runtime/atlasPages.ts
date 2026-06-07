// services/pdf-export/generators/v2/runtime/atlasPages.ts
// Атлас путешествий: глобальная карта со всеми точками книги + указатель «точки → страница»

import type { PdfThemeConfig } from '../../../themes/PdfThemeConfig'
import { escapeHtml as sharedEscapeHtml } from '../../../utils/htmlUtils'
import type { NormalizedLocation, TravelSectionMeta } from './types'

// Палитра обложечных «журнальных» цветов для маркировки путешествий на карте/в указателе
const TRAVEL_PALETTE = [
  '#D2604A',
  '#3F7CAC',
  '#D9A445',
  '#5E8C5A',
  '#A85A8E',
  '#2F7E73',
  '#B23A48',
  '#5C5AA8',
]

// Сколько travel-групп с map-точками нужно, чтобы атлас был полезен
const MIN_TRAVELS_FOR_ATLAS = 2

// Эвристика пакетирования указателя по страницам
// Каждое путешествие на странице указателя занимает: 2 строки на заголовок + ceil(N/2) строк на 2-колоночный список точек
const INDEX_ROWS_PER_PAGE = 22

type AtlasTravelEntry = {
  meta: TravelSectionMeta
  color: string
  travelOrdinal: number
  pointsWithCoords: NormalizedLocation[]
  pointCount: number
  rowsOnIndexPage: number
}

export interface RenderAtlasPagesArgs {
  meta: TravelSectionMeta[]
  theme: PdfThemeConfig
  bookTitle?: string
  startPageNumber: number
  escapeHtml?: (value: string) => string
}

export function getAtlasTravelsWithMap(meta: TravelSectionMeta[]): TravelSectionMeta[] {
  return meta.filter(
    (item) =>
      item.hasMap &&
      item.locations.some(
        (l) => typeof l.lat === 'number' && typeof l.lng === 'number',
      ),
  )
}

export function shouldRenderAtlas(meta: TravelSectionMeta[], includeMap: boolean): boolean {
  if (!includeMap) return false
  return getAtlasTravelsWithMap(meta).length >= MIN_TRAVELS_FOR_ATLAS
}

function buildEntries(meta: TravelSectionMeta[]): AtlasTravelEntry[] {
  const atlasTravels = getAtlasTravelsWithMap(meta)
  return atlasTravels.map((item, idx) => {
    const pointsWithCoords = item.locations.filter(
      (l) => typeof l.lat === 'number' && typeof l.lng === 'number',
    )
    const pointCount = item.locations.length
    const headerRows = 2
    const listRows = Math.ceil(Math.max(1, pointCount) / 2)
    return {
      meta: item,
      color: TRAVEL_PALETTE[idx % TRAVEL_PALETTE.length],
      travelOrdinal: idx + 1,
      pointsWithCoords,
      pointCount,
      rowsOnIndexPage: headerRows + listRows + 1, // +1 — отступ между группами
    }
  })
}

function chunkEntriesForIndex(entries: AtlasTravelEntry[]): AtlasTravelEntry[][] {
  const pages: AtlasTravelEntry[][] = []
  let current: AtlasTravelEntry[] = []
  let rowsLeft = INDEX_ROWS_PER_PAGE
  for (const entry of entries) {
    if (entry.rowsOnIndexPage > INDEX_ROWS_PER_PAGE) {
      // Группа больше страницы — кладём отдельной страницей (CSS-overflow прижмёт)
      if (current.length) {
        pages.push(current)
        current = []
        rowsLeft = INDEX_ROWS_PER_PAGE
      }
      pages.push([entry])
      continue
    }
    if (entry.rowsOnIndexPage > rowsLeft && current.length) {
      pages.push(current)
      current = []
      rowsLeft = INDEX_ROWS_PER_PAGE
    }
    current.push(entry)
    rowsLeft -= entry.rowsOnIndexPage
  }
  if (current.length) pages.push(current)
  return pages.length ? pages : [[]]
}

export function getAtlasPageCount(meta: TravelSectionMeta[]): number {
  const entries = buildEntries(meta)
  if (entries.length < MIN_TRAVELS_FOR_ATLAS) return 0
  const indexPages = chunkEntriesForIndex(entries).length
  return 1 + indexPages
}

// ──────────────────────────────────────────────────────────────────────────────
// SVG глобальной карты со всеми точками книги
// ──────────────────────────────────────────────────────────────────────────────

type ProjectedPoint = {
  x: number
  y: number
  travelOrdinal: number
  pointOrdinal: number
  color: string
  label: string
}

function projectAtlasPoints(entries: AtlasTravelEntry[]): {
  points: ProjectedPoint[]
  viewBoxW: number
  viewBoxH: number
} {
  const viewBoxW = 200
  const viewBoxH = 120
  const paddingX = 10
  const paddingY = 10

  const flat: Array<{
    lat: number
    lng: number
    travelOrdinal: number
    pointOrdinal: number
    color: string
    label: string
  }> = []
  for (const entry of entries) {
    entry.pointsWithCoords.forEach((point, idx) => {
      flat.push({
        lat: point.lat as number,
        lng: point.lng as number,
        travelOrdinal: entry.travelOrdinal,
        pointOrdinal: idx + 1,
        color: entry.color,
        label: point.address || '',
      })
    })
  }

  if (!flat.length) return { points: [], viewBoxW, viewBoxH }

  const lats = flat.map((p) => p.lat)
  const lngs = flat.map((p) => p.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const latRange = Math.max(0.0001, maxLat - minLat)
  const lngRange = Math.max(0.0001, maxLng - minLng)
  const innerW = viewBoxW - paddingX * 2
  const innerH = viewBoxH - paddingY * 2

  const points: ProjectedPoint[] = flat.map((p) => ({
    x: paddingX + ((p.lng - minLng) / lngRange) * innerW,
    y: paddingY + ((maxLat - p.lat) / latRange) * innerH,
    travelOrdinal: p.travelOrdinal,
    pointOrdinal: p.pointOrdinal,
    color: p.color,
    label: p.label,
  }))

  return { points, viewBoxW, viewBoxH }
}

function buildAtlasMapSvg(
  entries: AtlasTravelEntry[],
  theme: PdfThemeConfig,
): string {
  const { colors } = theme
  const { points, viewBoxW, viewBoxH } = projectAtlasPoints(entries)

  if (!points.length) {
    return `
      <svg viewBox="0 0 ${viewBoxW} ${viewBoxH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Атлас">
        <rect x="0" y="0" width="${viewBoxW}" height="${viewBoxH}" rx="6" fill="${colors.surfaceAlt}" />
        <text x="${viewBoxW / 2}" y="${viewBoxH / 2}" text-anchor="middle" font-size="6" fill="${colors.textMuted}">
          Недостаточно координат для атласа
        </text>
      </svg>
    `
  }

  // Маркеры
  const markers = points
    .map((p) => {
      const px = p.x.toFixed(2)
      return `
        <g>
          <path
            d="M ${px} ${(p.y - 0.6).toFixed(2)} c -2.4 0 -4.2 1.9 -4.2 4.2 c 0 3.4 4.2 7.8 4.2 7.8 s 4.2 -4.4 4.2 -7.8 c 0 -2.3 -1.8 -4.2 -4.2 -4.2 z"
            fill="${p.color}"
            stroke="#FFFFFF"
            stroke-width="0.6"
          />
          <circle cx="${px}" cy="${(p.y + 2.5).toFixed(2)}" r="2.6" fill="#FFFFFF" stroke="${p.color}" stroke-width="0.8" />
          <text x="${px}" y="${(p.y + 3.25).toFixed(2)}" text-anchor="middle" font-size="3" font-weight="800" fill="${p.color}" font-family="Georgia, serif">
            ${p.pointOrdinal}
          </text>
        </g>
      `
    })
    .join('')

  // Декоративный «бумажный» фон карты — мягкие волны и сетка широт
  const decorLines = Array.from({ length: 5 })
    .map((_, i) => {
      const yPos = (viewBoxH / 6) * (i + 1)
      return `<line x1="0" y1="${yPos}" x2="${viewBoxW}" y2="${yPos}" stroke="${colors.borderLight || colors.border}" stroke-width="0.35" stroke-dasharray="1 2" opacity="0.55" />`
    })
    .join('')
  const decorMeridians = Array.from({ length: 5 })
    .map((_, i) => {
      const xPos = (viewBoxW / 6) * (i + 1)
      return `<line x1="${xPos}" y1="0" x2="${xPos}" y2="${viewBoxH}" stroke="${colors.borderLight || colors.border}" stroke-width="0.35" stroke-dasharray="1 2" opacity="0.45" />`
    })
    .join('')

  return `
    <svg viewBox="0 0 ${viewBoxW} ${viewBoxH}" preserveAspectRatio="xMidYMid meet" overflow="hidden" role="img" aria-label="Карта всех точек книги">
      <defs>
        <linearGradient id="atlasBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colors.surfaceAlt}" />
          <stop offset="100%" stop-color="${colors.accentLight}" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${viewBoxW}" height="${viewBoxH}" rx="5" fill="url(#atlasBg)" />
      ${decorMeridians}
      ${decorLines}
      <path d="M 0 ${viewBoxH * 0.78} C ${viewBoxW * 0.18} ${viewBoxH * 0.71}, ${viewBoxW * 0.36} ${viewBoxH * 0.85}, ${viewBoxW * 0.55} ${viewBoxH * 0.76} S ${viewBoxW * 0.88} ${viewBoxH * 0.68}, ${viewBoxW} ${viewBoxH * 0.75} L ${viewBoxW} ${viewBoxH} L 0 ${viewBoxH} Z" fill="${colors.surface}" opacity="0.55" />
      ${markers}
    </svg>
  `
}

// ──────────────────────────────────────────────────────────────────────────────
// HTML страницы атласа
// ──────────────────────────────────────────────────────────────────────────────

function renderAtlasMapPage({
  entries,
  theme,
  pageNumber,
  totalAtlasPages,
  bookTitle,
  escapeHtml,
}: {
  entries: AtlasTravelEntry[]
  theme: PdfThemeConfig
  pageNumber: number
  totalAtlasPages: number
  bookTitle?: string
  escapeHtml: (value: string) => string
}): string {
  const { colors, typography, spacing } = theme

  const totalTravels = entries.length
  const totalPoints = entries.reduce((sum, e) => sum + e.pointCount, 0)
  const countries = new Set(
    entries.map((e) => e.meta.travel.countryName).filter(Boolean),
  ).size

  const statKicker = [
    `${totalTravels} ${pluralRu(totalTravels, ['путешествие', 'путешествия', 'путешествий'])}`,
    `${totalPoints} ${pluralRu(totalPoints, ['точка', 'точки', 'точек'])}`,
    countries > 0 ? `${countries} ${pluralRu(countries, ['страна', 'страны', 'стран'])}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  const mapSvg = buildAtlasMapSvg(entries, theme)

  const legendChips = entries
    .map((entry) => {
      const travel = entry.meta.travel
      const name = escapeHtml(travel.name || `Путешествие ${entry.travelOrdinal}`)
      return `
        <div style="
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 999px;
          background: ${colors.surface};
          border: 1px solid ${colors.border};
          font-family: ${typography.bodyFont};
          font-size: 8.5pt;
          color: ${colors.text};
          break-inside: avoid;
        ">
          <span style="
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: ${entry.color};
            color: #FFFFFF;
            font-weight: 800;
            font-size: 7.5pt;
            font-family: ${typography.headingFont};
            flex-shrink: 0;
          ">${entry.travelOrdinal}</span>
          <span style="
            font-weight: 600;
            max-width: 110px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          ">${name}</span>
          <span style="
            font-size: 7.5pt;
            color: ${colors.textMuted};
            font-family: ${typography.bodyFont};
          ">стр. ${entry.meta.mapPage ?? entry.meta.startPage + 2}</span>
        </div>
      `
    })
    .join('')

  return `
    <section class="pdf-page atlas-page atlas-map-page" style="
      padding: ${spacing.pagePadding};
      background: ${colors.background};
      display: flex;
      flex-direction: column;
    ">
      <div style="
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 5mm;
        margin-bottom: 6mm;
        border-bottom: 2px solid ${colors.text};
      ">
        <div>
          <div style="
            font-size: 8pt;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: ${colors.accent};
            font-family: ${typography.bodyFont};
            margin-bottom: 3mm;
          ">${bookTitle ? escapeHtml(bookTitle) + ' · ' : ''}Атлас</div>
          <h2 style="
            font-size: 30pt;
            font-weight: 800;
            color: ${colors.text};
            letter-spacing: -0.03em;
            font-family: ${typography.headingFont};
            line-height: 1;
            margin: 0;
          ">Все точки на карте</h2>
          <p style="
            margin: 3mm 0 0 0;
            color: ${colors.textMuted};
            font-size: 9.5pt;
            font-family: ${typography.bodyFont};
            line-height: 1.4;
            max-width: 130mm;
          ">Общий маршрут книги — на одной карте. Точки сгруппированы по путешествиям, а на следующих страницах вы найдёте указатель с номерами страниц.</p>
        </div>
        <div style="
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2mm;
          padding-bottom: 2px;
        ">
          <div style="
            font-size: 7.5pt;
            color: ${colors.textMuted};
            font-family: ${typography.bodyFont};
            letter-spacing: 0.14em;
            text-transform: uppercase;
            font-weight: 700;
          ">Содержание · Карта</div>
          <div style="
            font-size: 9pt;
            color: ${colors.text};
            font-family: ${typography.bodyFont};
            font-weight: 600;
            text-align: right;
          ">${escapeHtml(statKicker)}</div>
        </div>
      </div>

      <div style="
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 5mm;
        min-height: 0;
      ">
        <div style="
          flex: 1;
          background: ${colors.surface};
          border: 1px solid ${colors.border};
          border-radius: 14px;
          box-shadow: ${theme.blocks.shadow};
          padding: 8px;
          min-height: 150mm;
          position: relative;
          overflow: hidden;
        ">
          <div style="
            width: 100%;
            height: 100%;
            border-radius: 10px;
            overflow: hidden;
            background: ${colors.surfaceAlt};
          ">
            ${mapSvg}
          </div>
          <div style="
            position: absolute;
            top: 14px;
            right: 14px;
            padding: 4px 9px;
            border-radius: 999px;
            background: rgba(255,255,255,0.85);
            border: 1px solid ${colors.border};
            font-family: ${typography.bodyFont};
            font-size: 7.5pt;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: ${colors.text};
          ">N ↑</div>
        </div>

        <div>
          <div style="
            font-size: 7.5pt;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: ${colors.textMuted};
            font-family: ${typography.bodyFont};
            margin-bottom: 3mm;
          ">Легенда путешествий</div>
          <div style="
            display: flex;
            flex-wrap: wrap;
            gap: 5px 6px;
          ">${legendChips}</div>
        </div>
      </div>

      <div style="
        margin-top: 5mm;
        padding-top: 4mm;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
      ">
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1.5px;
          background: linear-gradient(90deg, ${colors.accent}, ${colors.border} 40%, transparent);
          border-radius: 999px;
        "></div>
        <span style="
          font-size: 8pt;
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
          letter-spacing: 0.06em;
          font-weight: 600;
        ">METRAVEL.BY · АТЛАС 1 / ${totalAtlasPages}</span>
        <span style="
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 6px;
          background: ${colors.accentSoft};
          color: ${colors.accentStrong};
          font-size: 8pt;
          font-weight: 700;
          font-family: ${typography.headingFont};
        " data-page-num>${pageNumber}</span>
      </div>
    </section>
  `
}

function renderAtlasIndexPage({
  pageEntries,
  theme,
  pageNumber,
  pageIndex,
  totalAtlasPages,
  totalPoints,
  totalTravels,
  bookTitle,
  escapeHtml,
}: {
  pageEntries: AtlasTravelEntry[]
  theme: PdfThemeConfig
  pageNumber: number
  pageIndex: number  // 0-based index page (0 = первая указательная)
  totalAtlasPages: number
  totalPoints: number
  totalTravels: number
  bookTitle?: string
  escapeHtml: (value: string) => string
}): string {
  const { colors, typography, spacing } = theme

  const headerKicker = pageIndex === 0 ? 'УКАЗАТЕЛЬ ТОЧЕК' : 'УКАЗАТЕЛЬ (ПРОДОЛЖЕНИЕ)'

  const groups = pageEntries
    .map((entry) => {
      const travel = entry.meta.travel
      const country = travel.countryName ? escapeHtml(travel.countryName) : ''
      const year = travel.year ? escapeHtml(String(travel.year)) : ''
      const metaLine = [country, year, `${entry.pointCount} ${pluralRu(entry.pointCount, ['точка', 'точки', 'точек'])}`]
        .filter(Boolean)
        .join(' · ')

      const mapPage = entry.meta.mapPage ?? entry.meta.startPage + 2

      const pointItems = entry.meta.locations
        .map((loc, idx) => {
          const rawAddress = loc.address || `Точка ${idx + 1}`
          const firstSegment = rawAddress.split(/\s*[·,]\s*/)[0]?.trim() || rawAddress
          return `
            <li style="
              display: flex;
              align-items: baseline;
              gap: 8px;
              padding: 3px 0;
              font-family: ${typography.bodyFont};
              font-size: 9pt;
              color: ${colors.text};
              line-height: 1.3;
              break-inside: avoid;
            ">
              <span style="
                flex-shrink: 0;
                min-width: 18px;
                font-weight: 700;
                color: ${entry.color};
                font-family: ${typography.headingFont};
                font-size: 8.5pt;
              ">${String(idx + 1).padStart(2, '0')}</span>
              <span style="
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              ">${escapeHtml(firstSegment)}</span>
            </li>
          `
        })
        .join('')

      return `
        <div style="
          margin-bottom: 6mm;
          break-inside: avoid;
          page-break-inside: avoid;
        ">
          <div style="
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            background: ${colors.surfaceAlt};
            border-left: 4px solid ${entry.color};
            border-radius: 0 10px 10px 0;
            margin-bottom: 3mm;
          ">
            <span style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 26px;
              height: 26px;
              border-radius: 50%;
              background: ${entry.color};
              color: #FFFFFF;
              font-weight: 800;
              font-size: 10pt;
              font-family: ${typography.headingFont};
              flex-shrink: 0;
            ">${entry.travelOrdinal}</span>
            <div style="flex: 1; min-width: 0;">
              <div style="
                font-family: ${typography.headingFont};
                font-size: 12pt;
                font-weight: 800;
                color: ${colors.text};
                line-height: 1.15;
                letter-spacing: -0.01em;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              ">${escapeHtml(travel.name)}</div>
              ${metaLine ? `
                <div style="
                  font-family: ${typography.bodyFont};
                  font-size: 8pt;
                  color: ${colors.textMuted};
                  margin-top: 1px;
                ">${metaLine}</div>
              ` : ''}
            </div>
            <div style="
              flex-shrink: 0;
              display: flex;
              align-items: baseline;
              gap: 4px;
              padding-left: 10px;
              border-left: 1px solid ${colors.border};
            ">
              <span style="
                font-size: 7pt;
                color: ${colors.textMuted};
                font-family: ${typography.bodyFont};
                letter-spacing: 0.1em;
                text-transform: uppercase;
                font-weight: 700;
              ">стр.</span>
              <span style="
                font-size: 16pt;
                font-weight: 800;
                color: ${entry.color};
                font-family: ${typography.headingFont};
                letter-spacing: -0.03em;
                line-height: 1;
              " data-atlas-page>${mapPage}</span>
            </div>
          </div>
          <ul style="
            list-style: none;
            padding: 0 4px 0 12px;
            margin: 0;
            columns: 2;
            column-gap: 14px;
          ">
            ${pointItems}
          </ul>
        </div>
      `
    })
    .join('')

  return `
    <section class="pdf-page atlas-page atlas-index-page" style="
      padding: ${spacing.pagePadding};
      background: ${colors.background};
      display: flex;
      flex-direction: column;
    ">
      <div style="
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 4mm;
        margin-bottom: 5mm;
        border-bottom: 2px solid ${colors.text};
      ">
        <div>
          <div style="
            font-size: 8pt;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: ${colors.accent};
            font-family: ${typography.bodyFont};
            margin-bottom: 2mm;
          ">${bookTitle ? escapeHtml(bookTitle) + ' · ' : ''}АТЛАС</div>
          <h2 style="
            font-size: 24pt;
            font-weight: 800;
            color: ${colors.text};
            letter-spacing: -0.03em;
            font-family: ${typography.headingFont};
            line-height: 1;
            margin: 0;
          ">${headerKicker.split('(')[0].trim()}${headerKicker.includes('(') ? ` <span style="font-size: 11pt; font-weight: 600; color: ${colors.textMuted};">(продолжение)</span>` : ''}</h2>
        </div>
        <div style="
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2mm;
        ">
          <div style="
            font-size: 7.5pt;
            color: ${colors.textMuted};
            font-family: ${typography.bodyFont};
            letter-spacing: 0.12em;
            text-transform: uppercase;
            font-weight: 700;
          ">${pageIndex === 0 ? 'Точки → страницы книги' : 'Продолжение указателя'}</div>
          <div style="
            font-size: 8.5pt;
            color: ${colors.text};
            font-family: ${typography.bodyFont};
            font-weight: 600;
          ">${totalTravels} · ${totalPoints} ${pluralRu(totalPoints, ['точка', 'точки', 'точек'])}</div>
        </div>
      </div>

      <div style="flex: 1;">
        ${groups}
      </div>

      <div style="
        margin-top: auto;
        padding-top: 4mm;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
      ">
        <div style="
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1.5px;
          background: linear-gradient(90deg, ${colors.accent}, ${colors.border} 40%, transparent);
          border-radius: 999px;
        "></div>
        <span style="
          font-size: 8pt;
          color: ${colors.textMuted};
          font-family: ${typography.bodyFont};
          letter-spacing: 0.06em;
          font-weight: 600;
        ">METRAVEL.BY · АТЛАС ${pageIndex + 2} / ${totalAtlasPages}</span>
        <span style="
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 6px;
          background: ${colors.accentSoft};
          color: ${colors.accentStrong};
          font-size: 8pt;
          font-weight: 700;
          font-family: ${typography.headingFont};
        " data-page-num>${pageNumber}</span>
      </div>
    </section>
  `
}

export function renderAtlasPages({
  meta,
  theme,
  bookTitle,
  startPageNumber,
  escapeHtml,
}: RenderAtlasPagesArgs): string[] {
  const entries = buildEntries(meta)
  if (entries.length < MIN_TRAVELS_FOR_ATLAS) return []

  const esc = escapeHtml || sharedEscapeHtml
  const totalPoints = entries.reduce((sum, e) => sum + e.pointCount, 0)
  const totalTravels = entries.length

  const indexChunks = chunkEntriesForIndex(entries)
  const totalAtlasPages = 1 + indexChunks.length

  const pages: string[] = []
  pages.push(
    renderAtlasMapPage({
      entries,
      theme,
      pageNumber: startPageNumber,
      totalAtlasPages,
      bookTitle,
      escapeHtml: esc,
    }),
  )

  indexChunks.forEach((chunk, idx) => {
    pages.push(
      renderAtlasIndexPage({
        pageEntries: chunk,
        theme,
        pageNumber: startPageNumber + 1 + idx,
        pageIndex: idx,
        totalAtlasPages,
        totalPoints,
        totalTravels,
        bookTitle,
        escapeHtml: esc,
      }),
    )
  })

  return pages
}

// ──────────────────────────────────────────────────────────────────────────────
// utils
// ──────────────────────────────────────────────────────────────────────────────

function pluralRu(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
  return forms[2]
}
