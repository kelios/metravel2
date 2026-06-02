import type { ComponentProps } from 'react'
import type Feather from '@expo/vector-icons/Feather'

import {
  getTravelStatusCalendarDate,
  parseTravelStatusDateParts,
  type TravelStatus,
  type TravelStatusEntry,
} from '@/stores/travelStatusStore'
import {
  getExplicitTravelStatusDate,
} from '@/utils/travelStatusCalendarDisplay'

type IconName = ComponentProps<typeof Feather>['name']

export type CalendarTab = {
  key: TravelStatus
  label: string
  icon: IconName
}

export type EmptyStateConfig = {
  icon: string
  title: string
  description: string
  actionLabel: string
}

export type CalendarEntry = TravelStatusEntry

export type DateEditorState = {
  item: CalendarEntry
  status: TravelStatus
  value: string
  error: string
} | null

export type StatusBuckets = Record<TravelStatus, CalendarEntry[]>

export const TABS: CalendarTab[] = [
  { key: 'visited', label: 'Был', icon: 'check-circle' },
  { key: 'planned', label: 'Планирую', icon: 'calendar' },
  { key: 'wishlist', label: 'Хочу', icon: 'bookmark' },
]

export const EMPTY_STATE: Record<TravelStatus, EmptyStateConfig> = {
  visited: {
    icon: 'check-circle',
    title: 'Нет посещённых мест',
    description: 'Открой путешествие и отметь его статусом «Был здесь», чтобы оно появилось в этом разделе.',
    actionLabel: 'Найти путешествия',
  },
  planned: {
    icon: 'calendar',
    title: 'Нет запланированных поездок',
    description: 'Открой любое путешествие, нажми «Добавить в план», затем «Планирую» и выбери дату.',
    actionLabel: 'Найти маршрут',
  },
  wishlist: {
    icon: 'bookmark',
    title: 'Список желаний пуст',
    description: 'Открой путешествие и выбери статус «Хочу поехать», чтобы собрать здесь личный список желаний.',
    actionLabel: 'Найти маршруты',
  },
}

export const TAB_HINTS: Record<TravelStatus, string> = {
  visited: 'Выбери дату, чтобы увидеть посещённые поездки за этот день. Если точной даты нет, добавь её прямо в карточке.',
  planned: 'Выбери дату, чтобы отфильтровать запланированные поездки.',
  wishlist: 'Это личный список желаний. Дата для него не обязательна — главное, что вы хотите сохранить маршрут на потом.',
}

export const CARD_META_ICON_STYLE = { marginRight: 4 } as const

export const DEFAULT_BUCKETS: StatusBuckets = {
  visited: [],
  planned: [],
  wishlist: [],
}

export const getCalendarDate = (entry: CalendarEntry): string | undefined =>
  getExplicitTravelStatusDate(entry) ?? getTravelStatusCalendarDate(entry)

export const getLocationLabel = (entry: CalendarEntry) =>
  [entry.city, entry.country].filter(Boolean).join(', ')

export const getTravelPeriodLabel = (entry: CalendarEntry) => {
  const parts = [entry.travelMonthName, entry.travelYear].filter(Boolean)
  if (parts.length > 0) return parts.join(' ')
  return entry.travelYear
}

export const getEntryKey = (entry: CalendarEntry) =>
  `${entry.status}-${String(entry.id)}`

export const isSelectedCalendarDate = (entry: CalendarEntry, selectedDate: string | null) => {
  if (!selectedDate) return true

  const explicitDate = getExplicitTravelStatusDate(entry)
  if (explicitDate) return explicitDate === selectedDate

  const selectedParts = parseTravelStatusDateParts(selectedDate)
  const displayParts = parseTravelStatusDateParts(getCalendarDate(entry))
  if (!selectedParts || !displayParts) return false

  return selectedParts.year === displayParts.year && selectedParts.month === displayParts.month
}

export const groupEntriesByStatus = (entries: TravelStatusEntry[]): StatusBuckets =>
  entries.reduce<StatusBuckets>(
    (buckets, entry) => {
      buckets[entry.status].push(entry)
      return buckets
    },
    { visited: [], planned: [], wishlist: [] }
  )

export const sortCalendarEntries = (entries: CalendarEntry[], status: TravelStatus) =>
  [...entries].sort((a, b) => {
    const dateA = getCalendarDate(a)
    const dateB = getCalendarDate(b)

    if (dateA && dateB) {
      return status === 'planned' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA)
    }

    if (!dateA && !dateB) return b.addedAt - a.addedAt
    return dateA ? -1 : 1
  })

export const getDateEditorSubtitle = (status?: TravelStatus) => {
  if (status === 'visited') return 'Укажи дату, когда ты был в этом путешествии.'
  if (status === 'wishlist') return 'Этот статус просто сохраняет маршрут в ваш личный список желаний. Дата не обязательна.'
  return 'Укажи дату запланированной поездки.'
}
