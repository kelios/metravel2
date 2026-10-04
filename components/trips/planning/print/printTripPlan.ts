// components/trips/planning/print/printTripPlan.ts
// #2068/#2102: печатает план поездки через единую точку printHtml (web — окно
// браузера, приложения — системный диалог печати). Окно на web резервируется
// синхронно в обработчике клика — иначе блокировщик всплывающих окон отменит
// его после await; карты и чеклист догружаются уже в открытое окно.
import type { PlannedTrip } from '@/api/plannedTripsTypes'
import { fetchTripGear, type TripGearItem } from '@/api/plannedTripsGear'
import { beginPrint, type PrintResult } from '@/utils/printHtml'
import { buildTripPlanUrl } from '@/utils/tripPlanLinks'
import { buildTripPlanPrintHtml } from './tripPlanPrintHtml'
import { buildTripPlanPrintModel, type TripPlanPrintModel } from './tripPlanPrintModel'

const MAP_WIDTH = 1400
const MAP_HEIGHT = 760
const MAP_MAX_ZOOM = 15

/**
 * Чеклист видит только владелец и участник «еду» — тот же гейт, что у
 * `TripGearChecklist`: остальным он не печатается, и заведомый 401/403 не уходит.
 */
const loadGear = async (trip: PlannedTrip): Promise<TripGearItem[] | null> => {
  if (!trip.isOwner && trip.myRsvp !== 'going') return null
  try {
    return await fetchTripGear(trip.id)
  } catch {
    return null
  }
}

/** Карты дней по очереди: тайлы одного сервера, параллельная загрузка не ускорит. */
const renderDayMaps = async (model: TripPlanPrintModel): Promise<Record<string, string>> => {
  const maps: Record<string, string> = {}
  const days = model.days.filter((day) => day.map)
  if (!days.length) return maps
  let snapshot: typeof import('@/utils/mapImageGenerator')
  try {
    snapshot = await import('@/utils/mapImageGenerator')
  } catch {
    // Чанк генератора не догрузился (сеть, свежий выкат) — план печатается без
    // карт, а не висит пустым окном; следующий клик грузит чанк заново.
    return maps
  }
  for (const day of days) {
    if (!day.map) continue
    try {
      const url = await snapshot.generateCanvasMapSnapshot(
        day.map.points.map((item) => ({
          lat: (item.latLng as [number, number])[0],
          lng: (item.latLng as [number, number])[1],
          label: String(item.number),
        })),
        { width: MAP_WIDTH, height: MAP_HEIGHT, maxZoom: MAP_MAX_ZOOM, routeLine: day.map.line, fitPaddingFactor: 1.15 },
      )
      if (url) maps[day.key] = url
    } catch {
      // День без карты печатается списком точек — это лучше, чем не открыть печать вовсе.
    }
  }
  return maps
}

/** 'unavailable' — печатать нечем (всплывающие окна запрещены / нет модуля печати). */
export async function printTripPlan(trip: PlannedTrip): Promise<PrintResult> {
  const session = beginPrint()
  // Окно заблокировано / модуля нет — выходим до чеклиста, чанка карт и тайлов.
  if (!session.available) return 'unavailable'
  let html: string
  try {
    const gear = await loadGear(trip)
    const model = buildTripPlanPrintModel(trip, gear)
    const maps = await renderDayMaps(model)
    html = buildTripPlanPrintHtml(model, {
      maps,
      pageUrl: buildTripPlanUrl(trip),
      printedAt: new Date(),
    })
  } catch (error) {
    // #2125: документ не собрался — заглушка «Готовим печатную версию…» не остаётся висеть.
    session.cancel()
    throw error
  }
  return session.print(html, { title: trip.title })
}
