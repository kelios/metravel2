/**
 * Плоский текст плана поездки для `POST /ai/author-draft {kind: 'trip'}` (#2911): точки
 * по порядку (названия, пустые пропущены), даты и транспорт — ровно то, из чего модель
 * собирает описание, ничего не выдумывая. Без импортов `api/aiAssist`: экран поездки
 * считает строку всегда, а панель черновика грузится только под флагом.
 */
import type { PlannedTrip } from '@/api/plannedTripsTypes'
import { TRANSPORT_LABEL } from '@/components/trips/planning/tripPlanFormatting'
import { translate as i18nT } from '@/i18n'

export type TripDraftSource = Pick<PlannedTrip, 'route' | 'startDate' | 'endDate' | 'transport'> & { title?: string }

export function buildTripDraftText(trip: TripDraftSource): string {
  const names = trip.route.map((point) => point.name.trim()).filter(Boolean)
  const lines: string[] = []
  const title = trip.title?.trim()
  if (title) lines.push(`${i18nT('aiAssistStatic:tripDraft.source.title')}: ${title}`)
  if (names.length) lines.push(`${i18nT('aiAssistStatic:tripDraft.source.points')}: ${names.join(' → ')}`)
  const dates = [trip.startDate, trip.endDate].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  if (dates.length) lines.push(`${i18nT('aiAssistStatic:tripDraft.source.dates')}: ${dates[0]}${dates[1] && dates[1] !== dates[0] ? ` – ${dates[1]}` : ''}`)
  if (trip.transport) lines.push(`${i18nT('aiAssistStatic:tripDraft.source.transport')}: ${TRANSPORT_LABEL[trip.transport]}`)
  return lines.join('. ')
}
