// components/trips/planning/print/tripPlanPrintHtml.ts
// #2068: HTML печатной версии плана. Документ самодостаточный — стили внутри,
// скриптов нет, кроме кнопки печати на панели, которая на бумагу не попадает.
// Каждая строка из данных поездки проходит escapeHtml: название, описания и
// брони пишет пользователь.
import type { TripGearItem } from '@/api/plannedTripsGear'
import type { OvernightBooking, RoutePointArrivalMode } from '@/api/plannedTripsTypes'
import { getActiveLocaleDefinition, translate as i18nT } from '@/i18n'
import { formatDate, formatNumber } from '@/i18n/format'
import { escapeHtml } from '@/utils/htmlUtils'
import { parseTripDateTime } from '@/utils/tripDateTime'
import {
  ROUTE_POINT_LABEL,
  TRANSPORT_LABEL,
  formatDirectDistanceValue,
  formatDistance,
  formatTripDateTime,
  isDirectLineSummary,
} from '../tripPlanFormatting'
import { GEAR_CATEGORY_LABEL, GEAR_STATUS_LABEL } from '../tripGearRules'
import type { TripPlanPrintDay, TripPlanPrintModel, TripPlanPrintPoint } from './tripPlanPrintModel'

const esc = (value: string | null | undefined) => escapeHtml(value ?? '')

/** Текст пользователя: абзацы по пустой строке, переносы строк сохраняются. */
const paragraphs = (text: string | null | undefined): string =>
  (text ?? '')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${esc(block).replace(/\n/g, '<br>')}</p>`)
    .join('')

const ARRIVAL_LABEL: Record<RoutePointArrivalMode, string> = {
  get train() { return i18nT('trips:components.trips.planning.print.arrival.train') },
  get flight() { return i18nT('trips:components.trips.planning.print.arrival.flight') },
  get bus() { return i18nT('trips:components.trips.planning.print.arrival.bus') },
  get ferry() { return i18nT('trips:components.trips.planning.print.arrival.ferry') },
  get transfer() { return i18nT('trips:components.trips.planning.print.arrival.transfer') },
}

const dayDateLabel = (date: string | null): string => {
  const parsed = parseTripDateTime(date)
  return parsed ? formatDate(parsed.value, { weekday: 'short', day: 'numeric', month: 'long' }) : ''
}

const dayTitle = (day: TripPlanPrintDay, hasDays: boolean): string => {
  if (day.dayNumber != null) return i18nT('trips:components.trips.planning.print.day', { day: day.dayNumber })
  return hasDays ? i18nT('trips:components.trips.planning.print.dayWithoutNumber') : i18nT('trips:components.trips.planning.print.routeTitle')
}

const dayDistanceLabel = (day: TripPlanPrintDay, approximate: boolean): string => {
  if (day.distanceKm == null || day.distanceKm <= 0) return ''
  const distance = formatDistance(day.distanceKm)
  if (approximate) return i18nT('trips:components.trips.planning.print.dayDistanceDirect', { distance })
  // Группа без номера дня — весь маршрут или хвост без дня: «за день» там неправда.
  return day.dayNumber != null ? i18nT('trips:components.trips.planning.print.dayDistance', { distance }) : `≈ ${distance}`
}

const bookingHtml = (booking: OvernightBooking | null | undefined): string => {
  if (!booking) return ''
  const rows = [
    booking.address ? `<div><span class="k">${esc(i18nT('trips:components.trips.planning.print.booking.address'))}</span> ${esc(booking.address)}</div>` : '',
    booking.checkinTime ? `<div>${esc(i18nT('trips:components.trips.planning.print.booking.checkin', { time: booking.checkinTime }))}</div>` : '',
    booking.price != null ? `<div>${esc(i18nT('trips:components.trips.planning.print.booking.price', { price: formatNumber(booking.price) }))}</div>` : '',
    booking.url ? `<div><span class="k">${esc(i18nT('trips:components.trips.planning.print.booking.link'))}</span> <span class="url">${esc(booking.url)}</span></div>` : '',
  ].filter(Boolean)
  return rows.length ? `<div class="booking">${rows.join('')}</div>` : ''
}

const pointHtml = (item: TripPlanPrintPoint): string => {
  const { point, arrival } = item
  const arrivalHtml = arrival
    ? `<div class="arrival">${esc(
        arrival.distanceKm != null
          ? i18nT('trips:components.trips.planning.print.arrivalDistance', { mode: ARRIVAL_LABEL[arrival.mode], distance: formatDistance(arrival.distanceKm) })
          : ARRIVAL_LABEL[arrival.mode],
      )}</div>`
    : ''
  return `${arrivalHtml}<li class="point point-${esc(point.type)}">
  <span class="num">${item.number}</span>
  <div class="body">
    <div class="type">${esc(ROUTE_POINT_LABEL[point.type])}</div>
    <div class="name">${esc(point.name)}</div>
    ${paragraphs(point.description)}
    ${point.type === 'overnight' ? bookingHtml(point.booking) : ''}
  </div>
