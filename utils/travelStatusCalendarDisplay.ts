import {
  getTravelStatusCalendarDate,
  parseTravelStatusDateParts,
  type TravelStatus,
  type TravelStatusEntry,
} from '@/stores/travelStatusStore'

export type TravelStatusCalendarDisplayEntry = Pick<
  TravelStatusEntry,
  | 'id'
  | 'status'
  | 'plannedDate'
  | 'visitedDate'
  | 'wishlistDate'
  | 'travelYear'
  | 'travelMonth'
  | 'travelMonthName'
> & {
  _fallbackCalendarDate?: string
}

export const getDateFieldForTravelStatus = (status: TravelStatus) => {
  if (status === 'visited') return 'visitedDate'
  if (status === 'wishlist') return 'wishlistDate'
  return 'plannedDate'
}

export const getExplicitTravelStatusDate = (
  entry: Pick<TravelStatusEntry, 'status' | 'plannedDate' | 'visitedDate' | 'wishlistDate'>
): string | undefined => {
  const dateField = getDateFieldForTravelStatus(entry.status)
  const value = entry[dateField]
  return parseTravelStatusDateParts(value) ? value : undefined
}

export const getTravelStatusDisplayCalendarDate = (
  entry: TravelStatusCalendarDisplayEntry
): string | undefined =>
  getTravelStatusCalendarDate(entry) ?? entry._fallbackCalendarDate

export const travelStatusEntryMatchesSelectedDate = (
  entry: TravelStatusCalendarDisplayEntry,
  selectedDate: string | null | undefined
): boolean => {
  if (!selectedDate) return true

  const explicitDate = getExplicitTravelStatusDate(entry)
  if (explicitDate) return explicitDate === selectedDate

  const selectedParts = parseTravelStatusDateParts(selectedDate)
  const displayParts = parseTravelStatusDateParts(getTravelStatusDisplayCalendarDate(entry))
  if (!selectedParts || !displayParts) return false

  return selectedParts.year === displayParts.year && selectedParts.month === displayParts.month
}