</li>`
}

const dayHtml = (day: TripPlanPrintDay, model: TripPlanPrintModel, mapUrl: string | undefined): string => {
  const title = dayTitle(day, model.hasDays)
  const meta = [dayDateLabel(day.date), dayDistanceLabel(day, model.approximate)].filter(Boolean)
  const map = mapUrl
    ? `<figure class="map"><img src="${esc(mapUrl)}" alt="${esc(i18nT('trips:components.trips.planning.print.mapAlt', { title }))}"><figcaption>${esc(i18nT('trips:components.trips.planning.print.mapCredit'))}</figcaption></figure>`
    : ''
  const overnight = day.overnight
    ? `<div class="sleep"><span class="k">${esc(i18nT('trips:components.trips.planning.print.overnightLabel'))}</span> ${esc(day.overnight.point.name)}</div>`
    : ''
  return `<section class="day" data-day="${esc(day.key)}">
  <header><h2>${esc(title)}</h2>${meta.length ? `<div class="meta">${esc(meta.join(' · '))}</div>` : ''}</header>
  ${map}
  <ol class="points">${day.points.map(pointHtml).join('')}</ol>
  ${overnight}
</section>`
}

const gearHtml = (gear: TripPlanPrintModel['gear']): string => {
  if (!gear.length) return ''
  const item = (entry: TripGearItem) =>
    `<div class="gear-item"><span class="box${entry.status === 'packed' ? ' checked' : ''}"></span>${esc(entry.title)}${
      entry.status === 'buy' ? ` <span class="muted">(${esc(GEAR_STATUS_LABEL.buy.toLocaleLowerCase())})</span>` : ''
    }</div>`
  return `<section class="gear"><h2>${esc(i18nT('trips:components.trips.planning.print.gearTitle'))}</h2><div class="gear-cols">${gear
    .map(
      (group) =>
        `<h4>${esc(GEAR_CATEGORY_LABEL[group.category])}</h4>${group.items
          .map(item)
          .join('')}`,
    )
    .join('')}</div></section>`
}

const summaryHtml = (model: TripPlanPrintModel): string => {
  const { trip } = model
  const tiles: Array<[string, string]> = []
  const summary = trip.routeSummary
  if (summary && summary.distanceKm > 0) {
    // #2057: дистанция прямой линии подписывается «по прямой» — как в RouteSummaryBar.
    tiles.push(
      isDirectLineSummary(summary)
        ? [i18nT('tripsStatic:plan.summary.directDistanceLabel'), formatDirectDistanceValue(summary.distanceKm)]
        : [TRANSPORT_LABEL[trip.transport], formatDistance(summary.distanceKm)],
    )
  }
  if (model.transferDistanceKm > 0) tiles.push([i18nT('trips:components.trips.planning.print.summary.transfers'), formatDistance(model.transferDistanceKm)])
  if (model.hasDays) tiles.push([i18nT('trips:components.trips.planning.print.summary.days'), String(model.days.filter((d) => d.dayNumber != null).length)])
  tiles.push([i18nT('trips:components.trips.planning.print.summary.points'), String(trip.route.length)])
  if (model.overnights.length) tiles.push([i18nT('trips:components.trips.planning.print.summary.overnights'), String(model.overnights.length)])
  return `<div class="tiles">${tiles.map(([k, v]) => `<div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`
}

const daysTableHtml = (model: TripPlanPrintModel): string => {
  if (!model.hasDays) return ''
  const rows = model.days
    .map((day) => {
      const first = day.points[0]?.point.name ?? ''
      const last = day.points[day.points.length - 1]?.point.name ?? ''
      return `<tr><td class="nowrap">${esc(dayTitle(day, true))}</td><td class="nowrap">${esc(dayDateLabel(day.date))}</td><td>${esc(
        first === last ? first : `${first} → ${last}`,
      )}</td><td class="nowrap">${esc(day.distanceKm ? formatDistance(day.distanceKm) : '—')}</td><td>${esc(day.overnight?.point.name ?? '')}</td></tr>`
    })
    .join('')
  return `<table class="days"><thead><tr><th>${esc(i18nT('trips:components.trips.planning.print.table.day'))}</th><th>${esc(i18nT('trips:components.trips.planning.print.table.date'))}</th><th>${esc(
    i18nT('trips:components.trips.planning.print.table.route'),
  )}</th><th>${esc(i18nT('trips:components.trips.planning.print.table.distance'))}</th><th>${esc(i18nT('trips:components.trips.planning.print.table.overnight'))}</th></tr></thead><tbody>${rows}</tbody></table>`
}

const STYLES = `
@page { size: A4; margin: 12mm 12mm 14mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; background: #fff; color: #16181d; font: 10pt/1.4 -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif; }
.doc { max-width: 186mm; margin: 0 auto; }
.toolbar { position: sticky; top: 0; z-index: 1; display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 10px 16px; background: #f3f4f6; border-bottom: 1px solid #d5d8de; }
.toolbar button { font: inherit; font-weight: 600; padding: 8px 18px; border-radius: 8px; border: 0; background: #1f4e9e; color: #fff; cursor: pointer; }
.toolbar span { color: #5b6170; font-size: 9pt; }
h1 { font-size: 20pt; line-height: 1.15; margin: 8mm 0 2mm; }
h2 { font-size: 13.5pt; margin: 0 0 1.5mm; }
h4 { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; color: #5b6170; margin: 3mm 0 1mm; break-after: avoid; }
p { margin: 0 0 1.5mm; }
.sub { color: #5b6170; margin-bottom: 3mm; }
.muted, .meta, figcaption { color: #5b6170; }
.meta { font-weight: 600; margin-bottom: 2mm; }
.tiles { display: flex; flex-wrap: wrap; border: 1px solid #d5d8de; border-radius: 3mm; overflow: hidden; margin: 2mm 0 4mm; }
.tiles div { flex: 1 1 0; min-width: 32mm; padding: 1.6mm 3mm; border-right: 1px solid #d5d8de; }
.tiles div:last-child { border-right: 0; }
.tiles span { display: block; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .05em; color: #5b6170; }
.tiles b { font-size: 11pt; }
table { width: 100%; border-collapse: collapse; font-size: 9pt; }
th, td { text-align: left; vertical-align: top; padding: 1mm 1.6mm; border-bottom: 1px solid #d5d8de; }
th { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .05em; color: #5b6170; }
.nowrap { white-space: nowrap; }
.description { break-before: page; }
.description h2 { margin-bottom: 3mm; }
.day { break-before: page; }
.map { margin: 0 0 3mm; }
.map img { width: 100%; max-height: 105mm; object-fit: contain; border: 1px solid #d5d8de; border-radius: 2mm; display: block; }
figcaption { font-size: 7.5pt; margin-top: .8mm; }
.points { list-style: none; margin: 0; padding: 0; }
.point { display: flex; gap: 3mm; padding: 1.8mm 0; border-bottom: 1px solid #eceef1; break-inside: avoid; }
.num { flex: 0 0 6.5mm; height: 6.5mm; border-radius: 50%; background: #16181d; color: #fff; font-size: 8pt; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.point-overnight .num { background: #1f4e9e; border-radius: 1.2mm; }
.body { flex: 1; min-width: 0; }
.type { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .06em; color: #5b6170; }
.name { font-weight: 700; font-size: 10.5pt; margin-bottom: .6mm; }
.arrival { margin: 1.5mm 0 0 9.5mm; padding: 1mm 2.5mm; border-left: 1mm dashed #5b6170; color: #5b6170; font-weight: 600; font-size: 9pt; }
.booking, .sleep { background: #f3f4f6; border-left: 1mm solid #1f4e9e; border-radius: 0 1.5mm 1.5mm 0; padding: 1.5mm 3mm; margin-top: 1.2mm; font-size: 9pt; break-inside: avoid; }
.sleep { margin-top: 3mm; font-weight: 600; break-before: avoid; }
.k { color: #5b6170; font-weight: 600; }
.url { word-break: break-all; }
.gear { break-before: page; }
.gear-cols { columns: 2; column-gap: 8mm; font-size: 9pt; }
.gear-item { break-inside: avoid; margin-bottom: 1mm; padding-left: 5.5mm; text-indent: -5.5mm; }
.box { display: inline-block; width: 3.4mm; height: 3.4mm; border: 1.2px solid #16181d; border-radius: .6mm; margin-right: 2mm; vertical-align: -.4mm; }
.box.checked { background: #16181d; }
.notes { break-before: page; }
.notes div { border-bottom: 1px solid #d5d8de; height: 8mm; }
.footer { margin-top: 5mm; font-size: 8pt; color: #5b6170; }
@media print { .toolbar { display: none; } h1 { margin-top: 0; } }
@media screen { body { background: #e9eaee; } .doc { background: #fff; padding: 6mm 12mm 12mm; margin: 6mm auto; box-shadow: 0 1px 6px rgba(0,0,0,.15); } }
@media screen and (max-width: 700px) { .doc { padding: 4mm; margin: 0; } .gear-cols { columns: 1; } }
`

export interface TripPlanPrintHtmlOptions {
  /** dataURL карт по `day.key`; день без карты просто печатается без неё. */
  maps: Record<string, string>
  pageUrl: string
  printedAt: Date
}

export function buildTripPlanPrintHtml(model: TripPlanPrintModel, options: TripPlanPrintHtmlOptions): string {
  const { trip } = model
  const locale = getActiveLocaleDefinition()
  const dates = formatTripDateTime(trip.startDate, trip.startTime, trip.endDate)
  const subtitle = [dates, TRANSPORT_LABEL[trip.transport]].filter(Boolean).join(' · ')
  const notes = '<div></div>'.repeat(24)
  return `<!DOCTYPE html>
<html lang="${esc(locale.htmlLang)}" dir="${esc(locale.direction)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(i18nT('trips:components.trips.planning.print.documentTitle', { title: trip.title }))}</title>
<style>${STYLES}</style>
</head>
<body>
<div class="toolbar"><span>${esc(i18nT('trips:components.trips.planning.print.toolbarHint'))}</span><button type="button" onclick="window.print()">${esc(i18nT('trips:components.trips.planning.print.toolbarPrint'))}</button></div>
<main class="doc">
  <h1>${esc(trip.title)}</h1>
  <div class="sub">${esc(subtitle)}</div>
  ${summaryHtml(model)}
  ${model.approximate ? `<p class="muted">${esc(i18nT('trips:components.trips.planning.print.approximate'))}</p>` : ''}
  ${daysTableHtml(model)}
  ${trip.description.trim() ? `<section class="description"><h2>${esc(i18nT('trips:components.trips.planning.print.descriptionTitle'))}</h2>${paragraphs(trip.description)}</section>` : ''}
  ${model.days.map((day) => dayHtml(day, model, options.maps[day.key])).join('')}
  ${gearHtml(model.gear)}
  <section class="notes"><h2>${esc(i18nT('trips:components.trips.planning.print.notesTitle'))}</h2>${notes}</section>
  <div class="footer">${esc(i18nT('trips:components.trips.planning.print.footer', { url: options.pageUrl, date: formatDate(options.printedAt, { day: 'numeric', month: 'long', year: 'numeric' }) }))}</div>
</main>
</body>
</html>`
}
